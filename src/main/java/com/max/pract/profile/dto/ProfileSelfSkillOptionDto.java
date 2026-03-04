package com.max.pract.profile.dto;

public record ProfileSelfSkillOptionDto(
        Long categoryId,
        String categoryCode,
        String categoryName,
        String audience,
        String dimension,
        Float currentScore,
        boolean verified
) {
}
