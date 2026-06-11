package com.mydummyapp.geobackend.controller;

import com.mydummyapp.geobackend.model.CreatePlanRequest;
import com.mydummyapp.geobackend.model.DashboardDto;
import com.mydummyapp.geobackend.model.PlanDto;
import com.mydummyapp.geobackend.model.TimelineSettingsDto;
import com.mydummyapp.geobackend.service.PlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/plans")
@CrossOrigin(origins = "http://localhost:4200")
@Tag(name = "Plans", description = "Create, list, and clear mission plans stored in drdo_poc")
public class PlanController {

    private final PlanService planService;

    public PlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping
    @Operation(summary = "List all saved plans", description = "Returns up to 3 plans ordered by sort_order.")
    @ApiResponse(responseCode = "200", description = "Plans returned successfully")
    public List<PlanDto> listPlans() {
        return planService.listPlans();
    }

    @GetMapping("/dashboard")
    @Operation(
            summary = "Load output dashboard snapshot",
            description = "Returns all plans plus computed route intersection events in one response.")
    @ApiResponse(responseCode = "200", description = "Dashboard payload returned successfully")
    public DashboardDto dashboard() {
        return planService.getDashboard();
    }

    @GetMapping("/timeline")
    @Operation(
            summary = "Get mission timeline bounds",
            description = "Returns slider start/end times derived from saved plan schedules and fuel limits.")
    @ApiResponse(responseCode = "200", description = "Timeline settings returned successfully")
    public TimelineSettingsDto getTimelineSettings() {
        return planService.getTimelineSettings();
    }

    @PostMapping
    @Operation(summary = "Save a new plan", description = "Persists plan parameters and route waypoints to PostgreSQL.")
    @ApiResponse(responseCode = "200", description = "Plan created successfully")
    @ApiResponse(responseCode = "409", description = "Maximum plan limit reached")
    public PlanDto createPlan(@RequestBody CreatePlanRequest request) {
        return planService.createPlan(request);
    }

    @DeleteMapping
    @Operation(summary = "Delete all plans", description = "Removes every row from the plans table.")
    @ApiResponse(responseCode = "200", description = "All plans deleted")
    public void deleteAllPlans() {
        planService.deleteAllPlans();
    }
}
