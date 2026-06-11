package com.mydummyapp.geobackend.model;

import java.time.Instant;
import java.util.List;

public record PlanDto(
        String key,
        String planeName,
        double speed,
        Instant startingDate,
        String markerShape,
        List<WaypointDto> route,
        double distanceMeters,
        long travelDurationMs) {}
