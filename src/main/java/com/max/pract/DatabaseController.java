package com.max.pract;


import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api")
public class DatabaseController {

    private final RequestProcessorService gatewayRequestProcessor;

    public DatabaseController(RequestProcessorService gatewayRequestProcessor) {
        this.gatewayRequestProcessor = gatewayRequestProcessor;
    }

    @PostMapping("/modify")
    public ApiResponse modifyStructuredRequest(@RequestBody DBRequest request) {
        return gatewayRequestProcessor.processStructuredRequest(request);
    }
}
