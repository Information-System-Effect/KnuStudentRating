package com.max.pract.auth.dto;

public record AuthTokensResponse(
        String accessToken,
        String refreshToken,
        String userCode,
        String role
) {
}
