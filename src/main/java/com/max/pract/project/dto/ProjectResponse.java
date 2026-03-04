package com.max.pract.project.dto;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

public record ProjectResponse(
        Long id,
        String title,
        String description,
        String status,
        Long createdFromRequestId,
        LocalDateTime startAt,
        LocalDateTime endAt,
        LocalDateTime feedbackDeadlineAt,
        Instant createdAt,
        List<ProjectMemberDto> members
) {
}
