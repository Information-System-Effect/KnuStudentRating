package com.max.pract.review.dto;

public record ReviewCategoryOptionDto(
        Long categoryId,
        String categoryCode,
        String categoryName,
        String dimension,
        Float maxAbsDelta,
        Float remainingSubjectiveBudget
) {
}
