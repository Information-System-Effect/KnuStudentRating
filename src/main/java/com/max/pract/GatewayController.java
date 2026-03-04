package com.max.pract;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class GatewayController {

    private final RequestProcessorService gatewayRequestProcessor;

    public GatewayController(RequestProcessorService gatewayRequestProcessor) {
        this.gatewayRequestProcessor = gatewayRequestProcessor;
    }

    @PostMapping(
            value = "/execute",
            consumes = MediaType.TEXT_PLAIN_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ApiResponse executeGatewayRequest(@RequestBody String rawPayload) {
        return gatewayRequestProcessor.processCustomRequest(rawPayload);
    }
}
