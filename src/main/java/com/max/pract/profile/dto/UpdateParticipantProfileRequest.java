package com.max.pract.profile.dto;

import jakarta.validation.constraints.Size;

public class UpdateParticipantProfileRequest {

    @Size(min = 2, max = 255)
    private String fullName;

    @Size(max = 255)
    private String institution;

    @Size(max = 64)
    private String groupName;

    @Size(max = 2000)
    private String about;

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getInstitution() {
        return institution;
    }

    public void setInstitution(String institution) {
        this.institution = institution;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public String getAbout() {
        return about;
    }

    public void setAbout(String about) {
        this.about = about;
    }

}
