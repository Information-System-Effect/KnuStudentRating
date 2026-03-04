package com.max.pract.profile;

import com.max.pract.auth.AppRole;
import com.max.pract.contract.ChangeMode;
import com.max.pract.entity.AppUser;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.profile.dto.ParticipantProfileResponse;
import com.max.pract.profile.dto.ProfileCategoryScoreDto;
import com.max.pract.profile.dto.ProfileRatingResponse;
import com.max.pract.profile.dto.ProfileSelfSkillOptionDto;
import com.max.pract.profile.dto.SelfDeclaredSkillRequest;
import com.max.pract.profile.dto.UpdateParticipantProfileRequest;
import com.max.pract.repo.AppUserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collection;
import java.util.List;

@Service
public class ParticipantProfileService {

    private final AppUserRepository appUserRepository;
    private final JdbcTemplate jdbcTemplate;
    private final CategoryScoreService categoryScoreService;
    private final ProfilePhotoStorageService profilePhotoStorageService;

    public ParticipantProfileService(
            AppUserRepository appUserRepository,
            JdbcTemplate jdbcTemplate,
            CategoryScoreService categoryScoreService,
            ProfilePhotoStorageService profilePhotoStorageService
    ) {
        this.appUserRepository = appUserRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.categoryScoreService = categoryScoreService;
        this.profilePhotoStorageService = profilePhotoStorageService;
    }

    @Transactional(readOnly = true)
    public ParticipantProfileResponse getByCode(String code) {
        AppUser participant = findUserByCode(code);
        return toResponse(participant);
    }

    @Transactional(readOnly = true)
    public ParticipantProfileResponse getById(Long userId) {
        AppUser participant = findUserById(userId);
        return toResponse(participant);
    }

    @Transactional(readOnly = true)
    public ProfileRatingResponse getRatingById(Long userId) {
        AppUser participant = findUserById(userId);
        return buildRatingResponse(participant);
    }

    @Transactional(readOnly = true)
    public ProfileRatingResponse getRatingByCode(String code) {
        AppUser participant = findUserByCode(code);
        return buildRatingResponse(participant);
    }

    @Transactional(readOnly = true)
    public List<ParticipantProfileResponse> listByRole(AppRole role) {
        return appUserRepository.findAllByRoleOrderByFullNameAsc(role)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ParticipantProfileResponse> listByRoles(Collection<AppRole> roles) {
        return appUserRepository.findAllByRoleInOrderByFullNameAsc(roles)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ParticipantProfileResponse updateOwnProfile(Long userId, UpdateParticipantProfileRequest request) {
        AppUser participant = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiBadRequestException("User not found"));
        applyProfileUpdate(participant, request, false);
        return toResponse(appUserRepository.save(participant));
    }

    @Transactional
    public ParticipantProfileResponse updateTeacherProfile(String teacherCode, UpdateParticipantProfileRequest request) {
        AppUser teacher = appUserRepository.findByCode(teacherCode)
                .orElseThrow(() -> new ApiBadRequestException("Teacher not found: " + teacherCode));
        if (teacher.getRole() != AppRole.TEACHER && teacher.getRole() != AppRole.POSTGRADUATE) {
            throw new ApiForbiddenException("Target user is not a teacher/postgraduate");
        }
        applyProfileUpdate(teacher, request, true);
        return toResponse(appUserRepository.save(teacher));
    }

    @Transactional
    public ParticipantProfileResponse declareSelfSkills(Long userId, List<SelfDeclaredSkillRequest> skills) {
        for (SelfDeclaredSkillRequest skill : skills) {
            categoryScoreService.declareSelfSkill(userId, skill.getCategoryId(), skill.getScore());
        }
        return getById(userId);
    }

    @Transactional
    public ParticipantProfileResponse upsertOwnSelfSkill(Long userId, Long categoryId, Float score) {
        categoryScoreService.upsertSelfDeclaredSkill(userId, categoryId, ChangeMode.SET, score);
        return getById(userId);
    }

    @Transactional
    public ParticipantProfileResponse deleteOwnSelfSkill(Long userId, Long categoryId) {
        categoryScoreService.deleteSelfDeclaredSkill(userId, categoryId);
        return getById(userId);
    }

    @Transactional
    public ParticipantProfileResponse uploadOwnPhoto(Long userId, MultipartFile file) {
        AppUser participant = findUserById(userId);
        String photoUrl = profilePhotoStorageService.storeProfilePhoto(userId, file, participant.getPhotoUrl());
        participant.setPhotoUrl(photoUrl);
        return toResponse(appUserRepository.save(participant));
    }

    @Transactional(readOnly = true)
    public List<ProfileSelfSkillOptionDto> listSelfSkillOptions(Long userId) {
        AppUser user = findUserById(userId);
        String audience = mapRoleToAudience(user.getRole());
        return jdbcTemplate.query(
                """
                        SELECT c.id AS category_id,
                               c.code AS category_code,
                               c.name AS category_name,
                               ct.audience AS audience,
                               ct.dimension AS dimension,
                               cs.score AS current_score,
                               cs.is_verified AS verified
                        FROM categories c
                        JOIN category_types ct ON ct.id = c.category_type_id
                        LEFT JOIN category_scores cs ON cs.category_id = c.id AND cs.user_id = ?
                        WHERE c.self_declared_allowed = TRUE
                          AND ct.dimension = 'TECHNICAL'
                          AND ct.audience = ?
                        ORDER BY c.code
                        """,
                (rs, rowNum) -> new ProfileSelfSkillOptionDto(
                        rs.getLong("category_id"),
                        rs.getString("category_code"),
                        rs.getString("category_name"),
                        rs.getString("audience"),
                        rs.getString("dimension"),
                        rs.getObject("current_score") == null ? null : rs.getFloat("current_score"),
                        rs.getBoolean("verified")
                ),
                userId,
                audience
        );
    }

    private void applyProfileUpdate(AppUser user, UpdateParticipantProfileRequest request, boolean adminMode) {
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }
        if (request.getInstitution() != null) {
            user.setInstitution(trimToNull(request.getInstitution()));
        }
        if (request.getAbout() != null) {
            user.setAbout(trimToNull(request.getAbout()));
        }
        if (request.getGroupName() != null) {
            if (adminMode || user.getRole() == AppRole.STUDENT) {
                user.setGroupName(trimToNull(request.getGroupName()));
            }
        }
    }

