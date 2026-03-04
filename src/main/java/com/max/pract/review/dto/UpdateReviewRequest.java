package com.max.pract.review.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class UpdateReviewRequest {

    @NotNull
    private Float delta;

    @Size(max = 2000)
    private String comment;

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
