package com.max.pract.entity;

import com.max.pract.project.ProjectRequestStatus;
import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "project_requests")
public class ProjectRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "author_user_id", nullable = false)
    private Long authorUserId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ProjectRequestStatus status;

    @Column(name = "admin_comment")
    private String adminComment;

    @Column(name = "reviewed_by_user_id")
    private Long reviewedByUserId;

    @Column(name = "created_at", nullable = false, updatable = false, insertable = false)
    private Instant createdAt;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    public Long getId() {
        return id;
    }

    public Long getAuthorUserId() {
        return authorUserId;
    }

    public void setAuthorUserId(Long authorUserId) {
        this.authorUserId = authorUserId;
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

    public ProjectRequestStatus getStatus() {
        return status;
    }

    public void setStatus(ProjectRequestStatus status) {
        this.status = status;
    }

    public String getAdminComment() {
        return adminComment;
    }

    public void setAdminComment(String adminComment) {
        this.adminComment = adminComment;
    }

    public Long getReviewedByUserId() {
        return reviewedByUserId;
    }

    public void setReviewedByUserId(Long reviewedByUserId) {
        this.reviewedByUserId = reviewedByUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }
}
