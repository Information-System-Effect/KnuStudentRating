package com.max.pract.profile;

import com.max.pract.ApiResponse;
import com.max.pract.auth.AppRole;
import com.max.pract.profile.dto.DeclareSelfSkillsRequest;
import com.max.pract.profile.dto.UpsertSelfSkillRequest;
import com.max.pract.profile.dto.UpdateParticipantProfileRequest;
import com.max.pract.security.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/participants")
public class ParticipantProfileController {

    private final ParticipantProfileService participantProfileService;

    public ParticipantProfileController(ParticipantProfileService participantProfileService) {
        this.participantProfileService = participantProfileService;
    }

    @GetMapping("/me")
    public ApiResponse getMyProfile(@AuthenticationPrincipal AppUserPrincipal principal) {
        return new ApiResponse("success", participantProfileService.getById(principal.getUserId()));
    }

    @GetMapping("/me/rating")
    public ApiResponse getMyRating(@AuthenticationPrincipal AppUserPrincipal principal) {
        return new ApiResponse("success", participantProfileService.getRatingById(principal.getUserId()));
    }

    @PutMapping("/me")
    public ApiResponse updateMyProfile(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody UpdateParticipantProfileRequest request
    ) {
        return new ApiResponse("success", participantProfileService.updateOwnProfile(principal.getUserId(), request));
    }

    @PostMapping(value = "/me/photo", consumes = "multipart/form-data")
    public ApiResponse uploadMyPhoto(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestPart("file") MultipartFile file
    ) {
        return new ApiResponse("success", participantProfileService.uploadOwnPhoto(principal.getUserId(), file));
    }

    @PostMapping("/me/self-skills")
    public ApiResponse declareSelfSkills(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody DeclareSelfSkillsRequest request
    ) {
        return new ApiResponse("success",
                participantProfileService.declareSelfSkills(principal.getUserId(), request.getSkills()));
    }

    @GetMapping("/me/self-skills/options")
    public ApiResponse listMySelfSkillOptions(@AuthenticationPrincipal AppUserPrincipal principal) {
        return new ApiResponse("success", participantProfileService.listSelfSkillOptions(principal.getUserId()));
    }

    @PutMapping("/me/self-skills/{categoryId}")
    public ApiResponse upsertSelfSkill(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long categoryId,
            @Valid @RequestBody UpsertSelfSkillRequest request
    ) {
        return new ApiResponse("success",
                participantProfileService.upsertOwnSelfSkill(principal.getUserId(), categoryId, request.getScore()));
    }

    @DeleteMapping("/me/self-skills/{categoryId}")
    public ApiResponse deleteSelfSkill(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long categoryId
    ) {
        return new ApiResponse("success",
                participantProfileService.deleteOwnSelfSkill(principal.getUserId(), categoryId));
    }

    @GetMapping("/students")
    public ApiResponse listStudents() {
        return new ApiResponse("success", participantProfileService.listByRole(AppRole.STUDENT));
    }

    @GetMapping("/teachers")
    public ApiResponse listTeachers() {
        return new ApiResponse("success",
                participantProfileService.listByRoles(List.of(AppRole.TEACHER, AppRole.POSTGRADUATE)));
    }

    @GetMapping("/postgraduates")
    public ApiResponse listPostgraduates() {
        return new ApiResponse("success", participantProfileService.listByRole(AppRole.POSTGRADUATE));
    }

    @GetMapping("/{code}")
    public ApiResponse getProfileByCode(@PathVariable String code) {
        return new ApiResponse("success", participantProfileService.getByCode(code));
    }

    @GetMapping("/{code}/rating")
    public ApiResponse getRatingByCode(@PathVariable String code) {
        return new ApiResponse("success", participantProfileService.getRatingByCode(code));
    }

    @PutMapping("/teachers/{code}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse updateTeacherProfile(
            @PathVariable String code,
            @Valid @RequestBody UpdateParticipantProfileRequest request
    ) {
        return new ApiResponse("success", participantProfileService.updateTeacherProfile(code, request));
    }
}
