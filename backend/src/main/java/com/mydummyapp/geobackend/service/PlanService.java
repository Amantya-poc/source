package com.mydummyapp.geobackend.service;

import com.mydummyapp.geobackend.entity.PlanEntity;
import com.mydummyapp.geobackend.model.CreatePlanRequest;
import com.mydummyapp.geobackend.model.DashboardDto;
import com.mydummyapp.geobackend.model.PlanDto;
import com.mydummyapp.geobackend.model.TimelineSettingsDto;
import com.mydummyapp.geobackend.repository.PlanRepository;
import com.mydummyapp.geobackend.util.PlanTimelineUtil;
import com.mydummyapp.geobackend.util.RouteDistanceUtil;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlanService {

    private static final int MAX_PLANS = 3;
    private static final String MARKER_SHAPE = "arrow";

    private final PlanRepository planRepository;
    private final RouteIntersectionService routeIntersectionService;
    private final TimelineService timelineService;

    public PlanService(
            PlanRepository planRepository,
            RouteIntersectionService routeIntersectionService,
            TimelineService timelineService) {
        this.planRepository = planRepository;
        this.routeIntersectionService = routeIntersectionService;
        this.timelineService = timelineService;
    }

    @Transactional(readOnly = true)
    public List<PlanDto> listPlans() {
        return planRepository.findAllByOrderBySortOrderAsc().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public DashboardDto getDashboard() {
        List<PlanDto> plans = listPlans();
        TimelineSettingsDto timeline = timelineService.getTimelineSettings();
        return new DashboardDto(plans, routeIntersectionService.findIntersections(plans), timeline);
    }

    @Transactional(readOnly = true)
    public TimelineSettingsDto getTimelineSettings() {
        return timelineService.getTimelineSettings();
    }

    @Transactional
    public PlanDto createPlan(CreatePlanRequest request) {
        validateCreateRequest(request);

        long existingCount = planRepository.count();
        if (existingCount >= MAX_PLANS) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Maximum of " + MAX_PLANS + " plans already saved");
        }

        PlanEntity entity = new PlanEntity();
        entity.setPlanKey("plan" + (existingCount + 1));
        entity.setPlaneName(request.planeName());
        entity.setSpeed(request.speed());
        entity.setStartingDate(request.startingDate());
        entity.setMarkerShape(MARKER_SHAPE);
        entity.setSortOrder((int) existingCount);
        entity.setRouteWaypoints(request.route());
        entity.setDistanceMeters(RouteDistanceUtil.routeLengthMeters(request.route()));

        PlanDto saved = toDto(planRepository.save(entity));
        timelineService.recalculateFromPlans();
        return saved;
    }

    @Transactional
    public void deleteAllPlans() {
        planRepository.deleteAllInBatch();
        timelineService.recalculateFromPlans();
    }

    private PlanDto toDto(PlanEntity entity) {
        return new PlanDto(
                entity.getPlanKey(),
                entity.getPlaneName(),
                entity.getSpeed(),
                entity.getStartingDate(),
                entity.getMarkerShape(),
                entity.getRouteWaypoints(),
                entity.getDistanceMeters(),
                PlanTimelineUtil.travelDurationMsForPlan(
                        entity.getDistanceMeters(), entity.getSpeed()));
    }

    private void validateCreateRequest(CreatePlanRequest request) {
        if (request.planeName() == null || request.planeName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "planeName is required");
        }

        if (request.speed() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "speed must be greater than 0");
        }

        if (request.startingDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startingDate is required");
        }

        if (request.route() == null || request.route().size() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "route must contain at least 2 waypoints");
        }
    }
}
