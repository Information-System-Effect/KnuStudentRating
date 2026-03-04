package com.max.pract.repo;

import com.max.pract.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Collection;

@Repository
public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmail(String email);
    Optional<AppUser> findByCode(String code);
    boolean existsByEmailIgnoreCase(String email);
    List<AppUser> findAllByRoleOrderByFullNameAsc(com.max.pract.auth.AppRole role);
    List<AppUser> findAllByRoleInOrderByFullNameAsc(Collection<com.max.pract.auth.AppRole> roles);
}
