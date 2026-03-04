package com.max.pract.site.dto;

public record SiteProjectMemberDto(
        Long userId,
        String userCode,
        String fullName,
        String userRole,
        String memberRole
) {
}
