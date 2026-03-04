package com.max.pract.project;

import com.max.pract.ApiResponse;
import com.max.pract.project.dto.CreateProjectRequestRequest;
import com.max.pract.project.dto.ModerateProjectRequestRequest;
import com.max.pract.security.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class ProjectRequestController {

    private final ProjectRequestService projectRequestService;

    public ProjectRequestController(ProjectRequestService projectRequestService) {
        this.projectRequestService = projectRequestService;
    }

    @PostMapping("/api/project-requests")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse createProjectRequest(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody CreateProjectRequestRequest request
    ) {
        return new ApiResponse("success", projectRequestService.create(principal.getUserId(), request));
    }

    @GetMapping("/api/project-requests/my")
    public ApiResponse listMyProjectRequests(@AuthenticationPrincipal AppUserPrincipal principal) {
        return new ApiResponse("success", projectRequestService.listMine(principal.getUserId()));
    }

    @GetMapping("/api/admin/project-requests")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse listAllProjectRequests() {
        return new ApiResponse("success", projectRequestService.listAll());
    }

    @PostMapping("/api/admin/project-requests/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse approveProjectRequest(
            @PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody(required = false) ModerateProjectRequestRequest request
    ) {
        String comment = request == null ? null : request.getComment();
        return new ApiResponse("success", projectRequestService.approve(id, principal.getUserId(), comment));
    }

    @PostMapping("/api/admin/project-requests/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse rejectProjectRequest(
            @PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody(required = false) ModerateProjectRequestRequest request
    ) {
        String comment = request == null ? null : request.getComment();
        return new ApiResponse("success", projectRequestService.reject(id, principal.getUserId(), comment));
    }

    @DeleteMapping("/api/admin/project-requests/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse deleteProjectRequest(
            @PathVariable Long id,
            @AuthenticationPrincipal AppUserPrincipal principal
    ) {
        return new ApiResponse("success", projectRequestService.delete(id, principal.getUserId()));
    }
}
