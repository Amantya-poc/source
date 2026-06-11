import type { Coordinate } from 'ol/coordinate';
import { fromLonLat } from 'ol/proj';

const DEFAULT_SAMPLES_PER_SEGMENT = 16;

function cubicBezierPoint(
  p0: Coordinate,
  p1: Coordinate,
  p2: Coordinate,
  p3: Coordinate,
  t: number
): Coordinate {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const uuu = uu * u;
  const ttt = tt * t;
  const uut3 = 3 * uu * t;
  const utt3 = 3 * u * tt;

  return [
    uuu * p0[0] + uut3 * p1[0] + utt3 * p2[0] + ttt * p3[0],
    uuu * p0[1] + uut3 * p1[1] + utt3 * p2[1] + ttt * p3[1],
  ];
}

/** Convert one Catmull-Rom segment (p1 → p2) into cubic Bezier control points. */
function catmullRomSegmentToBezier(
  p0: Coordinate,
  p1: Coordinate,
  p2: Coordinate,
  p3: Coordinate
): [Coordinate, Coordinate, Coordinate, Coordinate] {
  return [
    p1,
    [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
    [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
    p2,
  ];
}

/**
 * Sample a closed smooth curve through anchor points using Catmull-Rom → cubic Bezier segments.
 * Anchor points lie on the curve and are the reshape handles.
 */
export function sampleClosedBezierRing(
  controlPointsLonLat: [number, number][],
  samplesPerSegment = DEFAULT_SAMPLES_PER_SEGMENT
): Coordinate[] {
  const count = controlPointsLonLat.length;
  if (count < 3) {
    return [];
  }

  const anchors = controlPointsLonLat.map(([lon, lat]) => fromLonLat([lon, lat]));
  const ring: Coordinate[] = [];

  for (let index = 0; index < count; index++) {
    const p0 = anchors[(index - 1 + count) % count];
    const p1 = anchors[index];
    const p2 = anchors[(index + 1) % count];
    const p3 = anchors[(index + 2) % count];
    const [b0, b1, b2, b3] = catmullRomSegmentToBezier(p0, p1, p2, p3);

    const segmentSamples = index === count - 1 ? samplesPerSegment : samplesPerSegment;
    for (let step = 0; step < segmentSamples; step++) {
      if (index > 0 && step === 0) {
        continue;
      }

      const t = step / segmentSamples;
      ring.push(cubicBezierPoint(b0, b1, b2, b3, t));
    }
  }

  return ring;
}