    private ParticipantProfileResponse toResponse(AppUser user) {
        return new ParticipantProfileResponse(
                user.getId(),
                user.getCode(),
                user.getRole().name(),
                user.getEmail(),
                user.getFullName(),
                user.getInstitution(),
                user.getGroupName(),
                user.getAbout(),
                user.getPhotoUrl(),
                loadCategoryScores(user.getId())
        );
    }

    private ProfileRatingResponse buildRatingResponse(AppUser user) {
        CategoryScoreService.RatingSummary summary = categoryScoreService.getRatingSummary(user.getId());
        return new ProfileRatingResponse(
                user.getId(),
                user.getCode(),
                summary.averageScore(),
                summary.totalScore(),
                summary.categoriesCount(),
                summary.verifiedCategories(),
                summary.unverifiedCategories(),
                loadCategoryScores(user.getId())
        );
    }

    private List<ProfileCategoryScoreDto> loadCategoryScores(Long userId) {
        String sql = """
                SELECT c.code AS category_code,
                       c.name AS category_name,
                       ct.audience AS audience,
                       ct.dimension AS dimension,
                       cs.score AS score,
                       cs.is_verified AS verified
                FROM category_scores cs
                JOIN categories c ON c.id = cs.category_id
                JOIN category_types ct ON ct.id = c.category_type_id
                WHERE cs.user_id = ?
                ORDER BY c.code
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> new ProfileCategoryScoreDto(
                rs.getString("category_code"),
                rs.getString("category_name"),
                rs.getString("audience"),
                rs.getString("dimension"),
                rs.getFloat("score"),
                rs.getBoolean("verified")
        ), userId);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private AppUser findUserById(Long userId) {
        return appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiBadRequestException("User not found"));
    }

    private AppUser findUserByCode(String code) {
        return appUserRepository.findByCode(code)
                .orElseThrow(() -> new ApiBadRequestException("User not found: " + code));
    }

    private String mapRoleToAudience(AppRole role) {
        if (role == AppRole.STUDENT) {
            return "STUDENT";
        }
        if (role == AppRole.TEACHER || role == AppRole.POSTGRADUATE) {
            return "TEACHER";
        }
        throw new ApiForbiddenException("Role is not allowed to self-declare technical skills");
    }
}
