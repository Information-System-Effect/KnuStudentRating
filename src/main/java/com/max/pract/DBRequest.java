package com.max.pract;

import lombok.Data;
import java.util.Map;

@Data
public class DBRequest {
    private String senderId;
    private String targetId;
    private String action;
    private Map<String, String> changes;
}
