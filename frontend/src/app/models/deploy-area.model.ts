export type DeployEditAction = 'move' | 'resize' | 'reshape';

export interface DeployArea {
  id: string;
  longitude: number;
  latitude: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  /** Bezier anchor points (lon/lat) on the boundary. Curve is drawn through them. */
  vertices?: [number, number][];
}
