package com.max.pract.profile.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public class SelfDeclaredSkillRequest {

    @NotNull
    private Long categoryId;

    @NotNull
    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private Float score;

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public Float getScore() {
        return score;
    }

    public void setScore(Float score) {
        this.score = score;
    }
}
