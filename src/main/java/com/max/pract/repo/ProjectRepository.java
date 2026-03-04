package com.max.pract.repo;

import com.max.pract.entity.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> {
    boolean existsByCreatedFromRequestId(Long createdFromRequestId);
    Optional<ProjectEntity> findByCreatedFromRequestId(Long createdFromRequestId);
    List<ProjectEntity> findAllByOrderByCreatedAtDesc();
}
