package com.max.pract.entity;

import com.max.pract.project.ProjectMemberRole;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "project_members")
public class ProjectMemberEntity {

    @EmbeddedId
    private ProjectMemberId id;

    @Enumerated(EnumType.STRING)
    @Column(name = "member_role", nullable = false, length = 16)
    private ProjectMemberRole memberRole;

    @Column(name = "joined_at", nullable = false, insertable = false, updatable = false)
    private Instant joinedAt;

    public ProjectMemberId getId() {
        return id;
    }

    public void setId(ProjectMemberId id) {
        this.id = id;
    }

    public ProjectMemberRole getMemberRole() {
        return memberRole;
    }

    public void setMemberRole(ProjectMemberRole memberRole) {
        this.memberRole = memberRole;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
