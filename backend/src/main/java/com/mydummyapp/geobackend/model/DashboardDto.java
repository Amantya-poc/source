package com.mydummyapp.geobackend.model;

import java.util.List;

public record DashboardDto(
        List<PlanDto> plans, List<RouteEventDto> routeEvents, TimelineSettingsDto timeline) {}
