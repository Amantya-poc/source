package com.mydummyapp.geobackend.model;

import java.time.Instant;
import java.util.List;

public record CreatePlanRequest(
        String planeName, double speed, Instant startingDate, List<WaypointDto> route) {}
