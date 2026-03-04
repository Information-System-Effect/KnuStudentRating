package com.max.pract.profile;

import com.max.pract.auth.AppRole;
import com.max.pract.contract.ChangeMode;
import com.max.pract.entity.AppUser;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.repo.AppUserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class CategoryScoreService {

    private static final BigDecimal MIN_SCORE = BigDecimal.ZERO;
    private static final BigDecimal MAX_SCORE = BigDecimal.valueOf(100);

    private final JdbcTemplate jdbcTemplate;
    private final AppUserRepository appUserRepository;

    public CategoryScoreService(JdbcTemplate jdbcTemplate, AppUserRepository appUserRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.appUserRepository = appUserRepository;
    }

    @Transactional
    public void declareSelfSkill(Long userId, Long categoryId, Float score) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiBadRequestException("User not found"));

        validateSelfDeclaredCategory(user.getRole(), categoryId);
        ensureScoreNotDeclaredYet(userId, categoryId);

        BigDecimal normalizedScore = toScore(score);
        jdbcTemplate.update(
                """
                        INSERT INTO category_scores(user_id, category_id, score, is_verified)
                        VALUES (?, ?, ?, FALSE)
                        """,
                userId,
                categoryId,
                normalizedScore
        );
        appendScoreEvent(userId, categoryId, "SELF_DECLARED", null, normalizedScore, normalizedScore, false);
    }

    @Transactional
    public void upsertSelfDeclaredSkill(Long userId, Long categoryId, ChangeMode mode, Float value) {
        if (mode == null) {
            throw new ApiBadRequestException("Change mode is required");
        }
        if (value == null) {
            throw new ApiBadRequestException("Score value is required");
        }

        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiBadRequestException("User not found"));
        validateSelfDeclaredCategory(user.getRole(), categoryId);

        CategoryScoreState existingState = findCategoryScoreState(userId, categoryId);
        BigDecimal currentScore = existingState == null
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : existingState.score();

        if (existingState != null && existingState.verified()) {
            throw new ApiForbiddenException("Verified score cannot be changed via self-declared gateway operation");
        }

        BigDecimal resultScore = mode == ChangeMode.SET
                ? toScore(value)
                : clamp(currentScore.add(toDelta(value)));
        BigDecimal delta = resultScore.subtract(currentScore).setScale(2, RoundingMode.HALF_UP);

        if (existingState == null) {
            jdbcTemplate.update(
                    """
                            INSERT INTO category_scores(user_id, category_id, score, is_verified)
                            VALUES (?, ?, ?, FALSE)
                            """,
                    userId,
                    categoryId,
                    resultScore
            );
        } else {
            jdbcTemplate.update(
                    """
                            UPDATE category_scores
                            SET score = ?, is_verified = FALSE
                            WHERE user_id = ? AND category_id = ?
                            """,
                    resultScore,
                    userId,
                    categoryId
            );
        }

        appendScoreEvent(userId, categoryId, "SELF_DECLARED", null, delta, resultScore, false);
    }

    @Transactional
    public void applyProjectReviewDelta(Long userId, Long categoryId, Long reviewId, Float delta) {
        ensureCategoryScoreExists(userId, categoryId);
        BigDecimal currentScore = getCurrentScore(userId, categoryId);
        BigDecimal normalizedDelta = toDelta(delta);
        BigDecimal resultScore = clamp(currentScore.add(normalizedDelta));

        jdbcTemplate.update(
                """
                        UPDATE category_scores
                        SET score = ?, is_verified = TRUE
                        WHERE user_id = ? AND category_id = ?
                        """,
                resultScore,
                userId,
                categoryId
        );
        appendScoreEvent(userId, categoryId, "PROJECT_REVIEW", reviewId, normalizedDelta, resultScore, true);
    }

    @Transactional
    public void markSelfDeclaredSkillVerifiedByReview(Long userId, Long categoryId) {
        jdbcTemplate.update(
                """
                        UPDATE category_scores cs
                        JOIN categories c ON c.id = cs.category_id
                        JOIN category_types ct ON ct.id = c.category_type_id
                        SET cs.is_verified = TRUE
                        WHERE cs.user_id = ?
                          AND cs.category_id = ?
                          AND cs.is_verified = FALSE
                          AND c.self_declared_allowed = TRUE
                          AND ct.dimension = 'TECHNICAL'
                        """,
                userId,
                categoryId
        );
    }

    @Transactional
    public void deleteSelfDeclaredSkill(Long userId, Long categoryId) {
        BigDecimal currentScore = jdbcTemplate.query(
                "SELECT score FROM category_scores WHERE user_id = ? AND category_id = ?",
                rs -> rs.next() ? rs.getBigDecimal(1) : null,
                userId,
                categoryId
        );
        if (currentScore == null) {
            throw new ApiBadRequestException("Category score does not exist");
        }

        int deleted = jdbcTemplate.update(
                """
                        DELETE cs
                        FROM category_scores cs
                        JOIN categories c ON c.id = cs.category_id
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE cs.user_id = ?
                          AND cs.category_id = ?
                          AND cs.is_verified = FALSE
                          AND c.self_declared_allowed = TRUE
                          AND ct.dimension = 'TECHNICAL'
                        """,
                userId,
                categoryId
        );
        if (deleted == 0) {
            throw new ApiForbiddenException("Only unverified self-declared technical scores can be deleted");
        }
        appendScoreEvent(
                userId,
                categoryId,
                "SELF_DECLARED",
                null,
                currentScore.negate(),
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP),
                false
        );
    }

    @Transactional(readOnly = true)
    public RatingSummary getRatingSummary(Long userId) {
        RatingSummary summary = jdbcTemplate.queryForObject(
                """
                        SELECT COALESCE(AVG(cs.score), 0) AS average_score,
                               COALESCE(SUM(cs.score), 0) AS total_score,
                               COUNT(*) AS categories_count,
                               SUM(CASE WHEN cs.is_verified THEN 1 ELSE 0 END) AS verified_categories,
                               SUM(CASE WHEN cs.is_verified THEN 0 ELSE 1 END) AS unverified_categories
                        FROM category_scores cs
                        WHERE cs.user_id = ?
                        """,
                (rs, rowNum) -> new RatingSummary(
                        rs.getBigDecimal("average_score").setScale(2, RoundingMode.HALF_UP),
                        rs.getBigDecimal("total_score").setScale(2, RoundingMode.HALF_UP),
                        rs.getInt("categories_count"),
                        rs.getInt("verified_categories"),
                        rs.getInt("unverified_categories")
                ),
                userId
        );
        return summary == null
                ? new RatingSummary(BigDecimal.ZERO, BigDecimal.ZERO, 0, 0, 0)
                : summary;
    }

    private void validateSelfDeclaredCategory(AppRole userRole, Long categoryId) {
        String expectedAudience = mapRoleToAudience(userRole);
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(1)
                        FROM categories c
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE c.id = ?
                          AND c.self_declared_allowed = TRUE
                          AND ct.dimension = 'TECHNICAL'
                          AND ct.audience = ?
                        """,
                Integer.class,
                categoryId,
                expectedAudience
        );
        if (count == null || count == 0) {
            throw new ApiForbiddenException("Category is not available for self-declared technical skill");
        }
    }

    private void ensureScoreNotDeclaredYet(Long userId, Long categoryId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM category_scores WHERE user_id = ? AND category_id = ?",
                Integer.class,
                userId,
                categoryId
        );
        if (count != null && count > 0) {
            throw new ApiBadRequestException("Self-declared value already exists for this category");
        }
    }

    private CategoryScoreState findCategoryScoreState(Long userId, Long categoryId) {
        return jdbcTemplate.query(
                "SELECT score, is_verified FROM category_scores WHERE user_id = ? AND category_id = ?",
                rs -> rs.next()
                        ? new CategoryScoreState(
                        rs.getBigDecimal("score").setScale(2, RoundingMode.HALF_UP),
                        rs.getBoolean("is_verified")
                )
                        : null,
                userId,
                categoryId
        );
    }

    private String mapRoleToAudience(AppRole role) {
        if (role == AppRole.STUDENT) {
            return "STUDENT";
        }
        if (role == AppRole.TEACHER) {
            return "TEACHER";
        }
        if (role == AppRole.POSTGRADUATE) {
            return "TEACHER";
        }
        throw new ApiForbiddenException("Role is not allowed to self-declare technical skills");
    }

    private void ensureCategoryScoreExists(Long userId, Long categoryId) {
        jdbcTemplate.update(
                """
                        INSERT INTO category_scores(user_id, category_id, score, is_verified)
                        VALUES (?, ?, 0, FALSE)
                        ON DUPLICATE KEY UPDATE user_id = user_id
                        """,
                userId,
                categoryId
        );
    }

    private BigDecimal getCurrentScore(Long userId, Long categoryId) {
        BigDecimal score = jdbcTemplate.queryForObject(
                "SELECT score FROM category_scores WHERE user_id = ? AND category_id = ?",
                BigDecimal.class,
                userId,
                categoryId
        );
        return score == null ? BigDecimal.ZERO : score.setScale(2, RoundingMode.HALF_UP);
    }

    private void appendScoreEvent(
            Long userId,
            Long categoryId,
            String sourceType,
            Long sourceRefId,
            BigDecimal delta,
            BigDecimal resultScore,
            boolean verifiedAfterEvent
    ) {
        jdbcTemplate.update(
                """
                        INSERT INTO score_events(
                            user_id, category_id, source_type, source_ref_id, delta, result_score, is_verified_after_event
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                userId,
                categoryId,
                sourceType,
                sourceRefId,
                delta,
                resultScore,
                verifiedAfterEvent
        );
    }

    private BigDecimal toScore(Float value) {
        if (value == null) {
            throw new ApiBadRequestException("Score value is required");
        }
        BigDecimal score = BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
        if (score.compareTo(MIN_SCORE) < 0 || score.compareTo(MAX_SCORE) > 0) {
            throw new ApiBadRequestException("Score must be between 0 and 100");
        }
        return score;
    }

    private BigDecimal toDelta(Float value) {
        if (value == null) {
            throw new ApiBadRequestException("Delta value is required");
        }
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal clamp(BigDecimal value) {
        if (value.compareTo(MIN_SCORE) < 0) {
            return MIN_SCORE;
        }
        if (value.compareTo(MAX_SCORE) > 0) {
            return MAX_SCORE;
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    public record RatingSummary(
            BigDecimal averageScore,
            BigDecimal totalScore,
            int categoriesCount,
            int verifiedCategories,
            int unverifiedCategories
    ) {
    }

    private record CategoryScoreState(BigDecimal score, boolean verified) {
    }
}
