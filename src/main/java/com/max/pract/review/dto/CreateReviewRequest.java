package com.max.pract.review.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class CreateReviewRequest {

    @NotNull
    private Long targetUserId;

    @NotNull
    private Long categoryId;

    @NotNull
    private Float delta;

    @Size(max = 2000)
    private String comment;

    public Long getTargetUserId() {
        return targetUserId;
    }

    public void setTargetUserId(Long targetUserId) {
        this.targetUserId = targetUserId;
    }

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public Float getDelta() {
        return delta;
    }

    public void setDelta(Float delta) {
        this.delta = delta;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
