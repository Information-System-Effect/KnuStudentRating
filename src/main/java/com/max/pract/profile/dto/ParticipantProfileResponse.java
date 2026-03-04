package com.max.pract.profile.dto;

import java.util.List;

public record ParticipantProfileResponse(
        Long userId,
        String code,
        String role,
        String email,
        String fullName,
        String institution,
        String groupName,
        String about,
        String photoUrl,
        List<ProfileCategoryScoreDto> categoryScores
) {
}
