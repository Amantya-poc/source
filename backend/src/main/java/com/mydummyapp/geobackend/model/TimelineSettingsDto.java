package com.mydummyapp.geobackend.model;

import java.time.Instant;

public record TimelineSettingsDto(Instant sliderStartTime, Instant sliderEndTime) {}
