package com.max.pract.project;

import com.max.pract.entity.ProjectEntity;
import com.max.pract.entity.ReviewWindowEntity;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.repo.ReviewWindowRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;

@Service
public class ReviewWindowService {

    private final ReviewWindowRepository reviewWindowRepository;

    public ReviewWindowService(ReviewWindowRepository reviewWindowRepository) {
        this.reviewWindowRepository = reviewWindowRepository;
    }

    @Transactional
    public void openForCompletedProject(Long projectId, LocalDateTime projectEndAt) {
        if (projectEndAt == null) {
            throw new IllegalArgumentException("Project end date is required to open review window");
        }
        upsertWindow(projectId, projectEndAt, projectEndAt.plusHours(24));
    }

    @Transactional
    public void upsertWindow(Long projectId, LocalDateTime openAt, LocalDateTime closeAt) {
        if (openAt == null || closeAt == null) {
            throw new IllegalArgumentException("Review window bounds are required");
        }
        LocalDateTime safeCloseAt = closeAt.isAfter(openAt) ? closeAt : openAt.plusSeconds(1);
        ReviewWindowEntity window = reviewWindowRepository.findById(projectId).orElseGet(ReviewWindowEntity::new);
        window.setProjectId(projectId);
        window.setOpenAt(openAt);
        window.setCloseAt(safeCloseAt);
        window.setClosed(false);
        reviewWindowRepository.save(window);
    }

    @Transactional(readOnly = true)
    public LocalDateTime resolveFeedbackDeadline(ProjectEntity project) {
        if (project == null) {
            return null;
        }
        if (project.getFeedbackDeadlineAt() != null && project.getStatus() != ProjectStatus.COMPLETED) {
            return project.getFeedbackDeadlineAt();
        }
        if (project.getStatus() == ProjectStatus.COMPLETED) {
            LocalDateTime completionMoment = normalizeCompletionMoment(
                    project.getEndAt(),
                    LocalDateTime.now(),
                    project.getFeedbackDeadlineAt()
            );
            if (completionMoment == null) {
                return null;
            }
            if (project.getFeedbackDeadlineAt() != null && project.getFeedbackDeadlineAt().isAfter(completionMoment)) {
                return project.getFeedbackDeadlineAt();
            }
            return completionMoment.plusHours(24);
        }
        return null;
    }

    @Transactional
    public void assertWindowOpen(ProjectEntity project) {
        if (project == null) {
            throw new ApiForbiddenException("Project not found");
        }

        ReviewWindowEntity window = ensureWindowSynchronized(project);
        LocalDateTime now = LocalDateTime.now();
        boolean open = !Boolean.TRUE.equals(window.getClosed())
                && !now.isBefore(window.getOpenAt())
                && now.isBefore(window.getCloseAt());
        if (!open) {
            throw new ApiForbiddenException("Review window is closed for this project");
        }
    }

    @Transactional(readOnly = true)
    public void assertWindowOpen(Long projectId) {
        ReviewWindowEntity window = reviewWindowRepository.findById(projectId)
                .orElseThrow(() -> new ApiForbiddenException("Review window is not open for this project"));

        LocalDateTime now = LocalDateTime.now();
        boolean open = !window.getClosed() && !now.isBefore(window.getOpenAt()) && now.isBefore(window.getCloseAt());
        if (!open) {
            throw new ApiForbiddenException("Review window is closed for this project");
        }
    }

    @Scheduled(fixedDelayString = "${app.review-window.close-check-ms:60000}")
    @Transactional
    public void closeExpiredWindows() {
        reviewWindowRepository.closeExpiredWindows(LocalDateTime.now());
    }

    private ReviewWindowEntity ensureWindowSynchronized(ProjectEntity project) {
        if (project.getStatus() != ProjectStatus.COMPLETED) {
            throw new ApiForbiddenException("Reviews are available only after project completion");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime closeAt = resolveFeedbackDeadline(project);
        if (closeAt == null) {
            throw new ApiForbiddenException("Review window is not configured for this project");
        }

        LocalDateTime openAt = normalizeCompletionMoment(project.getEndAt(), now, project.getFeedbackDeadlineAt());
        if (openAt == null) {
            throw new ApiForbiddenException("Review window is not configured for this project");
        }
        LocalDateTime safeCloseAt = closeAt.isAfter(openAt) ? closeAt : openAt.plusSeconds(1);
        boolean shouldBeClosed = !safeCloseAt.isAfter(now);

        ReviewWindowEntity window = reviewWindowRepository.findById(project.getId()).orElseGet(ReviewWindowEntity::new);
        if (needsSynchronization(window, project.getId(), openAt, safeCloseAt, shouldBeClosed)) {
            window.setProjectId(project.getId());
            window.setOpenAt(openAt);
            window.setCloseAt(safeCloseAt);
            window.setClosed(shouldBeClosed);
            window = reviewWindowRepository.save(window);
        }
        return window;
    }

    private boolean needsSynchronization(
            ReviewWindowEntity window,
            Long projectId,
            LocalDateTime openAt,
            LocalDateTime closeAt,
            boolean closed
    ) {
        return !Objects.equals(window.getProjectId(), projectId)
                || !Objects.equals(window.getOpenAt(), openAt)
                || !Objects.equals(window.getCloseAt(), closeAt)
                || !Objects.equals(Boolean.TRUE.equals(window.getClosed()), closed);
    }

    private LocalDateTime normalizeCompletionMoment(LocalDateTime endAt, LocalDateTime now, LocalDateTime fallbackDeadline) {
        if (endAt == null) {
            return fallbackDeadline == null ? null : now;
        }
        if (endAt.isAfter(now)) {
            return now;
        }
        return endAt;
    }
}
