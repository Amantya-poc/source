package com.mydummyapp.geobackend.service;

import com.mydummyapp.geobackend.model.PlanDto;
import com.mydummyapp.geobackend.model.RouteEventDto;
import com.mydummyapp.geobackend.model.WaypointDto;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class RouteIntersectionService {

    public List<RouteEventDto> findIntersections(List<PlanDto> plans) {
        List<RouteEventDto> intersections = new ArrayList<>();

        for (int i = 0; i < plans.size(); i++) {
            for (int j = i + 1; j < plans.size(); j++) {
                PlanDto routeA = plans.get(i);
                PlanDto routeB = plans.get(j);
                List<double[]> segmentsA = routeSegments(routeA.route());
                List<double[]> segmentsB = routeSegments(routeB.route());

                for (double[] segmentA : segmentsA) {
                    for (double[] segmentB : segmentsB) {
                        double[] point = segmentIntersection(segmentA, segmentB);
                        if (point == null) {
                            continue;
                        }

                        if (isDuplicate(intersections, point)) {
                            continue;
                        }

                        intersections.add(new RouteEventDto(
                                point[0], point[1], List.of(routeA.key(), routeB.key())));
                    }
                }
            }
        }

        return intersections;
    }

    private List<double[]> routeSegments(List<WaypointDto> route) {
        List<double[]> segments = new ArrayList<>();

        for (int index = 0; index < route.size() - 1; index++) {
            WaypointDto start = route.get(index);
            WaypointDto end = route.get(index + 1);
            segments.add(new double[] {
                start.longitude(), start.latitude(), end.longitude(), end.latitude()
            });
        }

        return segments;
    }

    private double[] segmentIntersection(double[] a, double[] b) {
        double x1 = a[0];
        double y1 = a[1];
        double x2 = a[2];
        double y2 = a[3];
        double x3 = b[0];
        double y3 = b[1];
        double x4 = b[2];
        double y4 = b[3];

        double denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denominator) < 1e-12) {
            return null;
        }

        double t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
        double u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

        if (t < 0 || t > 1 || u < 0 || u > 1) {
            return null;
        }

        return new double[] { x1 + t * (x2 - x1), y1 + t * (y2 - y1) };
    }

    private boolean isDuplicate(List<RouteEventDto> intersections, double[] point) {
        for (RouteEventDto existing : intersections) {
            if (samePoint(existing.longitude(), existing.latitude(), point[0], point[1])) {
                return true;
            }
        }

        return false;
    }

    private boolean samePoint(double ax, double ay, double bx, double by) {
        return Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) < 1e-6;
    }
}
