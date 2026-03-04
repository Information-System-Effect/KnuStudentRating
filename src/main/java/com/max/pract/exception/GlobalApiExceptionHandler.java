package com.max.pract.exception;

import com.max.pract.ApiResponse;
import io.jsonwebtoken.JwtException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse onValidation(MethodArgumentNotValidException ex) {
        Map<String, String> details = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            details.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return new ApiResponse("error", Map.of("code", "VALIDATION_ERROR", "details", details));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse onConstraint(ConstraintViolationException ex) {
        return new ApiResponse("error", Map.of("code", "VALIDATION_ERROR", "message", ex.getMessage()));
    }

    @ExceptionHandler(ApiBadRequestException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse onBadRequest(ApiBadRequestException ex) {
        return new ApiResponse("error", Map.of("code", "BAD_REQUEST", "message", ex.getMessage()));
    }

    @ExceptionHandler(ApiUnauthorizedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse onUnauthorized(ApiUnauthorizedException ex) {
        return new ApiResponse("error", Map.of("code", "UNAUTHORIZED", "message", ex.getMessage()));
    }

    @ExceptionHandler(ApiForbiddenException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse onForbidden(ApiForbiddenException ex) {
        return new ApiResponse("error", Map.of("code", "FORBIDDEN", "message", ex.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse onAuthentication(AuthenticationException ex) {
        return new ApiResponse("error", Map.of("code", "UNAUTHORIZED", "message", "Invalid credentials"));
    }

    @ExceptionHandler(JwtException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse onJwt(JwtException ex) {
        return new ApiResponse("error", Map.of("code", "UNAUTHORIZED", "message", "Invalid token"));
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse onUnexpected(Exception ex) {
        return new ApiResponse("error", Map.of("code", "INTERNAL_ERROR", "message", "Unexpected server error"));
    }
}
