package com.max.pract.review;

import com.max.pract.auth.AppRole;
import com.max.pract.entity.AppUser;
import com.max.pract.entity.ProjectEntity;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.profile.CategoryScoreService;
import com.max.pract.project.ProjectService;
import com.max.pract.project.ProjectStatus;
import com.max.pract.project.ReviewWindowService;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.repo.ProjectRepository;
import com.max.pract.repo.ReviewRepository;
import com.max.pract.review.dto.CreateReviewRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock
    private ReviewRepository reviewRepository;
    @Mock
    private ProjectService projectService;
    @Mock
    private ReviewWindowService reviewWindowService;
    @Mock
    private AppUserRepository appUserRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private CategoryScoreService categoryScoreService;

    @InjectMocks
    private ReviewService reviewService;

    @Test
    void createRejectsReviewWhenProjectNotCompleted() {
        AppUser author = new AppUser();
        author.setRole(AppRole.STUDENT);

        AppUser target = new AppUser();
        target.setRole(AppRole.STUDENT);

        when(appUserRepository.findById(10L)).thenReturn(Optional.of(author));
        when(appUserRepository.findById(11L)).thenReturn(Optional.of(target));

        ProjectEntity project = new ProjectEntity();
        project.setStatus(ProjectStatus.ACTIVE);
        when(projectRepository.findById(99L)).thenReturn(Optional.of(project));

        CreateReviewRequest request = new CreateReviewRequest();
        request.setTargetUserId(11L);
        request.setCategoryId(5L);
        request.setDelta(2.0f);
        request.setComment("ok");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsStudentTechnicalDeltaAboveFive() {
        mockValidProjectContext(AppRole.STUDENT, AppRole.STUDENT, "LANG_JAVA", "TECHNICAL");

        CreateReviewRequest request = new CreateReviewRequest();
        request.setTargetUserId(11L);
        request.setCategoryId(5L);
        request.setDelta(5.1f);
        request.setComment("too much");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsTeacherTechnicalDeltaAboveTwenty() {
        mockValidProjectContext(AppRole.TEACHER, AppRole.STUDENT, "LANG_JAVA", "TECHNICAL");

        CreateReviewRequest request = new CreateReviewRequest();
        request.setTargetUserId(11L);
        request.setCategoryId(5L);
        request.setDelta(20.5f);
        request.setComment("too much");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsStudentOnSystemDesignSubjectiveCategory() {
        mockValidProjectContext(AppRole.STUDENT, AppRole.STUDENT, "SYSTEM_DESIGN", "SUBJECTIVE");

        CreateReviewRequest request = new CreateReviewRequest();
        request.setTargetUserId(11L);
        request.setCategoryId(5L);
        request.setDelta(3f);
        request.setComment("forbidden subjective");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsTeacherOnTeamworkSubjectiveCategory() {
        mockValidProjectContext(AppRole.TEACHER, AppRole.STUDENT, "TEAMWORK", "SUBJECTIVE");

        CreateReviewRequest request = new CreateReviewRequest();
        request.setTargetUserId(11L);
        request.setCategoryId(5L);
        request.setDelta(3f);
        request.setComment("forbidden subjective");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsSubjectiveReviewWhenBudgetExceeded() {
        mockValidProjectContext(AppRole.STUDENT, AppRole.STUDENT, "STUDENT_COMMUNICATION", "SUBJECTIVE");
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(99L), eq(10L), eq(11L), eq(5L)))
                .thenReturn(0);
        when(jdbcTemplate.queryForObject(anyString(), eq(Double.class), eq(99L), eq(10L), eq(11L)))
                .thenReturn(4.0);

        CreateReviewRequest request = new CreateReviewRequest();
        request.setTargetUserId(11L);
        request.setCategoryId(5L);
        request.setDelta(2.0f);
        request.setComment("budget overflow");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsDuplicateReviewBySameCategory() {
        mockValidProjectContext(AppRole.STUDENT, AppRole.STUDENT, "STUDENT_COMMUNICATION", "SUBJECTIVE");
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(99L), eq(10L), eq(11L), eq(5L)))
                .thenReturn(1);

        CreateReviewRequest request = new CreateReviewRequest();
        request.setTargetUserId(11L);
        request.setCategoryId(5L);
        request.setDelta(1.0f);
        request.setComment("duplicate");

        assertThrows(ApiBadRequestException.class, () -> reviewService.create(10L, 99L, request));
    }

    private void mockValidProjectContext(
            AppRole authorRole,
            AppRole targetRole,
            String categoryCode,
            String dimension
    ) {
        AppUser author = new AppUser();
        author.setRole(authorRole);

        AppUser target = new AppUser();
        target.setRole(targetRole);

        when(appUserRepository.findById(10L)).thenReturn(Optional.of(author));
        when(appUserRepository.findById(11L)).thenReturn(Optional.of(target));

        ProjectEntity project = new ProjectEntity();
        project.setStatus(ProjectStatus.COMPLETED);
        when(projectRepository.findById(99L)).thenReturn(Optional.of(project));

        when(projectService.isProjectMember(99L, 10L)).thenReturn(true);
        when(projectService.isProjectMember(99L, 11L)).thenReturn(true);

        when(jdbcTemplate.queryForMap(anyString(), eq(5L), eq("STUDENT")))
                .thenReturn(Map.of(
                        "category_id", 5L,
                        "category_code", categoryCode,
                        "category_name", categoryCode,
                        "category_dimension", dimension
                ));
    }
}
