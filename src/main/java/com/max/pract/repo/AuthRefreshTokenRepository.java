package com.max.pract.repo;

import com.max.pract.entity.AuthRefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface AuthRefreshTokenRepository extends JpaRepository<AuthRefreshToken, Long> {

    Optional<AuthRefreshToken> findByTokenJti(String tokenJti);

    @Modifying
    @Transactional
    @Query("update AuthRefreshToken t set t.revokedAt = :revokedAt, t.revokedReason = :reason " +
            "where t.userId = :userId and t.revokedAt is null and t.expiresAt > :now")
    int revokeAllActiveByUserId(
            @Param("userId") Long userId,
            @Param("revokedAt") Instant revokedAt,
            @Param("reason") String reason,
            @Param("now") Instant now
    );
}
