package com.max.pract.project;

import com.max.pract.auth.AppRole;
import com.max.pract.entity.AppUser;
import com.max.pract.entity.ProjectEntity;
import com.max.pract.entity.ProjectMemberEntity;
import com.max.pract.entity.ProjectMemberId;
import com.max.pract.entity.ProjectRequestEntity;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.project.dto.CreateProjectRequest;
import com.max.pract.project.dto.CreateProjectFromRequestBody;
import com.max.pract.project.dto.ProjectMemberDto;
import com.max.pract.project.dto.ProjectResponse;
import com.max.pract.project.dto.UpdateProjectLifecycleRequest;
import com.max.pract.project.dto.UpsertProjectMemberRequest;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.repo.ProjectMemberRepository;
import com.max.pract.repo.ProjectRepository;
import com.max.pract.repo.ProjectRequestRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectRequestRepository projectRequestRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final AppUserRepository appUserRepository;
    private final ReviewWindowService reviewWindowService;
    private final JdbcTemplate jdbcTemplate;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectRequestRepository projectRequestRepository,
            ProjectMemberRepository projectMemberRepository,
            AppUserRepository appUserRepository,
            ReviewWindowService reviewWindowService,
            JdbcTemplate jdbcTemplate
    ) {
        this.projectRepository = projectRepository;
        this.projectRequestRepository = projectRequestRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.appUserRepository = appUserRepository;
        this.reviewWindowService = reviewWindowService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public ProjectResponse createDirect(Long creatorUserId, CreateProjectRequest request) {
        AppUser creator = appUserRepository.findById(creatorUserId)
                .orElseThrow(() -> new ApiBadRequestException("Creator user not found"));

        LocalDateTime startAt = LocalDateTime.now();
        LocalDateTime plannedFeedbackDeadline = request.getFeedbackDeadlineAt();
        if (plannedFeedbackDeadline != null && plannedFeedbackDeadline.isBefore(startAt)) {
            throw new ApiBadRequestException("Feedback deadline cannot be before project creation time");
        }

        ProjectEntity project = new ProjectEntity();
        project.setTitle(request.getTitle().trim());
        project.setDescription(trimToNull(request.getDescription()));
        project.setStartAt(startAt);
        project.setStatus(ProjectStatus.ACTIVE);
        project.setFeedbackDeadlineAt(plannedFeedbackDeadline);
        ProjectEntity saved = projectRepository.save(project);

        List<ProjectMemberEntity> members = new ArrayList<>();
        members.add(createMember(saved.getId(), creator.getId(), ProjectMemberRole.OWNER));

        for (Long userId : resolveUserIdsByCodes(request.getStudentIds(), request.getStudentCodes())) {
            validateUserRole(userId, AppRole.STUDENT);
            members.add(createMember(saved.getId(), userId, ProjectMemberRole.STUDENT));
        }
        for (Long userId : resolveUserIdsByCodes(request.getTeacherIds(), request.getTeacherCodes())) {
            AppUser user = appUserRepository.findById(userId)
                    .orElseThrow(() -> new ApiBadRequestException("User not found: " + userId));
            if (user.getRole() != AppRole.TEACHER && user.getRole() != AppRole.ADMIN) {
                throw new ApiForbiddenException("Only teacher/admin can be assigned as mentor");
            }
            members.add(createMember(saved.getId(), userId, ProjectMemberRole.MENTOR));
        }

        deduplicateAndSaveMembers(members);

        return toResponse(saved);
    }

    @Transactional
    public ProjectResponse createFromApprovedRequest(Long requestId, CreateProjectFromRequestBody body) {
        ProjectRequestEntity projectRequest = projectRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiBadRequestException("Project request not found"));

        if (projectRequest.getStatus() != ProjectRequestStatus.APPROVED) {
            throw new ApiBadRequestException("Project can be created only from APPROVED request");
        }
        if (projectRepository.existsByCreatedFromRequestId(requestId)) {
            throw new ApiBadRequestException("Project is already created from this request");
        }

        ProjectEntity project = new ProjectEntity();
        project.setCreatedFromRequestId(projectRequest.getId());
        project.setTitle(nonBlank(body.getTitle(), projectRequest.getTitle()));
        project.setDescription(nonBlank(body.getDescription(), projectRequest.getDescription()));
        project.setStartAt(body.getStartAt() == null ? LocalDateTime.now() : body.getStartAt());
        project.setStatus(ProjectStatus.ACTIVE);
        ProjectEntity saved = projectRepository.save(project);

        List<ProjectMemberEntity> members = new ArrayList<>();
        members.add(createMember(saved.getId(), projectRequest.getAuthorUserId(), ProjectMemberRole.OWNER));

        for (Long userId : resolveUserIdsByCodes(body.getStudentIds(), body.getStudentCodes())) {
            validateUserRole(userId, AppRole.STUDENT);
            members.add(createMember(saved.getId(), userId, ProjectMemberRole.STUDENT));
        }
        for (Long userId : resolveUserIdsByCodes(body.getTeacherIds(), body.getTeacherCodes())) {
            AppUser user = appUserRepository.findById(userId)
                    .orElseThrow(() -> new ApiBadRequestException("User not found: " + userId));
            if (user.getRole() != AppRole.TEACHER && user.getRole() != AppRole.ADMIN) {
                throw new ApiForbiddenException("Only teacher/admin can be assigned as mentor");
            }
            members.add(createMember(saved.getId(), userId, ProjectMemberRole.MENTOR));
        }

        deduplicateAndSaveMembers(members);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> listProjects() {
        return projectRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse getProject(Long projectId) {
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiBadRequestException("Project not found"));
        return toResponse(project);
    }

    @Transactional
    public ProjectResponse updateLifecycle(Long projectId, UpdateProjectLifecycleRequest request) {
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiBadRequestException("Project not found"));

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            project.setTitle(request.getTitle().trim());
        }
        if (request.getDescription() != null) {
            project.setDescription(trimToNull(request.getDescription()));
        }
        if (request.getStartAt() != null) {
            project.setStartAt(request.getStartAt());
        }
        if (request.getEndAt() != null) {
            project.setEndAt(request.getEndAt());
        }
        if (request.getFeedbackDeadlineAt() != null) {
            project.setFeedbackDeadlineAt(request.getFeedbackDeadlineAt());
        }
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            project.setStatus(ProjectStatus.valueOf(request.getStatus().trim().toUpperCase()));
        }

        ProjectEntity saved = projectRepository.save(project);
        if (saved.getStatus() == ProjectStatus.COMPLETED) {
            LocalDateTime endAt = saved.getEndAt() != null ? saved.getEndAt() : LocalDateTime.now();
            if (saved.getEndAt() == null) {
                saved.setEndAt(endAt);
            }
            LocalDateTime closeAt = saved.getFeedbackDeadlineAt();
            if (closeAt == null || !closeAt.isAfter(endAt)) {
                closeAt = endAt.plusHours(24);
                saved.setFeedbackDeadlineAt(closeAt);
            }
            saved = projectRepository.save(saved);
            reviewWindowService.upsertWindow(saved.getId(), endAt, closeAt);
        }
        return toResponse(saved);
    }

    @Transactional
    public ProjectResponse upsertMember(Long projectId, UpsertProjectMemberRequest request) {
        projectRepository.findById(projectId).orElseThrow(() -> new ApiBadRequestException("Project not found"));

        Long userId = request.getUserId();
        AppUser targetUser = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiBadRequestException("User not found"));
        ProjectMemberRole memberRole = ProjectMemberRole.valueOf(request.getMemberRole().trim().toUpperCase());

        if (memberRole == ProjectMemberRole.STUDENT && targetUser.getRole() != AppRole.STUDENT) {
            throw new ApiForbiddenException("Only student can be assigned to STUDENT role");
        }
        if ((memberRole == ProjectMemberRole.TEACHER || memberRole == ProjectMemberRole.MENTOR)
                && targetUser.getRole() != AppRole.TEACHER
                && targetUser.getRole() != AppRole.ADMIN) {
            throw new ApiForbiddenException("Only teacher/admin can be assigned to mentor role");
        }

        ProjectMemberEntity projectMember = new ProjectMemberEntity();
        projectMember.setId(new ProjectMemberId(projectId, userId));
        projectMember.setMemberRole(memberRole);
        projectMemberRepository.save(projectMember);
        return getProject(projectId);
    }

    @Transactional
    public ProjectResponse removeMember(Long projectId, Long userId) {
        projectRepository.findById(projectId).orElseThrow(() -> new ApiBadRequestException("Project not found"));
        projectMemberRepository.deleteById(new ProjectMemberId(projectId, userId));
        return getProject(projectId);
    }

    @Transactional
    public String deleteProject(Long projectId) {
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiBadRequestException("Project not found"));

        long reviewCount = countProjectReviews(projectId);
        if (reviewCount > 0) {
            if (project.getStatus() != ProjectStatus.ARCHIVED) {
                project.setStatus(ProjectStatus.ARCHIVED);
                projectRepository.save(project);
            }
            return "Project has reviews and was archived instead of deleted: " + projectId
                    + ". Use purge endpoint to permanently delete with score rollback.";
        }

        projectRepository.delete(project);
        return "Project deleted: " + projectId;
    }

    @Transactional
    public String purgeProject(Long projectId) {
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ApiBadRequestException("Project not found"));

        long reviewCount = countProjectReviews(projectId);
        if (reviewCount > 0) {
            rollbackProjectReviewScores(projectId);
        }

        projectRepository.delete(project);
        return reviewCount > 0
                ? "Project permanently deleted with review score rollback: " + projectId
                : "Project deleted: " + projectId;
    }

    @Transactional(readOnly = true)
    public boolean isProjectMember(Long projectId, Long userId) {
        return projectMemberRepository.existsByIdProjectIdAndIdUserId(projectId, userId);
    }

    private void validateUserRole(Long userId, AppRole requiredRole) {
        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiBadRequestException("User not found: " + userId));
        if (user.getRole() != requiredRole) {
            throw new ApiForbiddenException("User role mismatch for project member assignment");
        }
    }

    private void deduplicateAndSaveMembers(List<ProjectMemberEntity> members) {
        Map<ProjectMemberId, ProjectMemberEntity> uniqueMembers = members.stream()
                .collect(Collectors.toMap(ProjectMemberEntity::getId, m -> m, (first, second) -> first));
        projectMemberRepository.saveAll(uniqueMembers.values());
    }

    private List<Long> resolveUserIdsByCodes(List<Long> userIds, List<String> userCodes) {
        Set<Long> resolved = new LinkedHashSet<>();
        if (userIds != null) {
            resolved.addAll(userIds);
        }
        if (userCodes != null) {
            for (String rawCode : userCodes) {
                String code = rawCode == null ? "" : rawCode.trim();
                if (code.isEmpty()) {
                    continue;
                }
                Long userId = appUserRepository.findByCode(code)
                        .map(AppUser::getId)
                        .orElseThrow(() -> new ApiBadRequestException("User not found by code: " + code));
                resolved.add(userId);
            }
        }
        return List.copyOf(resolved);
    }

    private ProjectMemberEntity createMember(Long projectId, Long userId, ProjectMemberRole role) {
        ProjectMemberEntity projectMember = new ProjectMemberEntity();
        projectMember.setId(new ProjectMemberId(projectId, userId));
        projectMember.setMemberRole(role);
        return projectMember;
    }

    private long countProjectReviews(Long projectId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM reviews WHERE project_id = ?",
                Integer.class,
                projectId
        );
        return count == null ? 0L : count.longValue();
    }

    private void rollbackProjectReviewScores(Long projectId) {
        List<Map<String, Object>> affectedPairs = jdbcTemplate.queryForList(
                """
                        SELECT DISTINCT r.target_user_id AS user_id, r.category_id AS category_id
                        FROM reviews r
                        WHERE r.project_id = ?
                        """,
                projectId
        );
        if (affectedPairs.isEmpty()) {
            return;
        }

        jdbcTemplate.update(
                """
                        DELETE se
                        FROM score_events se
                        JOIN reviews r ON r.id = se.source_ref_id
                        WHERE se.source_type = 'PROJECT_REVIEW'
                          AND r.project_id = ?
                        """,
                projectId
        );

        for (Map<String, Object> pair : affectedPairs) {
            Long userId = ((Number) pair.get("user_id")).longValue();
            Long categoryId = ((Number) pair.get("category_id")).longValue();

            List<Map<String, Object>> latestEvents = jdbcTemplate.queryForList(
                    """
                            SELECT result_score, is_verified_after_event
                            FROM score_events
                            WHERE user_id = ? AND category_id = ?
                            ORDER BY id DESC
                            LIMIT 1
                            """,
                    userId,
                    categoryId
            );

            if (latestEvents.isEmpty()) {
                jdbcTemplate.update(
                        "DELETE FROM category_scores WHERE user_id = ? AND category_id = ?",
                        userId,
                        categoryId
                );
                continue;
            }

            Map<String, Object> latest = latestEvents.get(0);
            BigDecimal restoredScore = toBigDecimal(latest.get("result_score"));
            boolean restoredVerified = toBoolean(latest.get("is_verified_after_event"));

            jdbcTemplate.update(
                    """
                            INSERT INTO category_scores(user_id, category_id, score, is_verified)
                            VALUES (?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE score = VALUES(score), is_verified = VALUES(is_verified)
                            """,
                    userId,
                    categoryId,
                    restoredScore,
                    restoredVerified
            );
        }
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        if (value == null) {
            return BigDecimal.ZERO;
        }
        return new BigDecimal(String.valueOf(value));
    }

    private boolean toBoolean(Object value) {
        if (value instanceof Boolean flag) {
            return flag;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private ProjectResponse toResponse(ProjectEntity project) {
        List<ProjectMemberEntity> memberEntities = projectMemberRepository.findAllByIdProjectId(project.getId());
        List<Long> userIds = memberEntities.stream().map(m -> m.getId().getUserId()).distinct().toList();
        Map<Long, AppUser> usersById = appUserRepository.findAllById(userIds)
                .stream()
                .collect(Collectors.toMap(AppUser::getId, u -> u));

        List<ProjectMemberDto> members = memberEntities.stream()
                .map(member -> {
                    AppUser user = usersById.get(member.getId().getUserId());
                    return new ProjectMemberDto(
                            member.getId().getUserId(),
                            user == null ? null : user.getCode(),
                            user == null ? null : user.getFullName(),
                            member.getMemberRole().name()
                    );
                })
                .toList();

        LocalDateTime effectiveFeedbackDeadline = reviewWindowService.resolveFeedbackDeadline(project);
        if (effectiveFeedbackDeadline == null) {
            effectiveFeedbackDeadline = project.getFeedbackDeadlineAt();
        }

        return new ProjectResponse(
                project.getId(),
                project.getTitle(),
                project.getDescription(),
                project.getStatus().name(),
                project.getCreatedFromRequestId(),
                project.getStartAt(),
                project.getEndAt(),
                effectiveFeedbackDeadline,
                project.getCreatedAt(),
                members
        );
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String nonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary.trim();
        }
        return fallback;
    }
}
