package com.max.pract.site.dto;

public record SiteParticipantCardDto(
        Long userId,
        String code,
        String role,
        String fullName,
        String institution,
        String groupName,
        String about,
        String photoUrl
) {
}
