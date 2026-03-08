package com.max.pract.review.dto;

import java.time.Instant;

public record AuthoredReviewDto(
        Long reviewId,
        Long projectId,
        Long authorUserId,
        Long targetUserId,
        Long categoryId,
        String categoryCode,
        String categoryName,
        String dimension,
        Float delta,
        String comment,
        Instant createdAt,
        Float maxAbsDelta,
        Float remainingSubjectiveBudget
) {
}
