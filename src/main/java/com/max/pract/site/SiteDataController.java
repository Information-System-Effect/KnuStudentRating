package com.max.pract.site;

import com.max.pract.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/site")
public class SiteDataController {

    private final SiteDataService siteDataService;

    public SiteDataController(SiteDataService siteDataService) {
        this.siteDataService = siteDataService;
    }

    @GetMapping("/home")
    public ApiResponse home() {
        return new ApiResponse("success", siteDataService.getHomeData());
    }

    @GetMapping("/projects/completed")
    public ApiResponse completedProjects() {
        return new ApiResponse("success", siteDataService.getCompletedProjects());
    }

    @GetMapping("/projects/requests")
    public ApiResponse projectRequests() {
        return new ApiResponse("success", siteDataService.getProjectRequests());
    }

    @GetMapping("/participants/students")
    public ApiResponse students() {
        return new ApiResponse("success", siteDataService.getStudents());
    }

    @GetMapping("/participants/teachers")
    public ApiResponse teachers() {
        return new ApiResponse("success", siteDataService.getTeachers());
    }

    @GetMapping("/projects/reviews")
    public ApiResponse recentReviews(@RequestParam(defaultValue = "50") int limit) {
        int normalizedLimit = Math.max(1, Math.min(limit, 200));
        return new ApiResponse("success", siteDataService.getRecentProjectReviews(normalizedLimit));
    }

    @GetMapping("/participants/{code}/rating")
    public ApiResponse participantRating(@PathVariable String code) {
        return new ApiResponse("success", siteDataService.getParticipantRating(code));
    }

    @GetMapping("/participants/{code}/reviews")
    public ApiResponse participantReviews(
            @PathVariable String code,
            @RequestParam(defaultValue = "30") int limit
    ) {
        int normalizedLimit = Math.max(1, Math.min(limit, 200));
        return new ApiResponse("success", siteDataService.getParticipantReviews(code, normalizedLimit));
    }

    @GetMapping("/participants/{code}/categories")
    public ApiResponse participantCategories(@PathVariable String code) {
        return new ApiResponse("success", siteDataService.getParticipantCategories(code));
    }
}
