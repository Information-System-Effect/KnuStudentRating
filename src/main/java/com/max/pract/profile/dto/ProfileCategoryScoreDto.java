package com.max.pract.profile.dto;

public record ProfileCategoryScoreDto(
        String categoryCode,
        String categoryName,
        String audience,
        String dimension,
        float score,
        boolean verified
) {
}
