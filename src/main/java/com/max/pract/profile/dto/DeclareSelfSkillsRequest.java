package com.max.pract.profile.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public class DeclareSelfSkillsRequest {

    @NotEmpty
    private List<@Valid SelfDeclaredSkillRequest> skills;

    public List<SelfDeclaredSkillRequest> getSkills() {
        return skills;
    }

    public void setSkills(List<SelfDeclaredSkillRequest> skills) {
        this.skills = skills;
    }
}
