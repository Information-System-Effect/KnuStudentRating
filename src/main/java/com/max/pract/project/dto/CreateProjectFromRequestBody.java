package com.max.pract.project.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;

public class CreateProjectFromRequestBody {

    private String title;
    private String description;
    private LocalDateTime startAt;

    @NotNull
    private List<Long> studentIds;

    @NotNull
    private List<Long> teacherIds;

    private List<String> studentCodes;

    private List<String> teacherCodes;

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

    public LocalDateTime getStartAt() {
        return startAt;
    }

    public void setStartAt(LocalDateTime startAt) {
        this.startAt = startAt;
    }

    public List<Long> getStudentIds() {
        return studentIds;
    }

    public void setStudentIds(List<Long> studentIds) {
        this.studentIds = studentIds;
    }

    public List<Long> getTeacherIds() {
        return teacherIds;
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
