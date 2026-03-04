package com.max.pract.project;

import com.max.pract.ApiResponse;
import com.max.pract.project.dto.CreateProjectRequest;
import com.max.pract.project.dto.CreateProjectFromRequestBody;
import com.max.pract.project.dto.UpdateProjectLifecycleRequest;
import com.max.pract.project.dto.UpsertProjectMemberRequest;
import com.max.pract.security.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    @PostMapping("/api/projects")
    public ApiResponse createProject(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody CreateProjectRequest request
    ) {
        return new ApiResponse("success", projectService.createDirect(principal.getUserId(), request));
    }

    @PostMapping("/api/admin/projects/from-request/{requestId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse createProjectFromRequest(
            @PathVariable Long requestId,
            @Valid @RequestBody CreateProjectFromRequestBody request
    ) {
        return new ApiResponse("success", projectService.createFromApprovedRequest(requestId, request));
    }

    @GetMapping("/api/projects")
    public ApiResponse listProjects() {
        return new ApiResponse("success", projectService.listProjects());
    }

    @GetMapping("/api/projects/{id}")
    public ApiResponse getProject(@PathVariable Long id) {
        return new ApiResponse("success", projectService.getProject(id));
    }

    @PutMapping("/api/admin/projects/{id}/lifecycle")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse updateProjectLifecycle(
            @PathVariable Long id,
            @RequestBody UpdateProjectLifecycleRequest request
    ) {
        return new ApiResponse("success", projectService.updateLifecycle(id, request));
    }

    @PutMapping("/api/admin/projects/{id}/members")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse upsertProjectMember(
            @PathVariable Long id,
            @Valid @RequestBody UpsertProjectMemberRequest request
    ) {
        return new ApiResponse("success", projectService.upsertMember(id, request));
    }

    @DeleteMapping("/api/admin/projects/{id}/members/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse removeProjectMember(@PathVariable Long id, @PathVariable Long userId) {
        return new ApiResponse("success", projectService.removeMember(id, userId));
    }

    @DeleteMapping("/api/admin/projects/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse deleteProject(@PathVariable Long id) {
        return new ApiResponse("success", projectService.deleteProject(id));
    }

    @DeleteMapping("/api/admin/projects/{id}/purge")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse purgeProject(@PathVariable Long id) {
        return new ApiResponse("success", projectService.purgeProject(id));
    }
}
