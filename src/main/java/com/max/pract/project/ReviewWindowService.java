package com.max.pract.project;

import com.max.pract.entity.ReviewWindowEntity;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.repo.ReviewWindowRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

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
}
