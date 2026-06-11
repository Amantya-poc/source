import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { DeployArea } from '../models/deploy-area.model';

export interface DeployAreaRecord {
  id: string;
  longitude: number;
  latitude: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  vertices?: Array<{ longitude: number; latitude: number }>;
}

export interface CreateDeployAreaRequest {
  id: string;
  longitude: number;
  latitude: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  vertices?: Array<{ longitude: number; latitude: number }>;
}

export interface UpdateDeployAreaRequest {
  longitude: number;
  latitude: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  vertices: Array<{ longitude: number; latitude: number }> | null;
}

@Injectable({ providedIn: 'root' })
export class DeployAreaApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = API_CONFIG.deployAreasBaseUrl;

  listDeployAreas(): Observable<DeployAreaRecord[]> {
    return this.http.get<DeployAreaRecord[]>(this.baseUrl);
  }

  createDeployArea(request: CreateDeployAreaRequest): Observable<DeployAreaRecord> {
    return this.http.post<DeployAreaRecord>(this.baseUrl, request);
  }

  updateDeployArea(areaId: string, request: UpdateDeployAreaRequest): Observable<DeployAreaRecord> {
    return this.http.put<DeployAreaRecord>(`${this.baseUrl}/${encodeURIComponent(areaId)}`, request);
  }

  deleteDeployArea(areaId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(areaId)}`);
  }

  toDeployArea(record: DeployAreaRecord): DeployArea {
    return {
      id: record.id,
      longitude: record.longitude,
      latitude: record.latitude,
      radiusX: record.radiusX,
      radiusY: record.radiusY,
      rotation: record.rotation,
      vertices: record.vertices?.map(
        (vertex) => [vertex.longitude, vertex.latitude] as [number, number]
      ),
    };
  }

  fromDeployArea(area: DeployArea): CreateDeployAreaRequest {
    return {
      id: area.id,
      longitude: area.longitude,
      latitude: area.latitude,
      radiusX: area.radiusX,
      radiusY: area.radiusY,
      rotation: area.rotation,
      vertices: area.vertices?.map(([longitude, latitude]) => ({ longitude, latitude })),
    };
  }

  updateRequestFromDeployArea(area: DeployArea): UpdateDeployAreaRequest {
    return {
      longitude: area.longitude,
      latitude: area.latitude,
      radiusX: area.radiusX,
      radiusY: area.radiusY,
      rotation: area.rotation,
      vertices: area.vertices?.length
        ? area.vertices.map(([longitude, latitude]) => ({ longitude, latitude }))
        : null,
    };
  }
}
