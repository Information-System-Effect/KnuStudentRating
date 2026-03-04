package com.max.pract.repo;

import com.max.pract.entity.ProjectRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRequestRepository extends JpaRepository<ProjectRequestEntity, Long> {
    List<ProjectRequestEntity> findAllByAuthorUserIdOrderByCreatedAtDesc(Long authorUserId);
    List<ProjectRequestEntity> findAllByOrderByCreatedAtDesc();
}
