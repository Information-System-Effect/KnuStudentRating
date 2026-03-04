package com.max.pract.project.dto;

import java.time.Instant;
import java.time.LocalDateTime;

public record ProjectRequestResponse(
        Long id,
        Long authorUserId,
        String title,
        String description,
        String status,
        Long createdProjectId,
        String adminComment,
        Long reviewedByUserId,
        Instant createdAt,
        LocalDateTime reviewedAt
) {
}
