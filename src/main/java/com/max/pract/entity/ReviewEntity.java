package com.max.pract.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "reviews")
public class ReviewEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "author_user_id", nullable = false)
    private Long authorUserId;

    @Column(name = "target_user_id", nullable = false)
    private Long targetUserId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "delta", nullable = false)
    private Float delta;

    @Column(name = "comment")
    private String comment;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Long getAuthorUserId() {
        return authorUserId;
    }

    public void setAuthorUserId(Long authorUserId) {
        this.authorUserId = authorUserId;
    }

    public Long getTargetUserId() {
        return targetUserId;
    }

    public void setTargetUserId(Long targetUserId) {
        this.targetUserId = targetUserId;
    }

    public Long getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Long categoryId) {
        this.categoryId = categoryId;
    }

    public Float getDelta() {
        return delta;
    }

    public void setDelta(Float delta) {
        this.delta = delta;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
