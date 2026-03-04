package com.max.pract.site.dto;

public record SiteHomeResponse(
        long completedProjects,
        long pendingProjectRequests,
        long studentsCount,
        long teachersCount,
        String contactEmail,
        String contactTelegram
) {
}
