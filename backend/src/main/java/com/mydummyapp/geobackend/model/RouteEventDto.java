package com.mydummyapp.geobackend.model;

import java.util.List;

public record RouteEventDto(double longitude, double latitude, List<String> planKeys) {}
