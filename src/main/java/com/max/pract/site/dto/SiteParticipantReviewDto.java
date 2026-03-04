package com.max.pract.site.dto;

import java.time.Instant;

public record SiteParticipantReviewDto(
        Long reviewId,
        Long projectId,
        String projectTitle,
        String authorCode,
        String targetCode,
        String categoryCode,
        Float delta,
        String comment,
        Instant createdAt
) {
}
