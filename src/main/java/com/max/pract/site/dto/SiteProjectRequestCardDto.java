package com.max.pract.site.dto;

import java.time.Instant;

public record SiteProjectRequestCardDto(
        Long requestId,
        Long authorUserId,
        String title,
        String description,
        String status,
        Instant createdAt
) {
}
