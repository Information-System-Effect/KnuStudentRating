package com.max.pract;

import com.max.pract.auth.AppRole;
import com.max.pract.contract.CategoryChange;
import com.max.pract.contract.ChangeMode;
import com.max.pract.contract.ContractRequest;
import com.max.pract.contract.ContractRequestParser;
import com.max.pract.entity.AppUser;
import com.max.pract.profile.CategoryScoreService;
import com.max.pract.repo.AppUserRepository;
import com.max.pract.security.AppUserPrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RequestProcessorService {

    private static final String STUDENTS_QUERY_KEY = "STUDENTS";
    private static final String TEACHERS_QUERY_KEY = "TEACHERS";
    private static final String NO_TARGET = "_";

    private final ContractRequestParser contractRequestParser;
    private final AppUserRepository appUserRepository;
    private final CategoryScoreService categoryScoreService;
    private final JdbcTemplate jdbcTemplate;

    public RequestProcessorService(
            ContractRequestParser contractRequestParser,
            AppUserRepository appUserRepository,
            CategoryScoreService categoryScoreService,
            JdbcTemplate jdbcTemplate
    ) {
        this.contractRequestParser = contractRequestParser;
        this.appUserRepository = appUserRepository;
        this.categoryScoreService = categoryScoreService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public ApiResponse processCustomRequest(String payload) {
        try {
            ContractRequest request = contractRequestParser.parse(payload);
            validateSenderIdentity(request.senderId());
            return executeDatabaseOperation(request);
        } catch (IllegalArgumentException ex) {
            return new ApiResponse("error", ex.getMessage());
        }
    }

    private ApiResponse executeDatabaseOperation(ContractRequest request) {
        try {
            return switch (request.action()) {
                case PUT, PATCH -> handleUpdate(request.senderId(), request.targetId(), request.changes());
                case GET -> handleGet(request.targetId(), request.queryParameters());
                case DELETE -> handleDelete(request.senderId(), request.targetId(), request.changes());
            };
        } catch (Exception e) {
            return new ApiResponse("error", "Database error: " + e.getMessage());
        }
    }

    private ApiResponse handleUpdate(String senderCode, String targetCode, List<CategoryChange> changes) {
        if (changes == null || changes.isEmpty()) {
            return new ApiResponse("error", "At least one category change is required");
        }
        if (NO_TARGET.equals(targetCode)) {
            return new ApiResponse("error", "Target user is required for update operations");
        }
        if (!senderCode.equals(targetCode)) {
            return new ApiResponse(
                    "error",
                    "Cross-user updates are forbidden in gateway. Use /api/projects/{projectId}/reviews"
            );
        }
        GatewayUser targetUser = resolveUser(targetCode);
        for (CategoryChange change : changes) {
            Long categoryId = resolveCategoryId(change.categoryCode());
            categoryScoreService.upsertSelfDeclaredSkill(targetUser.id(), categoryId, change.mode(), change.value());
        }
        return new ApiResponse("success", "Self-declared scores updated for " + targetCode);
    }

    private Long resolveCategoryId(String categoryToken) {
        if (isNumeric(categoryToken)) {
            return Long.valueOf(categoryToken);
        }
        Long categoryId = jdbcTemplate.queryForObject(
                "SELECT id FROM categories WHERE code = ? OR name = ? LIMIT 1",
                Long.class,
                categoryToken,
                categoryToken
        );
        if (categoryId == null) {
            throw new IllegalArgumentException("Unknown category: " + categoryToken);
        }
        return categoryId;
    }

    private boolean isNumeric(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return !value.isEmpty();
    }

    public ApiResponse processStructuredRequest(DBRequest request) {
        if (request.getTargetId() == null || request.getAction() == null || request.getChanges() == null) {
            return new ApiResponse("error", "Invalid request: missing targetId, action or changes");
        }
        validateSenderIdentity(request.getSenderId());
        try {
            String action = request.getAction().trim().toUpperCase();
            if ("PUT".equals(action) || "PATCH".equals(action)) {
                List<CategoryChange> changes = request.getChanges().entrySet().stream()
                        .map(entry -> new CategoryChange(
                                entry.getKey(),
                                ChangeMode.SET,
                                parseLegacyValue(entry.getValue())
                        ))
                        .toList();
                return handleUpdate(request.getSenderId(), request.getTargetId(), changes);
            }
            if ("GET".equals(action)) {
                return handleGet(request.getTargetId(), Map.of());
            }
            if ("DELETE".equals(action)) {
                List<CategoryChange> changes = request.getChanges().entrySet().stream()
                        .map(entry -> new CategoryChange(entry.getKey(), ChangeMode.SET, 0))
                        .toList();
                return handleDelete(request.getSenderId(), request.getTargetId(), changes);
            }
            return new ApiResponse("error", "Unsupported action: " + action);
        } catch (Exception e) {
            return new ApiResponse("error", "Database error: " + e.getMessage());
        }
    }

    private ApiResponse handleGet(String targetCode, Map<String, String> queryParameters) {
        if (NO_TARGET.equals(targetCode)) {
            if (queryParameters.containsKey(STUDENTS_QUERY_KEY)) {
                Pagination pagination = parsePagination(queryParameters.get(STUDENTS_QUERY_KEY));
                return new ApiResponse("success", loadUsersByRoles(List.of(AppRole.STUDENT), pagination));
            }
            if (queryParameters.containsKey(TEACHERS_QUERY_KEY)) {
                Pagination pagination = parsePagination(queryParameters.get(TEACHERS_QUERY_KEY));
                return new ApiResponse("success", loadUsersByRoles(List.of(AppRole.TEACHER), pagination));
            }
            return new ApiResponse("error", "For target '_' supported queries are STUDENTS or TEACHERS");
        }
        GatewayUser targetUser = resolveUser(targetCode);
        return new ApiResponse("success", loadCategoryScores(targetUser.id()));
    }

    private ApiResponse handleDelete(String senderCode, String targetCode, List<CategoryChange> changes) {
        if (changes == null || changes.isEmpty()) {
            return new ApiResponse("error", "At least one category is required for delete");
        }
        if (NO_TARGET.equals(targetCode)) {
            return new ApiResponse("error", "Target user is required for delete operations");
        }
        if (!senderCode.equals(targetCode)) {
            return new ApiResponse(
                    "error",
                    "Cross-user delete is forbidden in gateway. Use moderation/review APIs"
            );
        }
        GatewayUser targetUser = resolveUser(targetCode);
        for (CategoryChange change : changes) {
            Long categoryId = resolveCategoryId(change.categoryCode());
            categoryScoreService.deleteSelfDeclaredSkill(targetUser.id(), categoryId);
        }
        return new ApiResponse("success", "Self-declared scores deleted for " + targetCode);
    }

    private Float parseLegacyValue(String rawValue) {
        if (rawValue.startsWith("+")) {
            return Float.parseFloat(rawValue.substring(1));
        }
        if (rawValue.startsWith("-")) {
            return Float.parseFloat(rawValue.substring(1)) * -1;
        }
        return Float.parseFloat(rawValue);
    }

    private void validateSenderIdentity(String senderId) {
        if (senderId == null || senderId.isBlank()) {
            return;
        }
        Object principal = getCurrentPrincipal();
        if (!(principal instanceof AppUserPrincipal appPrincipal)) {
            throw new IllegalArgumentException("Authenticated principal is not available");
        }
        if (!senderId.equals(appPrincipal.getUserCode())) {
            throw new IllegalArgumentException("Sender identity mismatch");
        }
    }

    private GatewayUser resolveUser(String userCode) {
        AppUser user = appUserRepository.findByCode(userCode)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userCode));
        return new GatewayUser(user.getId(), user.getCode(), user.getRole());
    }

    private Object getCurrentPrincipal() {
        return SecurityContextHolder.getContext().getAuthentication() == null
                ? null
                : SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private List<Map<String, Object>> loadUsersByRoles(List<AppRole> roles, Pagination pagination) {
        if (roles == null || roles.isEmpty()) {
            return List.of();
        }
        String placeholders = String.join(",", roles.stream().map(r -> "?").toList());
        Object[] args = new Object[roles.size() + 2];
        for (int i = 0; i < roles.size(); i++) {
            args[i] = roles.get(i).name();
        }
        args[roles.size()] = pagination.limit();
        args[roles.size() + 1] = pagination.offset();

        return jdbcTemplate.queryForList(
                """
                        SELECT code, role, full_name, institution, group_name
                        FROM users
                        WHERE role IN (%s)
                        ORDER BY full_name
                        LIMIT ? OFFSET ?
                        """.formatted(placeholders),
                args
        );
    }

    private List<Map<String, Object>> loadCategoryScores(Long userId) {
        return jdbcTemplate.queryForList(
                """
                        SELECT c.code AS category_code,
                               c.name AS category_name,
                               ct.audience AS audience,
                               ct.dimension AS dimension,
                               cs.score AS score,
                               cs.is_verified AS is_verified
                        FROM category_scores cs
                        JOIN categories c ON c.id = cs.category_id
                        JOIN category_types ct ON ct.id = c.category_type_id
                        WHERE cs.user_id = ?
                        ORDER BY c.code
                        """,
                userId
        );
    }

    private Pagination parsePagination(String rawOptions) {
        Map<String, String> options = parseQueryOptions(rawOptions);
        int page = parsePositiveInt(options.getOrDefault("page", "1"), 1);
        int limit = parsePositiveInt(options.getOrDefault("limit", "50"), 50);
        int normalizedLimit = Math.min(limit, 200);
        int offset = (page - 1) * normalizedLimit;
        return new Pagination(normalizedLimit, offset);
    }

    private Map<String, String> parseQueryOptions(String rawOptions) {
        Map<String, String> options = new HashMap<>();
        if (rawOptions == null || rawOptions.isBlank()) {
            return options;
        }
        String normalized = rawOptions.trim();
        if (normalized.startsWith("+")) {
            normalized = normalized.substring(1);
        }
        if (normalized.startsWith("\"") && normalized.endsWith("\"") && normalized.length() >= 2) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        for (String pair : normalized.split(";")) {
            String candidate = pair.trim();
            if (candidate.isEmpty()) {
                continue;
            }
            String[] keyValue = candidate.split("=", 2);
            if (keyValue.length == 2) {
                options.put(keyValue[0].trim().toLowerCase(), keyValue[1].trim());
            }
        }
        return options;
    }

    private int parsePositiveInt(String rawValue, int fallback) {
        try {
            int value = Integer.parseInt(rawValue);
            return value > 0 ? value : fallback;
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private record GatewayUser(Long id, String code, AppRole role) {
    }

    private record Pagination(int limit, int offset) {
    }
}
