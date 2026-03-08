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
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
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
    void createRejectsReviewWhenWindowIsClosed() {
        mockValidProjectContext(AppRole.STUDENT, AppRole.STUDENT);
        doThrow(new ApiForbiddenException("Review window is closed for this project"))
                .when(reviewWindowService)
                .assertWindowOpen(any(ProjectEntity.class));

        CreateReviewRequest request = createRequest(11L, 5L, 2.0f, "closed");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsDeltaAboveFive() {
        mockValidProjectContext(AppRole.STUDENT, AppRole.STUDENT);

        CreateReviewRequest request = createRequest(11L, 5L, 5.1f, "too much");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsCategoryMissingInTargetProfile() {
        mockValidProjectContext(AppRole.STUDENT, AppRole.STUDENT);
        when(jdbcTemplate.queryForMap(anyString(), eq(11L), eq(5L)))
                .thenThrow(new EmptyResultDataAccessException(1));

        CreateReviewRequest request = createRequest(11L, 5L, 3.0f, "missing category");

        assertThrows(ApiForbiddenException.class, () -> reviewService.create(10L, 99L, request));
    }

    @Test
    void createRejectsDuplicateReviewBySameCategory() {
        mockValidProjectContext(AppRole.STUDENT, AppRole.STUDENT);
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(99L), eq(10L), eq(11L), eq(5L)))
                .thenReturn(1);

        CreateReviewRequest request = createRequest(11L, 5L, 1.0f, "duplicate");

        assertThrows(ApiBadRequestException.class, () -> reviewService.create(10L, 99L, request));
    }

    private void mockValidProjectContext(AppRole authorRole, AppRole targetRole) {
        AppUser author = new AppUser();
        ReflectionTestUtils.setField(author, "id", 10L);
        author.setRole(authorRole);

        AppUser target = new AppUser();
        ReflectionTestUtils.setField(target, "id", 11L);
        target.setRole(targetRole);

        when(appUserRepository.findById(10L)).thenReturn(Optional.of(author));
        when(appUserRepository.findById(11L)).thenReturn(Optional.of(target));

        ProjectEntity project = new ProjectEntity();
        project.setStatus(ProjectStatus.COMPLETED);
        when(projectRepository.findById(99L)).thenReturn(Optional.of(project));

        lenient().when(projectService.isProjectMember(99L, 10L)).thenReturn(true);
        lenient().when(projectService.isProjectMember(99L, 11L)).thenReturn(true);

        lenient().when(jdbcTemplate.queryForMap(anyString(), eq(11L), eq(5L)))
                .thenReturn(Map.of(
                        "category_id", 5L,
                        "category_code", "STUDENT_LANG_JAVA",
                        "category_name", "Java",
                        "category_dimension", "TECHNICAL"
                ));
        lenient().when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(99L), eq(10L), eq(11L), eq(5L)))
                .thenReturn(0);
    }

    private CreateReviewRequest createRequest(Long targetUserId, Long categoryId, Float delta, String comment) {
        CreateReviewRequest request = new CreateReviewRequest();
        request.setTargetUserId(targetUserId);
        request.setCategoryId(categoryId);
        request.setDelta(delta);
        request.setComment(comment);
        return request;
    }
}
