import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { getLength } from 'ol/sphere';
import {
  FUEL_CAPACITY_LITERS,
  FUEL_CONSUMPTION_L_PER_MIN,
  RouteEvent,
  RouteWaypoint,
} from '../models/plan.model';

export interface OpDashPlanInput {
  key: string;
  planeName: string;
  speed: number;
  route: RouteWaypoint[];
  startingDate?: string | Date;
}

export interface PlanFuelSummary {
  planKey: string;
  planeName: string;
  totalFuelLiters: number;
}

interface PlanFuelEventPoint {
  label: string;
  cumulativeFuelLiters: number;
  segmentFuelLiters: number;
  fuelRemainingLiters: number;
}

function segmentDistanceMeters(from: RouteWaypoint, to: RouteWaypoint): number {
  const line = new LineString([
    fromLonLat([from.longitude, from.latitude]),
    fromLonLat([to.longitude, to.latitude]),
  ]);
  return getLength(line);
}

function fuelForDistanceMeters(distanceMeters: number, speedKmh: number): number {
  const speedMs = Math.max(speedKmh, 1) * (1000 / 3600);
  const travelMinutes = distanceMeters / speedMs / 60;
  return travelMinutes * FUEL_CONSUMPTION_L_PER_MIN;
}

export function fuelRemainingForDistance(distanceMeters: number, speedKmh: number): number {
  return Math.max(
    0,
    Math.round((FUEL_CAPACITY_LITERS - fuelForDistanceMeters(distanceMeters, speedKmh)) * 10) / 10
  );
}

function routeLengthMeters(route: RouteWaypoint[]): number {
  if (route.length < 2) {
    return 0;
  }

  const line = new LineString(
    route.map((point) => fromLonLat([point.longitude, point.latitude]))
  );
  return getLength(line);
}

function distanceAlongRouteMeters(route: RouteWaypoint[], target: RouteWaypoint): number {
  if (route.length === 0) {
    return 0;
  }

  let traversed = 0;
  let bestDistance = segmentDistanceMeters(route[0], target);
  let bestAlongRoute = 0;

  for (let index = 0; index < route.length - 1; index++) {
    const start = route[index];
    const end = route[index + 1];
    const segmentLength = segmentDistanceMeters(start, end);
    const toStart = segmentDistanceMeters(start, target);
    const toEnd = segmentDistanceMeters(end, target);
    const closestOnSegment = Math.min(toStart, toEnd, (toStart + toEnd - segmentLength) / 2);
    const alongRoute = traversed + Math.min(toStart, segmentLength);

    if (closestOnSegment < bestDistance) {
      bestDistance = closestOnSegment;
      bestAlongRoute = alongRoute;
    }

    traversed += segmentLength;
  }

  return Math.max(bestAlongRoute, 0);
}

function toFuelPoint(
  label: string,
  cumulativeFuelLiters: number,
  segmentFuelLiters: number
): PlanFuelEventPoint {
  return {
    label,
    cumulativeFuelLiters: Math.round(cumulativeFuelLiters * 10) / 10,
    segmentFuelLiters: Math.round(segmentFuelLiters * 10) / 10,
    fuelRemainingLiters: Math.max(
      0,
      Math.round((FUEL_CAPACITY_LITERS - cumulativeFuelLiters) * 10) / 10
    ),
  };
}

export function buildPlanFuelSummaries(plans: OpDashPlanInput[]): PlanFuelSummary[] {
  return plans.map((plan) => ({
    planKey: plan.key,
    planeName: plan.planeName,
    totalFuelLiters:
      Math.round(fuelForDistanceMeters(routeLengthMeters(plan.route), plan.speed) * 10) / 10,
  }));
}

export function buildPlanFuelEventSeries(
  plan: OpDashPlanInput,
  routeEvents: RouteEvent[]
): PlanFuelEventPoint[] {
  if (plan.route.length === 0) {
    return [];
  }

  const points: PlanFuelEventPoint[] = [toFuelPoint('Waypoint 1', 0, 0)];
  let cumulative = 0;

  for (let index = 1; index < plan.route.length; index++) {
    const segmentFuel = fuelForDistanceMeters(
      segmentDistanceMeters(plan.route[index - 1], plan.route[index]),
      plan.speed
    );
    cumulative += segmentFuel;
    points.push(toFuelPoint(`Waypoint ${index + 1}`, cumulative, segmentFuel));
  }

  const interceptEvents = routeEvents
    .filter((event) => event.planKeys.includes(plan.key))
    .map((event) => ({
      event,
      distanceAlongRoute: distanceAlongRouteMeters(plan.route, {
        longitude: event.longitude,
        latitude: event.latitude,
      }),
    }))
    .sort((left, right) => left.distanceAlongRoute - right.distanceAlongRoute);

  for (const intercept of interceptEvents) {
    const interceptFuel = fuelForDistanceMeters(intercept.distanceAlongRoute, plan.speed);
    const otherPlan = intercept.event.planKeys.find((key) => key !== plan.key) ?? 'route';
    points.push(toFuelPoint(`Route ${otherPlan}`, interceptFuel, interceptFuel));
  }

  return points.sort((left, right) => left.cumulativeFuelLiters - right.cumulativeFuelLiters);
}
