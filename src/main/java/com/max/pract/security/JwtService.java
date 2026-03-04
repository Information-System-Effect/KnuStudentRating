package com.max.pract.security;

import com.max.pract.entity.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {

    private final SecretKey signingKey;
    private final long accessTtlSeconds;
    private final long refreshTtlSeconds;
    private final String issuer;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-ttl-seconds}") long accessTtlSeconds,
            @Value("${app.jwt.refresh-ttl-seconds}") long refreshTtlSeconds,
            @Value("${app.jwt.issuer}") String issuer
    ) {
        this.signingKey = deriveKey(secret);
        this.accessTtlSeconds = accessTtlSeconds;
        this.refreshTtlSeconds = refreshTtlSeconds;
        this.issuer = issuer;
    }

    public String generateAccessToken(AppUser user) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(accessTtlSeconds);
        String jti = UUID.randomUUID().toString();
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .id(jti)
                .issuer(issuer)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .claims(Map.of(
                        "code", user.getCode(),
                        "roles", List.of("ROLE_" + user.getRole().name()),
                        "tokenVersion", user.getTokenVersion(),
                        "type", "access"
                ))
                .signWith(signingKey)
                .compact();
    }

    public String generateRefreshToken(AppUser user, String tokenJti, String familyId) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(refreshTtlSeconds);
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .id(tokenJti)
                .issuer(issuer)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .claims(Map.of(
                        "code", user.getCode(),
                        "roles", List.of("ROLE_" + user.getRole().name()),
                        "tokenVersion", user.getTokenVersion(),
                        "familyId", familyId,
                        "type", "refresh"
                ))
                .signWith(signingKey)
                .compact();
    }

    public Claims parseClaims(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        if (!issuer.equals(claims.getIssuer())) {
            throw new io.jsonwebtoken.JwtException("Invalid token issuer");
        }
        return claims;
    }

    public Claims parseAndValidateAccessToken(String token) {
        Claims claims = parseClaims(token);
        validateTokenType(claims, "access");
        return claims;
    }

    public Claims parseAndValidateRefreshToken(String token) {
        Claims claims = parseClaims(token);
        validateTokenType(claims, "refresh");
        return claims;
    }

    public long getRefreshTtlSeconds() {
        return refreshTtlSeconds;
    }

    private SecretKey deriveKey(String secret) {
        try {
            if (secret == null || secret.isBlank() || "replace-this-secret-in-env".equals(secret)) {
                throw new IllegalStateException("JWT secret must be provided via environment");
            }
            if (secret.startsWith("base64:")) {
                byte[] decoded = Decoders.BASE64.decode(secret.substring("base64:".length()));
                if (decoded.length < 32) {
                    throw new IllegalStateException("JWT secret is too short; expected at least 256-bit key");
                }
                return Keys.hmacShaKeyFor(decoded);
            }
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(secret.getBytes(StandardCharsets.UTF_8));
            return Keys.hmacShaKeyFor(hashed);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to initialize JWT signing key", ex);
        }
    }

    private void validateTokenType(Claims claims, String expectedType) {
        String tokenType = claims.get("type", String.class);
        if (!expectedType.equals(tokenType)) {
            throw new io.jsonwebtoken.JwtException("Invalid token type");
        }
    }
}
