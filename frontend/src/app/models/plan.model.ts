export interface RouteWaypoint {
  longitude: number;
  latitude: number;
}

export interface RouteEvent {
  longitude: number;
  latitude: number;
  planKeys: [string, string];
}

export const MAX_PLANS = 3;
export const FUEL_CAPACITY_LITERS = 1000;
export const FUEL_CONSUMPTION_L_PER_MIN = 1;

export interface PlanSimulationConfig {
  planKey: string;
  speed: number;
  route: RouteWaypoint[];
  travelDurationMs: number;
}

export interface VehicleSimulationState {
  planKey: string;
  speed: number;
  fuelLiters: number;
  progress: number;
}

export interface WaypointAddedEvent {
  count: number;
}
