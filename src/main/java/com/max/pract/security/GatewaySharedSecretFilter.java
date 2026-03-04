package com.max.pract.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class GatewaySharedSecretFilter extends OncePerRequestFilter {

    private final String sharedSecret;
    private final String secretHeaderName;

    public GatewaySharedSecretFilter(
            @Value("${app.gateway.shared-secret:}") String sharedSecret,
            @Value("${app.gateway.shared-secret-header:X-Gateway-Secret}") String secretHeaderName
    ) {
        this.sharedSecret = sharedSecret;
        this.secretHeaderName = secretHeaderName;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path == null || !path.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (sharedSecret == null || sharedSecret.isBlank()) {
            writeError(response, HttpServletResponse.SC_SERVICE_UNAVAILABLE, "GATEWAY_SECRET_NOT_CONFIGURED", "Gateway shared secret is not configured");
            return;
        }

        String actualSecret = request.getHeader(secretHeaderName);
        if (actualSecret == null || !isEqual(sharedSecret, actualSecret)) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN", "Gateway access required");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isEqual(String expected, String actual) {
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] actualBytes = actual.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expectedBytes, actualBytes);
    }

    private void writeError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String body = "{\"status\":\"error\",\"data\":{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}}";
        response.getWriter().write(body);
    }
}
