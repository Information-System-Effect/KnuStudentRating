package com.max.pract.contract;

import java.util.List;
import java.util.Map;

public record ContractRequest(
        String senderId,
        String targetId,
        ApiAction action,
        List<CategoryChange> changes,
        Map<String, String> queryParameters
) {
}
