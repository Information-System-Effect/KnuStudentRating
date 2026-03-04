package com.max.pract.auth.dto;

public record AuthSessionResponse(
        String accessToken,
        String userCode,
        String role
) {
}
