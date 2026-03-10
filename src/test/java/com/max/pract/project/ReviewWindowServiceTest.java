package com.max.pract.project;

import com.max.pract.entity.ProjectEntity;
import com.max.pract.entity.ReviewWindowEntity;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.repo.ReviewWindowRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewWindowServiceTest {

    @Mock
    private ReviewWindowRepository reviewWindowRepository;

    @InjectMocks
    private ReviewWindowService reviewWindowService;

    @Test
    void assertWindowOpenReconstructsMissingWindowFromProjectDeadline() {
        LocalDateTime endAt = LocalDateTime.now().minusHours(1);
        LocalDateTime closeAt = LocalDateTime.now().plusHours(2);

        ProjectEntity project = new ProjectEntity();
        ReflectionTestUtils.setField(project, "id", 55L);
        project.setStatus(ProjectStatus.COMPLETED);
        project.setEndAt(endAt);
        project.setFeedbackDeadlineAt(closeAt);

        when(reviewWindowRepository.findById(55L)).thenReturn(Optional.empty());
        when(reviewWindowRepository.save(any(ReviewWindowEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        reviewWindowService.assertWindowOpen(project);

        ArgumentCaptor<ReviewWindowEntity> captor = ArgumentCaptor.forClass(ReviewWindowEntity.class);
        verify(reviewWindowRepository).save(captor.capture());
        ReviewWindowEntity saved = captor.getValue();
        assertEquals(55L, saved.getProjectId());
        assertEquals(endAt, saved.getOpenAt());
        assertEquals(closeAt, saved.getCloseAt());
    }

    @Test
    void assertWindowOpenRejectsCompletedProjectWithoutDeadlineMetadata() {
        ProjectEntity project = new ProjectEntity();
        ReflectionTestUtils.setField(project, "id", 77L);
        project.setStatus(ProjectStatus.COMPLETED);

        assertThrows(ApiForbiddenException.class, () -> reviewWindowService.assertWindowOpen(project));
    }

    @Test
    void resolveFeedbackDeadlineFallsBackToEndPlusTwentyFourHours() {
        LocalDateTime endAt = LocalDateTime.of(2026, 3, 8, 10, 15);

        ProjectEntity project = new ProjectEntity();
        project.setStatus(ProjectStatus.COMPLETED);
        project.setEndAt(endAt);

        assertEquals(endAt.plusHours(24), reviewWindowService.resolveFeedbackDeadline(project));
    }

    @Test
    void assertWindowOpenNormalizesFutureCompletionDateForCompletedProject() {
        LocalDateTime futureEndAt = LocalDateTime.now().plusHours(5);
        LocalDateTime closeAt = LocalDateTime.now().plusHours(8);

        ProjectEntity project = new ProjectEntity();
        ReflectionTestUtils.setField(project, "id", 88L);
        project.setStatus(ProjectStatus.COMPLETED);
        project.setEndAt(futureEndAt);
        project.setFeedbackDeadlineAt(closeAt);

        when(reviewWindowRepository.findById(88L)).thenReturn(Optional.empty());
        when(reviewWindowRepository.save(any(ReviewWindowEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LocalDateTime before = LocalDateTime.now();
        reviewWindowService.assertWindowOpen(project);
        LocalDateTime after = LocalDateTime.now();

        ArgumentCaptor<ReviewWindowEntity> captor = ArgumentCaptor.forClass(ReviewWindowEntity.class);
        verify(reviewWindowRepository).save(captor.capture());
        ReviewWindowEntity saved = captor.getValue();
        assertFalse(saved.getOpenAt().isAfter(after));
        assertFalse(saved.getOpenAt().isBefore(before.minusSeconds(1)));
        assertEquals(closeAt, saved.getCloseAt());
    }
}
