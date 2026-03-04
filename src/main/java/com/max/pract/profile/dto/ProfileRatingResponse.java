package com.max.pract.profile.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProfileRatingResponse(
        Long userId,
        String userCode,
        BigDecimal averageScore,
        BigDecimal totalScore,
        int categoriesCount,
        int verifiedCategories,
        int unverifiedCategories,
        List<ProfileCategoryScoreDto> categoryScores
) {
}
