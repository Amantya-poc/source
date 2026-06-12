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

/** Route colors for plan1 (P1), plan2 (P2), plan3 (P3). */
export const PLAN_ROUTE_COLORS = ['#F59E0B80', '#2E7D3280', '#27457EF2'] as const;

export function getPlanRouteColorByIndex(index: number): string {
  const safeIndex = Math.max(0, Math.min(index, PLAN_ROUTE_COLORS.length - 1));
  return PLAN_ROUTE_COLORS[safeIndex];
}

export function getPlanRouteColor(planKey: string): string {
  const match = planKey.match(/^plan(\d+)$/i);
  const index = match ? Number(match[1]) - 1 : 0;
  return getPlanRouteColorByIndex(index);
}

/** Solid chart colors aligned with plan route colors (P1, P2, P3). */
export const PLAN_CHART_COLORS = ['#F59E0B', '#2E7D32', '#27457E'] as const;
export const PLAN_CHART_BORDER_COLORS = ['#D97706', '#1B5E20', '#1d4ed8'] as const;
export const PLAN_CHART_FILL_ALPHAS = ['rgba(245, 158, 11, 0.15)', 'rgba(46, 125, 50, 0.15)', 'rgba(39, 69, 126, 0.15)'] as const;

export function getPlanChartColor(planKey: string): string {
  const match = planKey.match(/^plan(\d+)$/i);
  const index = match ? Number(match[1]) - 1 : 0;
  return PLAN_CHART_COLORS[Math.max(0, Math.min(index, PLAN_CHART_COLORS.length - 1))];
}

export function getPlanChartBorderColor(planKey: string): string {
  const match = planKey.match(/^plan(\d+)$/i);
  const index = match ? Number(match[1]) - 1 : 0;
  return PLAN_CHART_BORDER_COLORS[Math.max(0, Math.min(index, PLAN_CHART_BORDER_COLORS.length - 1))];
}

export function getPlanChartFillColor(planKey: string): string {
  const match = planKey.match(/^plan(\d+)$/i);
  const index = match ? Number(match[1]) - 1 : 0;
  return PLAN_CHART_FILL_ALPHAS[Math.max(0, Math.min(index, PLAN_CHART_FILL_ALPHAS.length - 1))];
}

export interface PlanSimulationConfig {
  planKey: string;
  speed: number;
  route: RouteWaypoint[];
  travelDurationMs: number;
  startingDate: string | Date;
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
