package com.max.pract.project;

import com.max.pract.auth.AppRole;
import com.max.pract.entity.AppUser;
import com.max.pract.entity.ProjectRequestEntity;
import com.max.pract.exception.ApiForbiddenException;
import com.max.pract.project.dto.CreateProjectRequestRequest;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.repo.ProjectRepository;
import com.max.pract.repo.ProjectRequestRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectRequestServiceTest {

    @Mock
    private ProjectRequestRepository projectRequestRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private AppUserRepository appUserRepository;

    @InjectMocks
    private ProjectRequestService projectRequestService;

    @Test
    void createAllowsTeacherAuthor() {
        AppUser teacher = new AppUser();
        ReflectionTestUtils.setField(teacher, "id", 42L);
        teacher.setRole(AppRole.TEACHER);

        when(appUserRepository.findById(42L)).thenReturn(Optional.of(teacher));
        when(projectRequestRepository.save(any(ProjectRequestEntity.class))).thenAnswer(invocation -> {
            ProjectRequestEntity entity = invocation.getArgument(0);
            ReflectionTestUtils.setField(entity, "id", 501L);
            return entity;
        });

        CreateProjectRequestRequest request = new CreateProjectRequestRequest();
        request.setTitle("Teacher project");
        request.setDescription("Requested by teacher");

        var response = projectRequestService.create(42L, request);

        assertEquals(42L, response.authorUserId());
        assertEquals("PENDING", response.status());
        assertEquals("Teacher project", response.title());
    }

    @Test
    void createRejectsAdminAuthor() {
        AppUser admin = new AppUser();
        ReflectionTestUtils.setField(admin, "id", 7L);
        admin.setRole(AppRole.ADMIN);

        when(appUserRepository.findById(7L)).thenReturn(Optional.of(admin));

        CreateProjectRequestRequest request = new CreateProjectRequestRequest();
        request.setTitle("Admin project");
        request.setDescription("Should be rejected");

        assertThrows(ApiForbiddenException.class, () -> projectRequestService.create(7L, request));
    }

    @Test
    void approveDoesNotCreateProjectAutomatically() {
        AppUser admin = new AppUser();
        ReflectionTestUtils.setField(admin, "id", 9L);
        admin.setRole(AppRole.ADMIN);

        ProjectRequestEntity projectRequest = new ProjectRequestEntity();
        ReflectionTestUtils.setField(projectRequest, "id", 33L);
        projectRequest.setStatus(ProjectRequestStatus.PENDING);
        projectRequest.setAuthorUserId(42L);
        projectRequest.setTitle("Approved later");

        when(appUserRepository.findById(9L)).thenReturn(Optional.of(admin));
        when(projectRequestRepository.findById(33L)).thenReturn(Optional.of(projectRequest));
        when(projectRequestRepository.save(any(ProjectRequestEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(projectRepository.findByCreatedFromRequestId(33L)).thenReturn(Optional.empty());

        var response = projectRequestService.approve(33L, 9L, "Ready for project setup");

        assertEquals("APPROVED", response.status());
        assertNull(response.createdProjectId());
        verify(projectRepository, never()).existsByCreatedFromRequestId(33L);
    }
}
