package com.max.pract.auth;

import com.max.pract.auth.dto.AuthTokensResponse;
import com.max.pract.auth.dto.LoginRequest;
import com.max.pract.auth.dto.RegisterRequest;
import com.max.pract.entity.AppUser;
import com.max.pract.entity.AuthRefreshToken;
import com.max.pract.exception.ApiBadRequestException;
import com.max.pract.exception.ApiUnauthorizedException;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.repo.AuthRefreshTokenRepository;
import com.max.pract.security.AppUserPrincipal;
import com.max.pract.security.JwtService;
import io.jsonwebtoken.Claims;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final AuthRefreshTokenRepository authRefreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(
            AppUserRepository appUserRepository,
            AuthRefreshTokenRepository authRefreshTokenRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService
    ) {
        this.appUserRepository = appUserRepository;
        this.authRefreshTokenRepository = authRefreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    public AuthTokensResponse registerStudent(RegisterRequest request) {
        AppUser user = registerUser(request, AppRole.STUDENT);
        return issueTokens(user, UUID.randomUUID().toString(), null, null);
    }

    public AuthTokensResponse registerTeacher(RegisterRequest request) {
        AppUser user = registerUser(request, AppRole.TEACHER);
        return issueTokens(user, UUID.randomUUID().toString(), null, null);
    }

    public AuthTokensResponse login(LoginRequest request, String clientIp, String clientUserAgent) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        var authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalizedEmail, request.getPassword())
        );
        AppUserPrincipal principal = (AppUserPrincipal) authentication.getPrincipal();
        AppUser user = appUserRepository.findById(principal.getUserId())
                .orElseThrow(() -> new ApiUnauthorizedException("User not found"));
        return issueTokens(user, UUID.randomUUID().toString(), clientIp, clientUserAgent);
    }

    public AuthTokensResponse refresh(String refreshToken, String clientIp, String clientUserAgent) {
        if (isBlank(refreshToken)) {
            throw new ApiBadRequestException("Refresh token is required");
        }
        String token = refreshToken.trim();
        Claims claims = jwtService.parseAndValidateRefreshToken(token);

        String tokenJti = claims.getId();
        Long userId = Long.valueOf(claims.getSubject());
        String familyId = claims.get("familyId", String.class);

        AuthRefreshToken stored = authRefreshTokenRepository.findByTokenJti(tokenJti)
                .orElseThrow(() -> new ApiUnauthorizedException("Refresh token is not recognized"));

        if (stored.getRevokedAt() != null || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiUnauthorizedException("Refresh token is expired or revoked");
        }
        if (!stored.getTokenHash().equals(hashToken(token))) {
            throw new ApiUnauthorizedException("Refresh token hash mismatch");
        }

        String newJti = UUID.randomUUID().toString();
        stored.setRevokedAt(Instant.now());
        stored.setRevokedReason("rotated");
        stored.setReplacedByJti(newJti);
        authRefreshTokenRepository.save(stored);

        AppUser user = appUserRepository.findById(userId)
                .orElseThrow(() -> new ApiUnauthorizedException("User not found"));
        Integer tokenVersion = claims.get("tokenVersion", Integer.class);
        if (!user.getTokenVersion().equals(tokenVersion)) {
            throw new ApiUnauthorizedException("Token is no longer valid");
        }
        return issueTokens(user, familyId, clientIp, clientUserAgent, newJti);
    }

    public void logout(Long userId) {
        authRefreshTokenRepository.revokeAllActiveByUserId(userId, Instant.now(), "logout", Instant.now());
    }

    private AuthTokensResponse issueTokens(AppUser user, String familyId, String clientIp, String clientUserAgent) {
        return issueTokens(user, familyId, clientIp, clientUserAgent, UUID.randomUUID().toString());
    }

    private AuthTokensResponse issueTokens(
            AppUser user,
            String familyId,
            String clientIp,
            String clientUserAgent,
            String refreshJti
    ) {
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user, refreshJti, familyId);

        AuthRefreshToken stored = new AuthRefreshToken();
        stored.setTokenJti(refreshJti);
        stored.setUserId(user.getId());
        stored.setTokenHash(hashToken(refreshToken));
        stored.setFamilyId(familyId);
        stored.setExpiresAt(Instant.now().plusSeconds(jwtService.getRefreshTtlSeconds()));
        stored.setCreatedIp(trimNullable(clientIp));
        stored.setCreatedUserAgent(trimNullable(clientUserAgent));
        authRefreshTokenRepository.save(stored);

        return new AuthTokensResponse(accessToken, refreshToken, user.getCode(), user.getRole().name());
    }

    private void validateRegistrationRequest(RegisterRequest request) {
        if (request == null || isBlank(request.getEmail()) || isBlank(request.getPassword()) || isBlank(request.getFullName())) {
            throw new ApiBadRequestException("Email, password and fullName are required");
        }
        if (request.getPassword().length() < 8) {
            throw new ApiBadRequestException("Password must contain at least 8 characters");
        }
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to hash refresh token", ex);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            throw new ApiBadRequestException("Email is required");
        }
        return email.trim().toLowerCase();
    }

    private String buildTemporaryUserCode() {
        return "TMP_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private AppUser registerUser(RegisterRequest request, AppRole role) {
        validateRegistrationRequest(request);
        String normalizedEmail = normalizeEmail(request.getEmail());
        if (appUserRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ApiBadRequestException("Email is already in use");
        }

        AppUser user = new AppUser();
        user.setCode(buildTemporaryUserCode());
        user.setRole(role);
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName().trim());
        user.setInstitution(trimNullable(request.getInstitution()));
        user.setGroupName(trimNullable(request.getGroupName()));
        user.setAbout(trimNullable(request.getAbout()));
        user = appUserRepository.save(user);

        String prefix = switch (role) {
            case TEACHER -> "T";
            default -> "U";
        };
        user.setCode(prefix + user.getId());
        return appUserRepository.save(user);
    }

    private String trimNullable(String value) {
        return value == null ? null : value.trim();
    }
}
