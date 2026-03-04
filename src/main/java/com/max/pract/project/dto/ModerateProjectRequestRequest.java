package com.max.pract.project.dto;

import jakarta.validation.constraints.Size;

public class ModerateProjectRequestRequest {

    @Size(max = 2000)
    private String comment;

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
