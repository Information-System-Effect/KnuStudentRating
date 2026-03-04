package com.max.pract.admin;

import com.max.pract.ApiResponse;
import com.max.pract.admin.dto.UpdateUserRoleRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public ApiResponse listUsers() {
        return new ApiResponse("success", adminUserService.listUsers());
    }

    @GetMapping("/roles")
    public ApiResponse listRoles() {
        return new ApiResponse("success", adminUserService.listRoles());
    }

    @PutMapping("/{id}/role")
    public ApiResponse updateUserRole(@PathVariable Long id, @Valid @RequestBody UpdateUserRoleRequest request) {
        return new ApiResponse("success", adminUserService.updateRole(id, request.getRole()));
    }
}
