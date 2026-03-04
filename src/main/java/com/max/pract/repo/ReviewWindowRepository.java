package com.max.pract.repo;

import com.max.pract.entity.ReviewWindowEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Repository
public interface ReviewWindowRepository extends JpaRepository<ReviewWindowEntity, Long> {

    @Modifying
    @Transactional
    @Query("update ReviewWindowEntity w set w.closed = true where w.closed = false and w.closeAt <= :now")
    int closeExpiredWindows(@Param("now") LocalDateTime now);
}
