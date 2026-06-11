package com.mydummyapp.geobackend.model;

import java.util.List;

public record CreateDeployAreaRequest(
        String id,
        double longitude,
        double latitude,
        double radiusX,
        double radiusY,
        double rotation,
        List<WaypointDto> vertices) {}
