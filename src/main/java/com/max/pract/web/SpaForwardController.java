package com.max.pract.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    private static final String INDEX_FORWARD = "forward:/index.html";

    @GetMapping({"/", "/site", "/site/**"})
    public String forwardToIndex() {
        return INDEX_FORWARD;
    }
}
