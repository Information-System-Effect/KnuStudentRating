package com.max.pract.site.dto;

public record SiteCategoryDto(
        Long categoryId,
        String categoryCode,
        String categoryName,
        String audience,
        String dimension,
        boolean selfDeclaredAllowed
) {
}
