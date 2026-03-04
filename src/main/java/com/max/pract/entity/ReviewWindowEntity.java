package com.max.pract.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "review_windows")
public class ReviewWindowEntity {

    @Id
    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "open_at", nullable = false)
    private LocalDateTime openAt;

    @Column(name = "close_at", nullable = false)
    private LocalDateTime closeAt;

    @Column(name = "is_closed", nullable = false)
    private Boolean closed;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public LocalDateTime getOpenAt() {
        return openAt;
    }

    public void setOpenAt(LocalDateTime openAt) {
        this.openAt = openAt;
    }

    public LocalDateTime getCloseAt() {
        return closeAt;
    }

    public void setCloseAt(LocalDateTime closeAt) {
        this.closeAt = closeAt;
    }

    public Boolean getClosed() {
        return closed;
    }

    public void setClosed(Boolean closed) {
        this.closed = closed;
    }
}
