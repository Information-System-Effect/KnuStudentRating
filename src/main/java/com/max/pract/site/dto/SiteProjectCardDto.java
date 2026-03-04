package com.max.pract.site.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SiteProjectCardDto(
        Long projectId,
        String title,
        String description,
        String status,
        LocalDateTime startAt,
        LocalDateTime endAt,
        LocalDateTime feedbackDeadlineAt,
        List<SiteProjectMemberDto> members
) {
}
