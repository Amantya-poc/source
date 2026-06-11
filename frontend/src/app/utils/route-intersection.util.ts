import { RouteEvent, RouteWaypoint } from '../models/plan.model';

type LonLat = [number, number];

function segmentIntersection(
  a1: LonLat,
  a2: LonLat,
  b1: LonLat,
  b2: LonLat
): LonLat | null {
  const [x1, y1] = a1;
  const [x2, y2] = a2;
  const [x3, y3] = b1;
  const [x4, y4] = b2;

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-12) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }

  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

function routeSegments(route: RouteWaypoint[]): [LonLat, LonLat][] {
  const segments: [LonLat, LonLat][] = [];

  for (let index = 0; index < route.length - 1; index++) {
    segments.push([
      [route[index].longitude, route[index].latitude],
      [route[index + 1].longitude, route[index + 1].latitude],
    ]);
  }

  return segments;
}

function samePoint(a: LonLat, b: LonLat, tolerance = 1e-6): boolean {
  return Math.abs(a[0] - b[0]) < tolerance && Math.abs(a[1] - b[1]) < tolerance;
}

export function findRouteIntersections(
  routes: Array<{ planKey: string; route: RouteWaypoint[] }>
): RouteEvent[] {
  const intersections: RouteEvent[] = [];

  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const routeA = routes[i];
      const routeB = routes[j];
      const segmentsA = routeSegments(routeA.route);
      const segmentsB = routeSegments(routeB.route);

      for (const [a1, a2] of segmentsA) {
        for (const [b1, b2] of segmentsB) {
          const point = segmentIntersection(a1, a2, b1, b2);
          if (!point) continue;

          const duplicate = intersections.some((existing) =>
            samePoint([existing.longitude, existing.latitude], point)
          );
          if (duplicate) continue;

          intersections.push({
            planKeys: [routeA.planKey, routeB.planKey],
            longitude: point[0],
            latitude: point[1],
          });
        }
      }
    }
  }

  return intersections;
}
