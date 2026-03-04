package com.max.pract.project.dto;

import java.time.LocalDateTime;

public class UpdateProjectLifecycleRequest {

    private String status;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private LocalDateTime feedbackDeadlineAt;
    private String title;
    private String description;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getStartAt() {
        return startAt;
    }

    public void setStartAt(LocalDateTime startAt) {
        this.startAt = startAt;
    }

    public LocalDateTime getEndAt() {
        return endAt;
    }

    public void setEndAt(LocalDateTime endAt) {
        this.endAt = endAt;
    }

    public LocalDateTime getFeedbackDeadlineAt() {
        return feedbackDeadlineAt;
    }

    public void setFeedbackDeadlineAt(LocalDateTime feedbackDeadlineAt) {
        this.feedbackDeadlineAt = feedbackDeadlineAt;
    }

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
}
