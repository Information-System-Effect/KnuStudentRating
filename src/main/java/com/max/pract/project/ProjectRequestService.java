package com.max.pract.project;

import com.max.pract.auth.AppRole;
import com.max.pract.entity.AppUser;
import com.max.pract.entity.ProjectRequestEntity;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.project.dto.CreateProjectFromRequestBody;
import com.max.pract.project.dto.CreateProjectRequestRequest;
import com.max.pract.project.dto.ProjectRequestResponse;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.repo.ProjectRepository;
import com.max.pract.repo.ProjectRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ProjectRequestService {

    private final ProjectRequestRepository projectRequestRepository;
    private final ProjectRepository projectRepository;
    private final AppUserRepository appUserRepository;
    private final ProjectService projectService;

    public ProjectRequestService(
            ProjectRequestRepository projectRequestRepository,
            ProjectRepository projectRepository,
            AppUserRepository appUserRepository,
            ProjectService projectService
    ) {
        this.projectRequestRepository = projectRequestRepository;
        this.projectRepository = projectRepository;
        this.appUserRepository = appUserRepository;
        this.projectService = projectService;
    }

    @Transactional
    public ProjectRequestResponse create(Long requesterId, CreateProjectRequestRequest request) {
        AppUser requester = appUserRepository.findById(requesterId)
                .orElseThrow(() -> new ApiBadRequestException("Author not found"));
        if (requester.getRole() != AppRole.STUDENT) {
            throw new ApiForbiddenException("Only students can create project requests");
        }

        ProjectRequestEntity projectRequest = new ProjectRequestEntity();
        projectRequest.setAuthorUserId(requester.getId());
        projectRequest.setTitle(request.getTitle().trim());
        projectRequest.setDescription(trimToNull(request.getDescription()));
        projectRequest.setStatus(ProjectRequestStatus.PENDING);
        return toResponse(projectRequestRepository.save(projectRequest));
    }

    @Transactional(readOnly = true)
    public List<ProjectRequestResponse> listMine(Long requesterId) {
        return projectRequestRepository.findAllByAuthorUserIdOrderByCreatedAtDesc(requesterId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ProjectRequestResponse> listAll() {
        return projectRequestRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ProjectRequestResponse approve(Long requestId, Long adminId, String comment) {
        return moderate(requestId, adminId, ProjectRequestStatus.APPROVED, comment);
    }

    @Transactional
    public ProjectRequestResponse reject(Long requestId, Long adminId, String comment) {
        return moderate(requestId, adminId, ProjectRequestStatus.REJECTED, comment);
    }

    @Transactional
    public String delete(Long requestId, Long adminId) {
        assertAdmin(adminId);

        ProjectRequestEntity projectRequest = projectRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiBadRequestException("Project request not found: " + requestId));

        if (findCreatedProjectId(projectRequest.getId()) != null) {
            throw new ApiBadRequestException("Cannot delete request: project is already created from this request");
        }

        projectRequestRepository.delete(projectRequest);
        return "Project request deleted: " + requestId;
    }

    private ProjectRequestResponse moderate(Long requestId, Long adminId, ProjectRequestStatus targetStatus, String comment) {
        assertAdmin(adminId);

        ProjectRequestEntity projectRequest = projectRequestRepository.findById(requestId)
                .orElseThrow(() -> new ApiBadRequestException("Project request not found: " + requestId));
        if (projectRequest.getStatus() != ProjectRequestStatus.PENDING) {
            throw new ApiBadRequestException("Only pending requests can be moderated");
        }

        projectRequest.setStatus(targetStatus);
        projectRequest.setAdminComment(trimToNull(comment));
        projectRequest.setReviewedByUserId(adminId);
        projectRequest.setReviewedAt(LocalDateTime.now());
        ProjectRequestEntity saved = projectRequestRepository.save(projectRequest);

        Long createdProjectId = findCreatedProjectId(saved.getId());
        if (targetStatus == ProjectRequestStatus.APPROVED && createdProjectId == null) {
            var body = new CreateProjectFromRequestBody();
            var createdProject = projectService.createFromApprovedRequest(saved.getId(), body);
            createdProjectId = createdProject.id();
        }
        return toResponse(saved, createdProjectId);
    }

    private ProjectRequestResponse toResponse(ProjectRequestEntity entity) {
        return toResponse(entity, findCreatedProjectId(entity.getId()));
    }

    private ProjectRequestResponse toResponse(ProjectRequestEntity entity, Long createdProjectId) {
        return new ProjectRequestResponse(
                entity.getId(),
                entity.getAuthorUserId(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getStatus().name(),
                createdProjectId,
                entity.getAdminComment(),
                entity.getReviewedByUserId(),
                entity.getCreatedAt(),
                entity.getReviewedAt()
        );
    }

    private Long findCreatedProjectId(Long requestId) {
        return projectRepository.findByCreatedFromRequestId(requestId)
                .map(project -> project.getId())
                .orElse(null);
    }

    private void assertAdmin(Long adminId) {
        AppUser admin = appUserRepository.findById(adminId)
                .orElseThrow(() -> new ApiBadRequestException("Admin user not found"));
        if (admin.getRole() != AppRole.ADMIN) {
            throw new ApiForbiddenException("Only admin can moderate project requests");
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
