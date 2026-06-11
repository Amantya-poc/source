package com.mydummyapp.geobackend.util;

import com.mydummyapp.geobackend.model.WaypointDto;
import java.util.List;

public final class RouteDistanceUtil {

    /** WGS84 mean Earth radius in meters (matches OpenLayers sphere calculations). */
    private static final double EARTH_RADIUS_METERS = 6371008.8;

    private RouteDistanceUtil() {}

    public static double routeLengthMeters(List<WaypointDto> route) {
        if (route == null || route.size() < 2) {
            return 0;
        }

        double total = 0;
        for (int index = 0; index < route.size() - 1; index++) {
            WaypointDto start = route.get(index);
            WaypointDto end = route.get(index + 1);
            total += segmentLengthMeters(start, end);
        }
        return total;
    }

    private static double segmentLengthMeters(WaypointDto start, WaypointDto end) {
        return haversineMeters(start.latitude(), start.longitude(), end.latitude(), end.longitude());
    }

    private static double haversineMeters(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double deltaPhi = Math.toRadians(lat2 - lat1);
        double deltaLambda = Math.toRadians(lon2 - lon1);

        double a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }
}
