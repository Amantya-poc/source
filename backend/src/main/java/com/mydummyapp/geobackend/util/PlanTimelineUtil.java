package com.mydummyapp.geobackend.util;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class PlanTimelineUtil {

    private static final double FUEL_CAPACITY_MINUTES = 1000;

    private PlanTimelineUtil() {}

    public static double travelMinutesForPlan(double distanceMeters, double speedKmh) {
        double speedMs = Math.max(speedKmh, 1.0) * (1000.0 / 3600.0);
        double travelMinutes = distanceMeters / speedMs / 60.0;
        return Math.min(travelMinutes, FUEL_CAPACITY_MINUTES);
    }

    public static long travelDurationMsForPlan(double distanceMeters, double speedKmh) {
        return Math.round(travelMinutesForPlan(distanceMeters, speedKmh) * 60_000.0);
    }

    public static Instant planEndTime(Instant startingDate, double distanceMeters, double speedKmh) {
        long durationMinutes = (long) Math.ceil(travelMinutesForPlan(distanceMeters, speedKmh));
        return startingDate.plus(durationMinutes, ChronoUnit.MINUTES);
    }
}
