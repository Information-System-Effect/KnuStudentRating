package com.max.pract.review.dto;

public record ReviewResponse(
        Long id,
        Long projectId,
        Long authorUserId,
        Long targetUserId,
        Long categoryId,
        Float delta,
        String comment
) {
}
