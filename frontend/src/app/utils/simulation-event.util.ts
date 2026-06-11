import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { getLength } from 'ol/sphere';
import type { RouteEvent } from '../models/plan.model';

function computeWaypointEventProgresses(line: LineString): number[] {
  const coordinates = line.getCoordinates();
  const totalLength = getLength(line);

  if (totalLength === 0 || coordinates.length === 0) {
    return [0];
  }

  const progresses = [0];
  let traversed = 0;

  for (let index = 0; index < coordinates.length - 1; index++) {
    traversed += getLength(new LineString([coordinates[index], coordinates[index + 1]]));
    progresses.push(Math.min(1, traversed / totalLength));
  }

  return progresses;
}

export function progressAlongLine(
  line: LineString,
  longitude: number,
  latitude: number
): number {
  const totalLength = getLength(line);
  if (totalLength === 0) {
    return 0;
  }

  const target = fromLonLat([longitude, latitude]);
  const closest = line.getClosestPoint(target);
  const coordinates = line.getCoordinates();
  let traversed = 0;

  for (let index = 0; index < coordinates.length - 1; index++) {
    const segment = new LineString([coordinates[index], coordinates[index + 1]]);
    const segmentLength = getLength(segment);
    const closestOnSegment = segment.getClosestPoint(closest);
    const distanceToClosestOnSegment = getLength(
      new LineString([closestOnSegment, closest])
    );

    if (distanceToClosestOnSegment < 1) {
      const alongSegment = getLength(new LineString([coordinates[index], closestOnSegment]));
      return Math.min(1, Math.max(0, (traversed + alongSegment) / totalLength));
    }

    traversed += segmentLength;
  }

  return 1;
}

export function computeEventProgresses(
  line: LineString,
  routeEvents: RouteEvent[] = [],
  planKey?: string
): number[] {
  const steps = new Set<number>([0, 1]);

  for (const progress of computeWaypointEventProgresses(line)) {
    steps.add(progress);
  }

  if (planKey) {
    for (const event of routeEvents) {
      if (event.planKeys.includes(planKey)) {
        steps.add(progressAlongLine(line, event.longitude, event.latitude));
      }
    }
  }

  return [...steps].sort((left, right) => left - right);
}

export function snapToPreviousEventProgress(
  progress: number,
  eventProgresses: number[]
): number {
  if (eventProgresses.length === 0) {
    return progress;
  }

  let previous = eventProgresses[0];

  for (const eventProgress of eventProgresses) {
    if (eventProgress <= progress + 1e-9) {
      previous = eventProgress;
      continue;
    }
    break;
  }

  return previous;
}

export function snapToNearestEventProgress(
  progress: number,
  eventProgresses: number[]
): number {
  if (eventProgresses.length === 0) {
    return progress;
  }

  let nearest = eventProgresses[0];
  let nearestDistance = Math.abs(progress - nearest);

  for (const eventProgress of eventProgresses) {
    const distance = Math.abs(progress - eventProgress);
    if (distance < nearestDistance) {
      nearest = eventProgress;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function progressFromElapsed(elapsedMs: number, travelDurationMs: number): number {
  if (travelDurationMs <= 0) {
    return 0;
  }

  return Math.min(1, elapsedMs / travelDurationMs);
}

export function mergeEventProgressSteps(eventProgressLists: number[][]): number[] {
  const steps = new Set<number>([0, 1]);

  for (const progresses of eventProgressLists) {
    for (const progress of progresses) {
      steps.add(Math.min(1, Math.max(0, progress)));
    }
  }

  return [...steps].sort((left, right) => left - right);
}
