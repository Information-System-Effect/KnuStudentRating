package com.max.pract.repo;

import com.max.pract.entity.ProjectMemberEntity;
import com.max.pract.entity.ProjectMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMemberEntity, ProjectMemberId> {
    List<ProjectMemberEntity> findAllByIdProjectId(Long projectId);
    boolean existsByIdProjectIdAndIdUserId(Long projectId, Long userId);
}
