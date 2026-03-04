package com.max.pract.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public class CreateProjectRequest {

    @NotBlank
    @Size(max = 255)
    private String title;

    @Size(max = 4000)
    private String description;

    private LocalDateTime feedbackDeadlineAt;

    private List<Long> studentIds = List.of();

    private List<Long> teacherIds = List.of();

    private List<String> studentCodes = List.of();

    private List<String> teacherCodes = List.of();

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDateTime getFeedbackDeadlineAt() {
        return feedbackDeadlineAt;
    }

    public void setFeedbackDeadlineAt(LocalDateTime feedbackDeadlineAt) {
        this.feedbackDeadlineAt = feedbackDeadlineAt;
    }

    public List<Long> getStudentIds() {
        return studentIds == null ? List.of() : studentIds;
    }

    public void setStudentIds(List<Long> studentIds) {
        this.studentIds = studentIds;
    }

    public List<Long> getTeacherIds() {
        return teacherIds == null ? List.of() : teacherIds;
    }

    public void setTeacherIds(List<Long> teacherIds) {
        this.teacherIds = teacherIds;
    }

    public List<String> getStudentCodes() {
        return studentCodes == null ? List.of() : studentCodes;
    }

    public void setStudentCodes(List<String> studentCodes) {
        this.studentCodes = studentCodes;
    }

    public List<String> getTeacherCodes() {
        return teacherCodes == null ? List.of() : teacherCodes;
    }

    public void setTeacherCodes(List<String> teacherCodes) {
        this.teacherCodes = teacherCodes;
    }
}
