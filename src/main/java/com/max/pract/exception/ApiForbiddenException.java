package com.max.pract.exception;

public class ApiForbiddenException extends RuntimeException {
    public ApiForbiddenException(String message) {
        super(message);
    }
}
