package com.max.pract.site.dto;

import com.max.pract.profile.dto.ProfileCategoryScoreDto;

import java.math.BigDecimal;
import java.util.List;

public record SiteParticipantRatingResponse(
        Long userId,
        String code,
        String role,
        String fullName,
        String institution,
        String groupName,
        String about,
        String photoUrl,
        BigDecimal averageScore,
        BigDecimal totalScore,
        int categoriesCount,
        int verifiedCategories,
        int unverifiedCategories,
        List<ProfileCategoryScoreDto> categoryScores
) {
}
