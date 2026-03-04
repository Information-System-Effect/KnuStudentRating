package com.max.pract.project.dto;

public record ProjectMemberDto(
        Long userId,
        String userCode,
        String fullName,
        String memberRole
) {
}
