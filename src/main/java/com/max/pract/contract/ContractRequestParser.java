package com.max.pract.contract;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Component
public class ContractRequestParser {

    private static final Pattern USER_CODE_PATTERN = Pattern.compile("^[UT]\\d+$");

    public ContractRequest parse(String payload) {
        if (payload == null || payload.isBlank()) {
            throw new IllegalArgumentException("Payload must not be empty");
        }

        String[] parts = payload.split("#");
        if (parts.length < 5) {
            throw new IllegalArgumentException("Invalid format: expected at least 5 parts");
        }

        String senderId = normalizeToken(parts[0]);
        String targetId = normalizeToken(parts[1]);
        ApiAction action = parseAction(parts[2]);

        validateSender(senderId);
        validateTarget(targetId);

        int tailItems = parts.length - 3;
        if (tailItems % 2 != 0) {
            throw new IllegalArgumentException("Invalid format: tail must contain key/value pairs");
        }

        if (action == ApiAction.GET) {
            return new ContractRequest(senderId, targetId, action, List.of(), parseQuery(parts));
        }
        if (action == ApiAction.DELETE) {
            return new ContractRequest(senderId, targetId, action, parseDeleteChanges(parts), Map.of());
        }

        return new ContractRequest(senderId, targetId, action, parseChanges(parts), Map.of());
    }

    private ApiAction parseAction(String rawAction) {
        try {
            return ApiAction.fromRaw(normalizeToken(rawAction));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unsupported action: " + rawAction);
        }
    }

    private void validateSender(String senderId) {
        if (!USER_CODE_PATTERN.matcher(senderId).matches()) {
            throw new IllegalArgumentException("Invalid senderId: " + senderId);
        }
    }

    private void validateTarget(String targetId) {
        if ("_".equals(targetId)) {
            return;
        }
        if (!USER_CODE_PATTERN.matcher(targetId).matches()) {
            throw new IllegalArgumentException("Invalid targetId: " + targetId);
        }
    }

    private List<CategoryChange> parseChanges(String[] parts) {
        List<CategoryChange> changes = new ArrayList<>();
        for (int i = 3; i < parts.length; i += 2) {
            String categoryCode = normalizeToken(parts[i]);
            String rawValue = normalizeToken(parts[i + 1]);
            changes.add(parseChange(categoryCode, rawValue));
        }
        return changes;
    }

    private CategoryChange parseChange(String categoryCode, String rawValue) {
        if (categoryCode.isBlank()) {
            throw new IllegalArgumentException("Category code must not be empty");
        }
        String upperValue = rawValue.toUpperCase(Locale.ROOT);
        if (upperValue.startsWith("SET:")) {
            float value = parseNumeric(rawValue.substring(4), rawValue);
            return new CategoryChange(categoryCode, ChangeMode.SET, value);
        }
        if (upperValue.startsWith("ADD:")) {
            float value = parseNumeric(rawValue.substring(4), rawValue);
            return new CategoryChange(categoryCode, ChangeMode.ADD, value);
        }

        // Backward compatibility with legacy payloads like +"5"/-"5"/"5".
        float legacyValue = parseNumeric(rawValue, rawValue);
        return new CategoryChange(categoryCode, ChangeMode.ADD, legacyValue);
    }

    private Map<String, String> parseQuery(String[] parts) {
        Map<String, String> query = new HashMap<>();
        for (int i = 3; i < parts.length; i += 2) {
            String key = normalizeToken(parts[i]);
            String value = normalizeToken(parts[i + 1]);
            query.put(key, value);
        }
        return query;
    }

    private List<CategoryChange> parseDeleteChanges(String[] parts) {
        List<CategoryChange> changes = new ArrayList<>();
        for (int i = 3; i < parts.length; i += 2) {
            String categoryCode = normalizeToken(parts[i]);
            if (categoryCode.isBlank()) {
                throw new IllegalArgumentException("Category code must not be empty");
            }
            // DELETE only needs category identifiers; value token is transport metadata.
            changes.add(new CategoryChange(categoryCode, ChangeMode.SET, 0));
        }
        return changes;
    }

    private float parseNumeric(String raw, String context) {
        String numeric = normalizeNumericToken(raw.trim());
        try {
            return Float.parseFloat(numeric);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Invalid numeric value: " + context);
        }
    }

    private String normalizeToken(String raw) {
        return stripWrappingQuotes(raw == null ? "" : raw.trim());
    }

    private String stripWrappingQuotes(String value) {
        if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private String normalizeNumericToken(String raw) {
        String candidate = stripWrappingQuotes(raw);
        if (candidate.length() >= 4
                && (candidate.startsWith("+\"") || candidate.startsWith("-\""))
                && candidate.endsWith("\"")) {
            return candidate.charAt(0) + candidate.substring(2, candidate.length() - 1);
        }
        return candidate;
    }
}
