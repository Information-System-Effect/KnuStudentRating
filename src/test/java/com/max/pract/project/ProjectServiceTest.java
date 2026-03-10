package com.max.pract.project;

import com.max.pract.entity.ProjectEntity;
import com.max.pract.project.dto.ProjectResponse;
import com.max.pract.project.dto.UpdateProjectLifecycleRequest;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.repo.ProjectMemberRepository;
import com.max.pract.repo.ProjectRepository;
import com.max.pract.repo.ProjectRequestRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectRequestRepository projectRequestRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private AppUserRepository appUserRepository;
    @Mock
    private ReviewWindowService reviewWindowService;
    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private ProjectService projectService;

    @Test
    void updateLifecycleOpens24hReviewWindowWhenProjectCompleted() {
        ProjectEntity project = new ProjectEntity();
        setProjectId(project, 7L);
        project.setTitle("Project");
        project.setStatus(ProjectStatus.ACTIVE);

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(projectMemberRepository.findAllByIdProjectId(7L)).thenReturn(List.of());
        when(appUserRepository.findAllById(List.of())).thenReturn(List.of());

        UpdateProjectLifecycleRequest request = new UpdateProjectLifecycleRequest();
        request.setStatus("COMPLETED");

        ProjectResponse response = projectService.updateLifecycle(7L, request);

        assertEquals("COMPLETED", response.status());
        assertNotNull(response.endAt());
        assertNotNull(response.feedbackDeadlineAt());
        assertEquals(24L, Duration.between(response.endAt(), response.feedbackDeadlineAt()).toHours());

        ArgumentCaptor<LocalDateTime> openCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> closeCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(reviewWindowService).upsertWindow(org.mockito.ArgumentMatchers.eq(7L), openCaptor.capture(), closeCaptor.capture());
        assertEquals(24L, Duration.between(openCaptor.getValue(), closeCaptor.getValue()).toHours());
    }

    @Test
    void updateLifecycleClampsFutureEndAtWhenCompletingProject() {
        ProjectEntity project = new ProjectEntity();
        setProjectId(project, 8L);
        project.setTitle("Future Project");
        project.setStatus(ProjectStatus.ACTIVE);

        when(projectRepository.findById(8L)).thenReturn(Optional.of(project));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(projectMemberRepository.findAllByIdProjectId(8L)).thenReturn(List.of());
        when(appUserRepository.findAllById(List.of())).thenReturn(List.of());

        UpdateProjectLifecycleRequest request = new UpdateProjectLifecycleRequest();
        request.setStatus("COMPLETED");
        request.setEndAt(LocalDateTime.now().plusHours(6));

        LocalDateTime before = LocalDateTime.now();
        ProjectResponse response = projectService.updateLifecycle(8L, request);
        LocalDateTime after = LocalDateTime.now();

        assertNotNull(response.endAt());
        assertFalse(response.endAt().isAfter(after));
        assertFalse(response.endAt().isBefore(before.minusSeconds(1)));
        assertEquals(24L, Duration.between(response.endAt(), response.feedbackDeadlineAt()).toHours());

        ArgumentCaptor<LocalDateTime> openCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> closeCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(reviewWindowService).upsertWindow(org.mockito.ArgumentMatchers.eq(8L), openCaptor.capture(), closeCaptor.capture());
        assertFalse(openCaptor.getValue().isAfter(after));
        assertEquals(24L, Duration.between(openCaptor.getValue(), closeCaptor.getValue()).toHours());
    }

    @Test
    void deleteProjectArchivesWhenProjectHasReviews() {
        ProjectEntity project = new ProjectEntity();
        setProjectId(project, 15L);
        project.setStatus(ProjectStatus.ACTIVE);

        when(projectRepository.findById(15L)).thenReturn(Optional.of(project));
        when(jdbcTemplate.queryForObject("SELECT COUNT(1) FROM reviews WHERE project_id = ?", Integer.class, 15L))
                .thenReturn(3);

        String result = projectService.deleteProject(15L);

        assertTrue(result.contains("archived instead of deleted"));
        assertEquals(ProjectStatus.ARCHIVED, project.getStatus());
        verify(projectRepository).save(project);
        verify(projectRepository, never()).delete(project);
    }

    @Test
    void purgeProjectDeletesWhenNoReviews() {
        ProjectEntity project = new ProjectEntity();
        setProjectId(project, 21L);
        project.setStatus(ProjectStatus.ACTIVE);

        when(projectRepository.findById(21L)).thenReturn(Optional.of(project));
        when(jdbcTemplate.queryForObject("SELECT COUNT(1) FROM reviews WHERE project_id = ?", Integer.class, 21L))
                .thenReturn(0);

        String result = projectService.purgeProject(21L);

        assertEquals("Project deleted: 21", result);
        verify(projectRepository).delete(project);
    }

    private void setProjectId(ProjectEntity project, Long id) {
        try {
            Field idField = ProjectEntity.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(project, id);
        } catch (NoSuchFieldException | IllegalAccessException ex) {
            throw new AssertionError("Unable to set project id for test", ex);
        }
    }
}
