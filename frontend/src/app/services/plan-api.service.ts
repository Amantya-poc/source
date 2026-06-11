import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { RouteEvent, RouteWaypoint } from '../models/plan.model';

export interface PlanRecord {
  key: string;
  planeName: string;
  speed: number;
  startingDate: string;
  route: RouteWaypoint[];
  distanceMeters?: number;
  travelDurationMs: number;
}

export interface CreatePlanRequest {
  planeName: string;
  speed: number;
  startingDate: string;
  route: RouteWaypoint[];
}

export interface TimelineSettings {
  sliderStartTime: string | null;
  sliderEndTime: string | null;
}

export interface DashboardPayload {
  plans: PlanRecord[];
  routeEvents: Array<{
    longitude: number;
    latitude: number;
    planKeys: string[];
  }>;
  timeline: TimelineSettings;
}

@Injectable({ providedIn: 'root' })
export class PlanApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = API_CONFIG.plansBaseUrl;

  listPlans(): Observable<PlanRecord[]> {
    return this.http.get<PlanRecord[]>(this.baseUrl);
  }

  getDashboard(): Observable<DashboardPayload> {
    return this.http.get<DashboardPayload>(`${this.baseUrl}/dashboard`);
  }

  getTimeline(): Observable<TimelineSettings> {
    return this.http.get<TimelineSettings>(`${this.baseUrl}/timeline`);
  }

  createPlan(request: CreatePlanRequest): Observable<PlanRecord> {
    return this.http.post<PlanRecord>(this.baseUrl, request);
  }

  clearPlans(): Observable<void> {
    return this.http.delete<void>(this.baseUrl);
  }

  toRouteEvents(events: DashboardPayload['routeEvents']): RouteEvent[] {
    return events.map((event) => ({
      longitude: event.longitude,
      latitude: event.latitude,
      planKeys: [event.planKeys[0], event.planKeys[1]] as [string, string],
    }));
  }
}
