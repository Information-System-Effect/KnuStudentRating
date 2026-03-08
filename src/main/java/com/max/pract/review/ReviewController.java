package com.max.pract.review;

import com.max.pract.ApiResponse;
import com.max.pract.review.dto.CreateReviewRequest;
import com.max.pract.review.dto.UpdateReviewRequest;
import com.max.pract.security.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping("/api/projects/{projectId}/reviews")
    public ApiResponse createReview(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long projectId,
            @Valid @RequestBody CreateReviewRequest request
    ) {
        return new ApiResponse("success", reviewService.create(principal.getUserId(), projectId, request));
    }

    @PutMapping("/api/projects/{projectId}/reviews/{reviewId}")
    public ApiResponse updateReview(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long projectId,
            @PathVariable Long reviewId,
            @Valid @RequestBody UpdateReviewRequest request
    ) {
        return new ApiResponse("success", reviewService.update(principal.getUserId(), projectId, reviewId, request));
    }

    @GetMapping("/api/projects/{projectId}/reviews/options")
    public ApiResponse listReviewOptions(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long projectId,
            @RequestParam Long targetUserId
    ) {
        return new ApiResponse(
                "success",
                reviewService.listReviewOptions(principal.getUserId(), projectId, targetUserId)
        );
    }

    @GetMapping("/api/projects/{projectId}/reviews/mine")
    public ApiResponse listMyReviews(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long projectId,
            @RequestParam Long targetUserId
    ) {
        return new ApiResponse(
                "success",
                reviewService.listAuthoredReviews(principal.getUserId(), projectId, targetUserId)
        );
    }
}
