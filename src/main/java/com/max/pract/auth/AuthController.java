package com.max.pract.auth;

import com.max.pract.ApiResponse;
import com.max.pract.auth.dto.AuthSessionResponse;
import com.max.pract.auth.dto.AuthTokensResponse;
import com.max.pract.auth.dto.LoginRequest;
import com.max.pract.auth.dto.RefreshRequest;
import com.max.pract.auth.dto.RegisterRequest;
import jakarta.servlet.http.HttpServletResponse;
import com.max.pract.security.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final String refreshCookieName;
    private final boolean refreshCookieSecure;
    private final String refreshCookieSameSite;
    private final String refreshCookiePath;
    private final long refreshTtlSeconds;

    public AuthController(
            AuthService authService,
            @Value("${app.auth.refresh-cookie-name}") String refreshCookieName,
            @Value("${app.auth.refresh-cookie-secure}") boolean refreshCookieSecure,
            @Value("${app.auth.refresh-cookie-same-site}") String refreshCookieSameSite,
            @Value("${app.auth.refresh-cookie-path}") String refreshCookiePath,
            @Value("${app.jwt.refresh-ttl-seconds}") long refreshTtlSeconds
    ) {
        this.authService = authService;
        this.refreshCookieName = refreshCookieName;
        this.refreshCookieSecure = refreshCookieSecure;
        this.refreshCookieSameSite = refreshCookieSameSite;
        this.refreshCookiePath = refreshCookiePath;
        this.refreshTtlSeconds = refreshTtlSeconds;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthTokensResponse tokens = authService.registerStudent(request);
        return buildAuthResponse(tokens);
    }

    @PostMapping("/register/teacher")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse> registerTeacher(@Valid @RequestBody RegisterRequest request) {
        AuthTokensResponse tokens = authService.registerTeacher(request);
        return buildAuthResponse(tokens);
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse> login(
            @Valid @RequestBody LoginRequest request,
            @RequestHeader(value = "X-Forwarded-For", required = false) String clientIp,
            @RequestHeader(value = "User-Agent", required = false) String clientUserAgent
    ) {
        AuthTokensResponse tokens = authService.login(request, clientIp, clientUserAgent);
        return buildAuthResponse(tokens);
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse> refresh(
            @RequestBody(required = false) RefreshRequest request,
            @CookieValue(name = "${app.auth.refresh-cookie-name}", required = false) String refreshCookieToken,
            @RequestHeader(value = "X-Forwarded-For", required = false) String clientIp,
            @RequestHeader(value = "User-Agent", required = false) String clientUserAgent
    ) {
        String requestToken = request == null ? null : request.getRefreshToken();
        String effectiveToken = requestToken != null && !requestToken.isBlank() ? requestToken : refreshCookieToken;
        AuthTokensResponse tokens = authService.refresh(effectiveToken, clientIp, clientUserAgent);
        return buildAuthResponse(tokens);
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse> logout(@AuthenticationPrincipal AppUserPrincipal principal) {
        authService.logout(principal.getUserId());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildClearedRefreshCookie().toString())
                .body(new ApiResponse("success", "Logged out"));
    }

    @GetMapping("/me")
    public ApiResponse me(@AuthenticationPrincipal AppUserPrincipal principal) {
        List<String> roles = principal.getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        return new ApiResponse("success", Map.of(
                "userId", principal.getUserId(),
                "userCode", principal.getUserCode(),
                "roles", roles
        ));
    }

    private ResponseEntity<ApiResponse> buildAuthResponse(AuthTokensResponse tokens) {
        AuthSessionResponse session = new AuthSessionResponse(
                tokens.accessToken(),
                tokens.userCode(),
                tokens.role()
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(tokens.refreshToken()).toString())
                .body(new ApiResponse("success", session));
    }

    private ResponseCookie buildRefreshCookie(String refreshToken) {
        return ResponseCookie.from(refreshCookieName, refreshToken)
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite(refreshCookieSameSite)
                .path(refreshCookiePath)
                .maxAge(refreshTtlSeconds)
                .build();
    }

    private ResponseCookie buildClearedRefreshCookie() {
        return ResponseCookie.from(refreshCookieName, "")
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite(refreshCookieSameSite)
                .path(refreshCookiePath)
                .maxAge(0)
                .build();
    }
}
