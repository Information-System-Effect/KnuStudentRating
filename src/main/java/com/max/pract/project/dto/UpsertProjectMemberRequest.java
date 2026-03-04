package com.max.pract.project.dto;

import jakarta.validation.constraints.NotNull;

public class UpsertProjectMemberRequest {

    @NotNull
    private Long userId;

    @NotNull
    private String memberRole;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getMemberRole() {
        return memberRole;
    }

    public void setMemberRole(String memberRole) {
        this.memberRole = memberRole;
    }
}
