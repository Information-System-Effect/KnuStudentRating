package com.max.pract.review;

import com.max.pract.entity.AppUser;
import com.max.pract.entity.ProjectEntity;
import com.max.pract.entity.ReviewEntity;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.profile.CategoryScoreService;
import com.max.pract.auth.AppRole;
import com.max.pract.project.ProjectService;
import com.max.pract.project.ReviewWindowService;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.repo.ProjectRepository;
import com.max.pract.repo.ReviewRepository;
import com.max.pract.review.dto.AuthoredReviewDto;
import com.max.pract.review.dto.CreateReviewRequest;
import com.max.pract.review.dto.ReviewCategoryOptionDto;
import com.max.pract.review.dto.ReviewResponse;
import com.max.pract.review.dto.UpdateReviewRequest;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class ReviewService {

    private static final float REVIEW_DELTA_LIMIT = 5F;

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

        CategoryMeta category = loadCategoryMetaForTargetUser(target.getId(), request.getCategoryId());
        validateDeltaWithinLimit(request.getDelta(), REVIEW_DELTA_LIMIT);
        ensureNoExistingReview(projectId, authorUserId, request.getTargetUserId(), request.getCategoryId());

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
        loadCategoryMetaForTargetUser(target.getId(), review.getCategoryId());
        validateDeltaWithinLimit(request.getDelta(), REVIEW_DELTA_LIMIT);

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

        Set<Long> reviewedCategoryIds = findAlreadyReviewedCategoryIds(projectId, authorUserId, targetUserId);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                        SELECT DISTINCT c.id AS category_id,
                               c.code AS category_code,
                               c.name AS category_name,
                               ct.dimension AS category_dimension
                        FROM category_scores cs
                        JOIN categories c ON c.id = cs.category_id
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE cs.user_id = ?
                        ORDER BY c.code
                        """,
                targetUserId
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

            options.add(new ReviewCategoryOptionDto(
                    category.id(),
                    category.code(),
                    category.name(),
                    category.dimension(),
                    REVIEW_DELTA_LIMIT,
                    null
            ));
        }
        return options;
    }

    @Transactional(readOnly = true)
    public List<AuthoredReviewDto> listAuthoredReviews(Long authorUserId, Long projectId, Long targetUserId) {
        AppUser author = findUser(authorUserId, "Author user not found");
        AppUser target = findUser(targetUserId, "Target user not found");

        validateReviewWindowAndMembership(authorUserId, targetUserId, author.getRole(), target.getRole(), projectId);

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                        SELECT r.id AS review_id,
                               r.project_id,
                               r.author_user_id,
                               r.target_user_id,
                               r.category_id,
                               r.delta,
                               r.comment,
                               r.created_at,
                               c.code AS category_code,
                               c.name AS category_name,
                               ct.dimension AS category_dimension
                        FROM reviews r
                        JOIN categories c ON c.id = r.category_id
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE r.project_id = ?
                          AND r.author_user_id = ?
                          AND r.target_user_id = ?
                        ORDER BY r.created_at DESC, r.id DESC
                        """,
                projectId,
                authorUserId,
                targetUserId
        );

        List<AuthoredReviewDto> reviews = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long reviewId = ((Number) row.get("review_id")).longValue();
            Long categoryId = ((Number) row.get("category_id")).longValue();
            CategoryMeta category = new CategoryMeta(
                    categoryId,
                    asText(row.get("category_code")),
                    asText(row.get("category_name")),
                    normalizeToken(asText(row.get("category_dimension")))
            );

            reviews.add(new AuthoredReviewDto(
                    reviewId,
                    ((Number) row.get("project_id")).longValue(),
                    ((Number) row.get("author_user_id")).longValue(),
                    ((Number) row.get("target_user_id")).longValue(),
                    categoryId,
                    category.code(),
                    category.name(),
                    category.dimension(),
                    toFloat(row.get("delta")),
                    trimToNull(asText(row.get("comment"))),
                    toInstant(row.get("created_at")),
                    REVIEW_DELTA_LIMIT,
                    null
            ));
        }
        return reviews;
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

    private CategoryMeta loadCategoryMetaForTargetUser(Long targetUserId, Long categoryId) {
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap(
                    """
                            SELECT DISTINCT c.id AS category_id,
                                   c.code AS category_code,
                                   c.name AS category_name,
                                   ct.dimension AS category_dimension
                            FROM category_scores cs
                            JOIN categories c ON c.id = cs.category_id
                            JOIN category_types ct ON ct.id = c.category_type_id
                            WHERE cs.user_id = ?
                              AND c.id = ?
                            """,
                    targetUserId,
                    categoryId
            );
            return new CategoryMeta(
                    ((Number) row.get("category_id")).longValue(),
                    asText(row.get("category_code")),
                    asText(row.get("category_name")),
                    normalizeToken(asText(row.get("category_dimension")))
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ApiForbiddenException("Category is not available in target profile");
        }
    }

    private void assertReviewDeadlineOpen(Long projectId) {
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiBadRequestException("Project not found"));

        reviewWindowService.assertWindowOpen(project);
    }

    private void validateAuthorTargetRoles(AppRole authorRole, AppRole targetRole) {
        boolean allowedAuthorRole = authorRole == AppRole.STUDENT
                || authorRole == AppRole.TEACHER;
        if (!allowedAuthorRole) {
            throw new ApiForbiddenException("Author role is not allowed to submit reviews");
        }

        boolean allowedTargetRole = targetRole == AppRole.STUDENT
                || targetRole == AppRole.TEACHER
                || targetRole == AppRole.ADMIN;
        if (!allowedTargetRole) {
            throw new ApiForbiddenException("Target role is not reviewable");
        }
    }

    private void validateDeltaWithinLimit(Float delta, float maxAbsDelta) {
        if (delta == null) {
            throw new ApiBadRequestException("Delta is required");
        }
        if (Math.abs(delta) > maxAbsDelta) {
            throw new ApiForbiddenException("Delta exceeds allowed limit. Max abs delta is " + maxAbsDelta);
        }
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

    private Float toFloat(Object value) {
        if (value instanceof Float floatValue) {
            return floatValue;
        }
        if (value instanceof Number number) {
            return number.floatValue();
        }
        if (value == null) {
            return null;
        }
        return Float.parseFloat(String.valueOf(value));
    }

    private Instant toInstant(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        return null;
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
