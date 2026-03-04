package com.max.pract.admin.dto;

public record AdminUserDto(
        Long userId,
        String code,
        String email,
        String role,
        String fullName,
        String institution,
        String groupName,
        String about,
        String photoUrl
) {
}
