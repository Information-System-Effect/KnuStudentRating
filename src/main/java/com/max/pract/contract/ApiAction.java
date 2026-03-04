package com.max.pract.contract;

public enum ApiAction {
    GET,
    PUT,
    PATCH,
    DELETE;

    public static ApiAction fromRaw(String raw) {
        return ApiAction.valueOf(raw.trim().toUpperCase());
    }
}
