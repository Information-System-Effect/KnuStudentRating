package com.max.pract.review;

import com.max.pract.entity.AppUser;
import com.max.pract.entity.ProjectEntity;
import com.max.pract.entity.ReviewEntity;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.profile.CategoryScoreService;
import com.max.pract.auth.AppRole;
import com.max.pract.catalog.CategoryCatalog;
import com.max.pract.project.ProjectStatus;
import com.max.pract.project.ProjectService;
import com.max.pract.project.ReviewWindowService;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.repo.ProjectRepository;
import com.max.pract.repo.ReviewRepository;
import com.max.pract.review.dto.CreateReviewRequest;
import com.max.pract.review.dto.ReviewCategoryOptionDto;
import com.max.pract.review.dto.ReviewResponse;
import com.max.pract.review.dto.UpdateReviewRequest;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class ReviewService {

    private static final float TECHNICAL_LIMIT_STUDENT = 5F;
    private static final float TECHNICAL_LIMIT_TEACHER = 20F;
    private static final float SUBJECTIVE_LIMIT_ALL = 5F;
    private static final float BUDGET_EPSILON = 0.0001F;

    private final ReviewRepository reviewRepository;
    private final ProjectService projectService;
    private final ReviewWindowService reviewWindowService;
    private final AppUserRepository appUserRepository;
    private final ProjectRepository projectRepository;
    private final JdbcTemplate jdbcTemplate;
    private final CategoryScoreService categoryScoreService;

    public ReviewService(
            ReviewRepository reviewRepository,
            ProjectService projectService,
            ReviewWindowService reviewWindowService,
            AppUserRepository appUserRepository,
            ProjectRepository projectRepository,
            JdbcTemplate jdbcTemplate,
            CategoryScoreService categoryScoreService
    ) {
        this.reviewRepository = reviewRepository;
        this.projectService = projectService;
        this.reviewWindowService = reviewWindowService;
        this.appUserRepository = appUserRepository;
        this.projectRepository = projectRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.categoryScoreService = categoryScoreService;
    }

    @Transactional
    public ReviewResponse create(Long authorUserId, Long projectId, CreateReviewRequest request) {
        AppUser author = findUser(authorUserId, "Author user not found");
        AppUser target = findUser(request.getTargetUserId(), "Target user not found");
        validateReviewWindowAndMembership(
                authorUserId,
                request.getTargetUserId(),
                author.getRole(),
                target.getRole(),
                projectId
        );

        CategoryMeta category = loadCategoryMetaForTargetUser(request.getCategoryId(), target.getRole());
        float maxAbsDelta = resolveMaxAbsDelta(author.getRole(), category);
        validateDeltaWithinLimit(request.getDelta(), maxAbsDelta);
        ensureNoExistingReview(projectId, authorUserId, request.getTargetUserId(), request.getCategoryId());
        if (isSubjectiveCategory(category)) {
            validateSubjectiveBudgetForCreate(projectId, authorUserId, request.getTargetUserId(), request.getDelta());
        }

        ReviewEntity review = new ReviewEntity();
        review.setProjectId(projectId);
        review.setAuthorUserId(authorUserId);
        review.setTargetUserId(request.getTargetUserId());
        review.setCategoryId(request.getCategoryId());
        review.setDelta(request.getDelta());
        review.setComment(trimToNull(request.getComment()));
        ReviewEntity savedReview = reviewRepository.save(review);
        categoryScoreService.applyProjectReviewDelta(
                savedReview.getTargetUserId(),
                savedReview.getCategoryId(),
                savedReview.getId(),
                savedReview.getDelta()
        );
        categoryScoreService.markSelfDeclaredSkillVerifiedByReview(
                savedReview.getTargetUserId(),
                savedReview.getCategoryId()
        );
        return toResponse(savedReview);
    }

    @Transactional
    public ReviewResponse update(Long authorUserId, Long projectId, Long reviewId, UpdateReviewRequest request) {
        assertReviewDeadlineOpen(projectId);

        AppUser author = findUser(authorUserId, "Author user not found");
        ReviewEntity review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ApiBadRequestException("Review not found"));
        if (!review.getProjectId().equals(projectId)) {
            throw new ApiBadRequestException("Review does not belong to project");
        }
        if (!review.getAuthorUserId().equals(authorUserId)) {
            throw new ApiForbiddenException("Only review author can update this review");
        }

        AppUser target = findUser(review.getTargetUserId(), "Target user not found");
        CategoryMeta category = loadCategoryMetaForTargetUser(review.getCategoryId(), target.getRole());
        float maxAbsDelta = resolveMaxAbsDelta(author.getRole(), category);
        validateDeltaWithinLimit(request.getDelta(), maxAbsDelta);
        if (isSubjectiveCategory(category)) {
            validateSubjectiveBudgetForUpdate(
                    projectId,
                    authorUserId,
                    review.getTargetUserId(),
                    reviewId,
                    request.getDelta()
            );
        }

        Float previousDelta = review.getDelta();
        review.setDelta(request.getDelta());
        review.setComment(trimToNull(request.getComment()));
        ReviewEntity savedReview = reviewRepository.save(review);
        float deltaDiff = savedReview.getDelta() - previousDelta;
        if (deltaDiff != 0F) {
            categoryScoreService.applyProjectReviewDelta(
                    savedReview.getTargetUserId(),
                    savedReview.getCategoryId(),
                    savedReview.getId(),
                    deltaDiff
            );
        }
        categoryScoreService.markSelfDeclaredSkillVerifiedByReview(
                savedReview.getTargetUserId(),
                savedReview.getCategoryId()
        );
        return toResponse(savedReview);
    }

    @Transactional(readOnly = true)
    public List<ReviewCategoryOptionDto> listReviewOptions(Long authorUserId, Long projectId, Long targetUserId) {
        AppUser author = findUser(authorUserId, "Author user not found");
        AppUser target = findUser(targetUserId, "Target user not found");

        validateReviewWindowAndMembership(authorUserId, targetUserId, author.getRole(), target.getRole(), projectId);

        String expectedAudience = mapRoleToCategoryAudience(target.getRole());
        Set<Long> reviewedCategoryIds = findAlreadyReviewedCategoryIds(projectId, authorUserId, targetUserId);
        float remainingSubjectiveBudget = remainingSubjectiveBudget(projectId, authorUserId, targetUserId, null);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                        SELECT c.id AS category_id,
                               c.code AS category_code,
                               c.name AS category_name,
                               ct.dimension AS category_dimension
                        FROM categories c
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE ct.audience = ?
                        ORDER BY c.code
                        """,
                expectedAudience
        );

        List<ReviewCategoryOptionDto> options = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long categoryId = ((Number) row.get("category_id")).longValue();
            if (reviewedCategoryIds.contains(categoryId)) {
                continue;
            }

            String categoryCode = asText(row.get("category_code"));
            String categoryName = asText(row.get("category_name"));
            String dimension = normalizeToken(asText(row.get("category_dimension")));
            CategoryMeta category = new CategoryMeta(categoryId, categoryCode, categoryName, dimension);

            try {
                float maxAbsDelta = resolveMaxAbsDelta(author.getRole(), category);
                Float subjectiveRemaining = null;
                if (isSubjectiveCategory(category)) {
                    subjectiveRemaining = remainingSubjectiveBudget;
                    maxAbsDelta = Math.min(maxAbsDelta, remainingSubjectiveBudget);
                }
                if (maxAbsDelta <= BUDGET_EPSILON) {
                    continue;
                }
                options.add(new ReviewCategoryOptionDto(
                        category.id(),
                        category.code(),
                        category.name(),
                        category.dimension(),
                        maxAbsDelta,
                        subjectiveRemaining
                ));
            } catch (ApiForbiddenException ignored) {
                // Skip categories not allowed for current author role.
            }
        }
        return options;
    }

    private void validateReviewWindowAndMembership(
            Long authorUserId,
            Long targetUserId,
            AppRole authorRole,
            AppRole targetRole,
            Long projectId
    ) {
        if (authorUserId.equals(targetUserId)) {
            throw new ApiForbiddenException("Self-review is not allowed");
        }
        validateAuthorTargetRoles(authorRole, targetRole);
        assertReviewDeadlineOpen(projectId);
        if (!projectService.isProjectMember(projectId, authorUserId)) {
            throw new ApiForbiddenException("Author is not a project member");
        }
        if (!projectService.isProjectMember(projectId, targetUserId)) {
            throw new ApiForbiddenException("Target user is not a project member");
        }
    }

    private CategoryMeta loadCategoryMetaForTargetUser(Long categoryId, AppRole targetRole) {
        String expectedAudience = mapRoleToCategoryAudience(targetRole);
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(
                    """
                            SELECT c.id AS category_id,
                                   c.code AS category_code,
                                   c.name AS category_name,
                                   ct.dimension AS category_dimension
                            FROM categories c
                            JOIN category_types ct ON ct.id = c.category_type_id
                            WHERE c.id = ? AND ct.audience = ?
                            """,
                    categoryId,
                    expectedAudience
            );
            return new CategoryMeta(
                    ((Number) row.get("category_id")).longValue(),
                    asText(row.get("category_code")),
                    asText(row.get("category_name")),
                    normalizeToken(asText(row.get("category_dimension")))
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ApiForbiddenException("Category does not match target user audience");
        }
    }

    private void assertReviewDeadlineOpen(Long projectId) {
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiBadRequestException("Project not found"));

        if (project.getStatus() != ProjectStatus.COMPLETED) {
            throw new ApiForbiddenException("Reviews are available only after project completion");
        }

        reviewWindowService.assertWindowOpen(projectId);
    }

    private void validateAuthorTargetRoles(AppRole authorRole, AppRole targetRole) {
        boolean allowedAuthorRole = authorRole == AppRole.STUDENT
                || authorRole == AppRole.TEACHER
                || authorRole == AppRole.POSTGRADUATE;
        if (!allowedAuthorRole) {
            throw new ApiForbiddenException("Author role is not allowed to submit reviews");
        }

        boolean allowedTargetRole = targetRole == AppRole.STUDENT
                || targetRole == AppRole.TEACHER
                || targetRole == AppRole.POSTGRADUATE
                || targetRole == AppRole.ADMIN;
        if (!allowedTargetRole) {
            throw new ApiForbiddenException("Target role is not reviewable");
        }
    }

    private String mapRoleToCategoryAudience(AppRole role) {
        if (role == AppRole.STUDENT) {
            return "STUDENT";
        }
        if (role == AppRole.TEACHER || role == AppRole.ADMIN) {
            return "TEACHER";
        }
        if (role == AppRole.POSTGRADUATE) {
            return "TEACHER";
        }
        throw new ApiForbiddenException("Unsupported target role for review categories");
    }

    private float resolveMaxAbsDelta(AppRole authorRole, CategoryMeta category) {
        String dimension = normalizeToken(category.dimension());
        if ("TECHNICAL".equals(dimension)) {
            if (authorRole == AppRole.STUDENT) {
                return TECHNICAL_LIMIT_STUDENT;
            }
            if (authorRole == AppRole.TEACHER || authorRole == AppRole.POSTGRADUATE) {
                return TECHNICAL_LIMIT_TEACHER;
            }
            throw new ApiForbiddenException("Author role is not allowed to submit technical review");
        }

        if ("SUBJECTIVE".equals(dimension)) {
            if (authorRole != AppRole.STUDENT && authorRole != AppRole.TEACHER && authorRole != AppRole.POSTGRADUATE) {
                throw new ApiForbiddenException("Author role is not allowed to submit subjective review");
            }
            if (!isSubjectiveCategoryAllowed(authorRole, category.code())) {
                throw new ApiForbiddenException("Author role is not allowed to review this subjective category");
            }
            return SUBJECTIVE_LIMIT_ALL;
        }

        throw new ApiForbiddenException("Unsupported category dimension: " + category.dimension());
    }

    private void validateDeltaWithinLimit(Float delta, float maxAbsDelta) {
        if (delta == null) {
            throw new ApiBadRequestException("Delta is required");
        }
        if (Math.abs(delta) > maxAbsDelta) {
            throw new ApiForbiddenException("Delta exceeds allowed limit. Max abs delta is " + maxAbsDelta);
        }
    }

    private boolean isSubjectiveCategoryAllowed(AppRole authorRole, String categoryCode) {
        String normalizedCode = normalizeToken(categoryCode);
        if (authorRole == AppRole.STUDENT) {
            return CategoryCatalog.STUDENT_SUBJECTIVE_ALLOWED_CODES.contains(normalizedCode);
        }
        if (authorRole == AppRole.TEACHER || authorRole == AppRole.POSTGRADUATE) {
            return CategoryCatalog.TEACHER_SUBJECTIVE_ALLOWED_CODES.contains(normalizedCode);
        }
        return false;
    }

    private boolean isSubjectiveCategory(CategoryMeta category) {
        return "SUBJECTIVE".equals(normalizeToken(category.dimension()));
    }

    private void ensureNoExistingReview(Long projectId, Long authorUserId, Long targetUserId, Long categoryId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM reviews
                        WHERE project_id = ?
                          AND author_user_id = ?
                          AND target_user_id = ?
                          AND category_id = ?
                        """,
                Integer.class,
                projectId,
                authorUserId,
                targetUserId,
                categoryId
        );
        if (count != null && count > 0) {
            throw new ApiBadRequestException("Review for this category already exists. Use update endpoint.");
        }
    }

    private void validateSubjectiveBudgetForCreate(Long projectId, Long authorUserId, Long targetUserId, Float delta) {
        float remainingBudget = remainingSubjectiveBudget(projectId, authorUserId, targetUserId, null);
        if (Math.abs(delta) > remainingBudget + BUDGET_EPSILON) {
            throw new ApiForbiddenException(
                    "Subjective budget exceeded. Remaining subjective budget is " + remainingBudget
            );
        }
    }

    private void validateSubjectiveBudgetForUpdate(
            Long projectId,
            Long authorUserId,
            Long targetUserId,
            Long reviewId,
            Float delta
    ) {
        float remainingWithoutCurrent = remainingSubjectiveBudget(projectId, authorUserId, targetUserId, reviewId);
        if (Math.abs(delta) > remainingWithoutCurrent + BUDGET_EPSILON) {
            throw new ApiForbiddenException(
                    "Subjective budget exceeded. Remaining subjective budget is " + remainingWithoutCurrent
            );
        }
    }

    private float remainingSubjectiveBudget(
            Long projectId,
            Long authorUserId,
            Long targetUserId,
            Long excludeReviewId
    ) {
        Double used = excludeReviewId == null
                ? jdbcTemplate.queryForObject(
                """
                        SELECT COALESCE(SUM(ABS(r.delta)), 0)
                        FROM reviews r
                        JOIN categories c ON c.id = r.category_id
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE r.project_id = ?
                          AND r.author_user_id = ?
                          AND r.target_user_id = ?
                          AND ct.dimension = 'SUBJECTIVE'
                        """,
                Double.class,
                projectId,
                authorUserId,
                targetUserId
        )
                : jdbcTemplate.queryForObject(
                """
                        SELECT COALESCE(SUM(ABS(r.delta)), 0)
                        FROM reviews r
                        JOIN categories c ON c.id = r.category_id
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE r.project_id = ?
                          AND r.author_user_id = ?
                          AND r.target_user_id = ?
                          AND ct.dimension = 'SUBJECTIVE'
                          AND r.id <> ?
                        """,
                Double.class,
                projectId,
                authorUserId,
                targetUserId,
                excludeReviewId
        );

        float usedSafe = used == null ? 0F : used.floatValue();
        float remaining = SUBJECTIVE_LIMIT_ALL - usedSafe;
        return Math.max(0F, remaining);
    }

    private Set<Long> findAlreadyReviewedCategoryIds(Long projectId, Long authorUserId, Long targetUserId) {
        List<Long> ids = jdbcTemplate.queryForList(
                """
                        SELECT category_id
                        FROM reviews
                        WHERE project_id = ?
                          AND author_user_id = ?
                          AND target_user_id = ?
                        """,
                Long.class,
                projectId,
                authorUserId,
                targetUserId
        );
        return new HashSet<>(ids);
    }

    private String normalizeToken(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
                .toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
    }

    private String asText(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private AppUser findUser(Long userId, String errorMessage) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiBadRequestException(errorMessage));
    }

    private ReviewResponse toResponse(ReviewEntity review) {
        return new ReviewResponse(
                review.getId(),
                review.getProjectId(),
                review.getAuthorUserId(),
                review.getTargetUserId(),
                review.getCategoryId(),
                review.getDelta(),
                review.getComment()
        );
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record CategoryMeta(Long id, String code, String name, String dimension) {
    }
}
