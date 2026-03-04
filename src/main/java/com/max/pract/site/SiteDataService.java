package com.max.pract.site;

import com.max.pract.entity.AppUser;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.profile.ParticipantProfileService;
import com.max.pract.profile.dto.ProfileRatingResponse;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.site.dto.SiteHomeResponse;
import com.max.pract.site.dto.SiteCategoryDto;
import com.max.pract.site.dto.SiteParticipantCardDto;
import com.max.pract.site.dto.SiteParticipantRatingResponse;
import com.max.pract.site.dto.SiteParticipantReviewDto;
import com.max.pract.site.dto.SiteProjectCardDto;
import com.max.pract.site.dto.SiteProjectMemberDto;
import com.max.pract.site.dto.SiteProjectRequestCardDto;
import com.max.pract.site.dto.SiteProjectReviewCardDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SiteDataService {

    private final JdbcTemplate jdbcTemplate;
    private final AppUserRepository appUserRepository;
    private final ParticipantProfileService participantProfileService;

    public SiteDataService(
            JdbcTemplate jdbcTemplate,
            AppUserRepository appUserRepository,
            ParticipantProfileService participantProfileService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.appUserRepository = appUserRepository;
        this.participantProfileService = participantProfileService;
    }

    @Transactional(readOnly = true)
    public SiteHomeResponse getHomeData() {
        long completedProjects = queryCount("SELECT COUNT(1) FROM projects WHERE status = 'COMPLETED'");
        long pendingRequests = queryCount("SELECT COUNT(1) FROM project_requests WHERE status = 'PENDING'");
        long students = queryCount("SELECT COUNT(1) FROM users WHERE role = 'STUDENT'");
        long teachers = queryCount("SELECT COUNT(1) FROM users WHERE role IN ('TEACHER', 'POSTGRADUATE')");
        return new SiteHomeResponse(
                completedProjects,
                pendingRequests,
                students,
                teachers,
                "team@knu-rating.local",
                "@knu_rating_support"
        );
    }

    @Transactional(readOnly = true)
    public List<SiteProjectCardDto> getCompletedProjects() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                        SELECT p.id AS project_id,
                               p.title,
                               p.description,
                               p.status,
                               p.start_at,
                               p.end_at,
                               p.feedback_deadline_at,
                               pm.member_role,
                               u.id AS user_id,
                               u.code AS user_code,
                               u.full_name,
                               u.role AS user_role
                        FROM projects p
                        LEFT JOIN project_members pm ON pm.project_id = p.id
                        LEFT JOIN users u ON u.id = pm.user_id
                        WHERE p.status = 'COMPLETED'
                        ORDER BY p.end_at DESC, p.created_at DESC, pm.member_role, u.full_name
                        """
        );
        Map<Long, ProjectCardBuilder> cards = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Long projectId = ((Number) row.get("project_id")).longValue();
            ProjectCardBuilder builder = cards.computeIfAbsent(
                    projectId,
                    ignored -> new ProjectCardBuilder(
                            projectId,
                            (String) row.get("title"),
                            (String) row.get("description"),
                            (String) row.get("status"),
                            toLocalDateTime(row.get("start_at")),
                            toLocalDateTime(row.get("end_at")),
                            toLocalDateTime(row.get("feedback_deadline_at"))
                    )
            );
            if (row.get("user_id") != null) {
                builder.members().add(new SiteProjectMemberDto(
                        ((Number) row.get("user_id")).longValue(),
                        (String) row.get("user_code"),
                        (String) row.get("full_name"),
                        (String) row.get("user_role"),
                        (String) row.get("member_role")
                ));
            }
        }
        return cards.values()
                .stream()
                .map(ProjectCardBuilder::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SiteProjectRequestCardDto> getProjectRequests() {
        return jdbcTemplate.query(
                """
                        SELECT pr.id, pr.author_user_id, pr.title, pr.description, pr.status, pr.created_at
                        FROM project_requests pr
                        ORDER BY pr.created_at DESC
                        """,
                (rs, rowNum) -> new SiteProjectRequestCardDto(
                        rs.getLong("id"),
                        rs.getLong("author_user_id"),
                        rs.getString("title"),
                        rs.getString("description"),
                        rs.getString("status"),
                        rs.getTimestamp("created_at").toInstant()
                )
        );
    }

    @Transactional(readOnly = true)
    public List<SiteParticipantCardDto> getStudents() {
        return findParticipantsByRole("STUDENT");
    }

    @Transactional(readOnly = true)
    public List<SiteParticipantCardDto> getTeachers() {
        return findParticipantsByRoles(List.of("TEACHER", "POSTGRADUATE"));
    }

    @Transactional(readOnly = true)
    public List<SiteParticipantCardDto> getPostgraduates() {
        return findParticipantsByRoles(List.of("POSTGRADUATE"));
    }

    @Transactional(readOnly = true)
    public List<SiteProjectReviewCardDto> getRecentProjectReviews(int limit) {
        return jdbcTemplate.query(
                """
                        SELECT r.id,
                               r.project_id,
                               p.title AS project_title,
                               au.code AS author_code,
                               tu.code AS target_code,
                               c.code AS category_code,
                               r.delta,
                               r.comment,
                               r.created_at
                        FROM reviews r
                        JOIN projects p ON p.id = r.project_id
                        JOIN users au ON au.id = r.author_user_id
                        JOIN users tu ON tu.id = r.target_user_id
                        JOIN categories c ON c.id = r.category_id
                        ORDER BY r.created_at DESC
                        LIMIT ?
                        """,
                (rs, rowNum) -> new SiteProjectReviewCardDto(
                        rs.getLong("id"),
                        rs.getLong("project_id"),
                        rs.getString("project_title"),
                        rs.getString("author_code"),
                        rs.getString("target_code"),
                        rs.getString("category_code"),
                        rs.getFloat("delta"),
                        rs.getString("comment"),
                        rs.getTimestamp("created_at").toInstant()
                ),
                limit
        );
    }

    @Transactional(readOnly = true)
    public SiteParticipantRatingResponse getParticipantRating(String userCode) {
        AppUser user = appUserRepository.findByCode(userCode)
                .orElseThrow(() -> new ApiBadRequestException("User not found: " + userCode));
        ProfileRatingResponse rating = participantProfileService.getRatingByCode(userCode);
        return new SiteParticipantRatingResponse(
                user.getId(),
                user.getCode(),
                user.getRole().name(),
                user.getFullName(),
                user.getInstitution(),
                user.getGroupName(),
                user.getAbout(),
                user.getPhotoUrl(),
                rating.averageScore(),
                rating.totalScore(),
                rating.categoriesCount(),
                rating.verifiedCategories(),
                rating.unverifiedCategories(),
                rating.categoryScores()
        );
    }

    @Transactional(readOnly = true)
    public List<SiteCategoryDto> getParticipantCategories(String userCode) {
        AppUser user = appUserRepository.findByCode(userCode)
                .orElseThrow(() -> new ApiBadRequestException("User not found: " + userCode));
        String audience = user.getRole().name().equals("STUDENT") ? "STUDENT" : "TEACHER";
        return jdbcTemplate.query(
                """
                        SELECT c.id AS category_id,
                               c.code AS category_code,
                               c.name AS category_name,
                               ct.audience AS audience,
                               ct.dimension AS dimension,
                               c.self_declared_allowed AS self_declared_allowed
                        FROM categories c
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE ct.audience = ?
                        ORDER BY c.code
                        """,
                (rs, rowNum) -> new SiteCategoryDto(
                        rs.getLong("category_id"),
                        rs.getString("category_code"),
                        rs.getString("category_name"),
                        rs.getString("audience"),
                        rs.getString("dimension"),
                        rs.getBoolean("self_declared_allowed")
                ),
                audience
        );
    }

    @Transactional(readOnly = true)
    public List<SiteParticipantReviewDto> getParticipantReviews(String userCode, int limit) {
        AppUser user = appUserRepository.findByCode(userCode)
                .orElseThrow(() -> new ApiBadRequestException("User not found: " + userCode));
        return jdbcTemplate.query(
                """
                        SELECT r.id,
                               r.project_id,
                               p.title AS project_title,
                               au.code AS author_code,
                               tu.code AS target_code,
                               c.code AS category_code,
                               r.delta,
                               r.comment,
                               r.created_at
                        FROM reviews r
                        JOIN projects p ON p.id = r.project_id
                        JOIN users au ON au.id = r.author_user_id
                        JOIN users tu ON tu.id = r.target_user_id
                        JOIN categories c ON c.id = r.category_id
                        WHERE r.target_user_id = ?
                        ORDER BY r.created_at DESC
                        LIMIT ?
                        """,
                (rs, rowNum) -> new SiteParticipantReviewDto(
                        rs.getLong("id"),
                        rs.getLong("project_id"),
                        rs.getString("project_title"),
                        rs.getString("author_code"),
                        rs.getString("target_code"),
                        rs.getString("category_code"),
                        rs.getFloat("delta"),
                        rs.getString("comment"),
                        rs.getTimestamp("created_at").toInstant()
                ),
                user.getId(),
                limit
        );
    }

    private List<SiteParticipantCardDto> findParticipantsByRole(String role) {
        return findParticipantsByRoles(List.of(role));
    }

    private List<SiteParticipantCardDto> findParticipantsByRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", roles.stream().map(r -> "?").toList());
        String sql = """
                        SELECT u.id, u.code, u.role, u.full_name, u.institution, u.group_name, u.about
                               ,u.photo_url
                        FROM users u
                        WHERE u.role IN (%s)
                        ORDER BY u.full_name
                        """.formatted(placeholders);

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new SiteParticipantCardDto(
                        rs.getLong("id"),
                        rs.getString("code"),
                        rs.getString("role"),
                        rs.getString("full_name"),
                        rs.getString("institution"),
                        rs.getString("group_name"),
                        rs.getString("about"),
                        rs.getString("photo_url")
                ),
                roles.toArray()
        );
    }

    private long queryCount(String sql) {
        Long count = jdbcTemplate.queryForObject(sql, Long.class);
        return count == null ? 0L : count;
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (!(value instanceof Timestamp timestamp)) {
            return null;
        }
        return timestamp.toLocalDateTime();
    }

    private record ProjectCardBuilder(
            Long projectId,
            String title,
            String description,
            String status,
            LocalDateTime startAt,
            LocalDateTime endAt,
            LocalDateTime feedbackDeadlineAt,
            List<SiteProjectMemberDto> members
    ) {
        ProjectCardBuilder(
                Long projectId,
                String title,
                String description,
                String status,
                LocalDateTime startAt,
                LocalDateTime endAt,
                LocalDateTime feedbackDeadlineAt
        ) {
            this(projectId, title, description, status, startAt, endAt, feedbackDeadlineAt, new ArrayList<>());
        }

        SiteProjectCardDto toDto() {
            return new SiteProjectCardDto(
                    projectId,
                    title,
                    description,
                    status,
                    startAt,
                    endAt,
                    feedbackDeadlineAt,
                    List.copyOf(members)
            );
        }
    }
}
