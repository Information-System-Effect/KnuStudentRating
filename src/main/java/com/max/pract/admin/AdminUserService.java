package com.max.pract.admin;

import com.max.pract.admin.dto.AdminUserDto;
import com.max.pract.auth.AppRole;
import com.max.pract.entity.AppUser;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.repo.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Service
public class AdminUserService {

    private final AppUserRepository appUserRepository;

    public AdminUserService(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<AdminUserDto> listUsers() {
        return appUserRepository.findAll()
                .stream()
                .sorted((left, right) -> left.getFullName().compareToIgnoreCase(right.getFullName()))
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> listRoles() {
        return Arrays.stream(AppRole.values()).map(Enum::name).toList();
    }

    @Transactional
    public AdminUserDto updateRole(Long userId, String roleRaw) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiBadRequestException("User not found: " + userId));
        AppRole targetRole = parseRole(roleRaw);
        AppRole currentRole = user.getRole();
        if (currentRole == targetRole) {
            return toDto(user);
        }

        if (currentRole == AppRole.ADMIN && targetRole != AppRole.ADMIN) {
            long adminsCount = appUserRepository.findAll()
                    .stream()
                    .filter(candidate -> candidate.getRole() == AppRole.ADMIN)
                    .count();
            if (adminsCount <= 1) {
                throw new ApiBadRequestException("At least one admin must remain in the system");
            }
        }

        user.setRole(targetRole);
        user.setCode(resolveCodeByRole(user.getId(), targetRole, user.getCode()));
        return toDto(appUserRepository.save(user));
    }

    private AppRole parseRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            throw new ApiBadRequestException("Role is required");
        }
        try {
            return AppRole.valueOf(rawRole.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ApiBadRequestException("Unsupported role: " + rawRole);
        }
    }

    private String resolveCodeByRole(Long userId, AppRole role, String currentCode) {
        if (userId == null) {
            throw new ApiBadRequestException("User id is required");
        }
        return switch (role) {
            case STUDENT -> "U" + userId;
            case TEACHER -> "T" + userId;
            case ADMIN -> currentCode == null || currentCode.isBlank() ? "U" + userId : currentCode;
        };
    }

    private AdminUserDto toDto(AppUser user) {
        return new AdminUserDto(
                user.getId(),
                user.getCode(),
                user.getEmail(),
                user.getRole().name(),
                user.getFullName(),
                user.getInstitution(),
                user.getGroupName(),
                user.getAbout(),
                user.getPhotoUrl()
        );
    }
}
