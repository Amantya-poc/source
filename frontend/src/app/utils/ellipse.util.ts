import type { Coordinate } from 'ol/coordinate';
import Polygon from 'ol/geom/Polygon';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getPointResolution } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import type { DeployArea } from '../models/deploy-area.model';
import { sampleClosedBezierRing } from './bezier-curve.util';

const ELLIPSE_SEGMENTS = 64;

function metersToMapUnits(center: Coordinate, meters: number): number {
  const resolution = getPointResolution('EPSG:3857', 1, center);
  return meters / resolution;
}

function mapUnitsToMeters(center: Coordinate, mapUnits: number): number {
  const resolution = getPointResolution('EPSG:3857', 1, center);
  return mapUnits * resolution;
}

export function createEllipsePolygon(
  center: Coordinate,
  radiusXMeters: number,
  radiusYMeters: number,
  rotation = 0
): Polygon {
  const radiusX = metersToMapUnits(center, Math.max(radiusXMeters, 1));
  const radiusY = metersToMapUnits(center, Math.max(radiusYMeters, 1));
  const ring: Coordinate[] = [];

  for (let index = 0; index <= ELLIPSE_SEGMENTS; index++) {
    const angle = (index / ELLIPSE_SEGMENTS) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const localX = radiusX * cos;
    const localY = radiusY * sin;
    const x = center[0] + localX * Math.cos(rotation) - localY * Math.sin(rotation);
    const y = center[1] + localX * Math.sin(rotation) + localY * Math.cos(rotation);
    ring.push([x, y]);
  }

  return new Polygon([ring]);
}

export function ellipseRadiiFromCursor(
  center: Coordinate,
  current: Coordinate,
  baseRotation = 0
): { radiusX: number; radiusY: number; rotation: number } {
  const deltaX = current[0] - center[0];
  const deltaY = current[1] - center[1];
  const cos = Math.cos(-baseRotation);
  const sin = Math.sin(-baseRotation);
  const localX = deltaX * cos - deltaY * sin;
  const localY = deltaX * sin + deltaY * cos;

  return {
    radiusX: Math.max(mapUnitsToMeters(center, Math.abs(localX)), 50),
    radiusY: Math.max(mapUnitsToMeters(center, Math.abs(localY)), 50),
    rotation: baseRotation,
  };
}

export function ellipsePointAtAngle(
  center: Coordinate,
  radiusXMeters: number,
  radiusYMeters: number,
  rotation: number,
  angle: number
): Coordinate {
  const radiusX = metersToMapUnits(center, Math.max(radiusXMeters, 1));
  const radiusY = metersToMapUnits(center, Math.max(radiusYMeters, 1));
  const localX = radiusX * Math.cos(angle);
  const localY = radiusY * Math.sin(angle);

  return [
    center[0] + localX * Math.cos(rotation) - localY * Math.sin(rotation),
    center[1] + localX * Math.sin(rotation) + localY * Math.cos(rotation),
  ];
}

export function ellipseAnchorAngle(vertexIndex: number, vertexCount: number): number {
  return (vertexIndex / vertexCount) * Math.PI * 2 - Math.PI / 2;
}

export function ellipseRadiiFromAnchorPoint(
  center: Coordinate,
  cursor: Coordinate,
  anchorAngle: number,
  rotation: number,
  fallbackRadii: { radiusX: number; radiusY: number },
  minRadiusMeters: number
): { radiusX: number; radiusY: number } {
  const deltaX = cursor[0] - center[0];
  const deltaY = cursor[1] - center[1];
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = deltaX * cos - deltaY * sin;
  const localY = deltaX * sin + deltaY * cos;
  const cosA = Math.cos(anchorAngle);
  const sinA = Math.sin(anchorAngle);

  let radiusX = fallbackRadii.radiusX;
  let radiusY = fallbackRadii.radiusY;

  if (Math.abs(cosA) > 0.05) {
    radiusX = Math.max(mapUnitsToMeters(center, Math.abs(localX / cosA)), minRadiusMeters);
  }

  if (Math.abs(sinA) > 0.05) {
    radiusY = Math.max(mapUnitsToMeters(center, Math.abs(localY / sinA)), minRadiusMeters);
  }

  return { radiusX, radiusY };
}

export function distanceMeters(from: Coordinate, to: Coordinate): number {
  return getDistance(from, to);
}

export function sampleEllipseVertices(
  area: Pick<DeployArea, 'longitude' | 'latitude' | 'radiusX' | 'radiusY' | 'rotation'>,
  count: number
): [number, number][] {
  const center = fromLonLat([area.longitude, area.latitude]);
  const vertices: [number, number][] = [];

  for (let index = 0; index < count; index++) {
    const angle = ellipseAnchorAngle(index, count);
    const point = ellipsePointAtAngle(center, area.radiusX, area.radiusY, area.rotation, angle);
    vertices.push(toLonLat(point) as [number, number]);
  }

  return vertices;
}

export function createDeployAreaPolygon(area: DeployArea): Polygon {
  if (area.vertices && area.vertices.length >= 3) {
    const ring = sampleClosedBezierRing(area.vertices);
    if (ring.length >= 3) {
      ring.push(ring[0]);
      return new Polygon([ring]);
    }
  }

  const center = fromLonLat([area.longitude, area.latitude]);
  return createEllipsePolygon(center, area.radiusX, area.radiusY, area.rotation);
}

export function cloneDeployVertices(vertices: [number, number][]): [number, number][] {
  return vertices.map((vertex) => [vertex[0], vertex[1]]);
}
