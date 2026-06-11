import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import OlMap from 'ol/Map';
import View from 'ol/View';
import VectorLayer from 'ol/layer/Vector';
import { createGeoServerBaseLayer } from '../../../utils/geoserver-map.util';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import type { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import type Polygon from 'ol/geom/Polygon';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getLength } from 'ol/sphere';
import { Style, Circle, Fill, Stroke, Text, RegularShape, Icon } from 'ol/style';
import { defaults as defaultControls, ScaleLine, Zoom } from 'ol/control';
import DragPan from 'ol/interaction/DragPan';
import type { EventsKey } from 'ol/events';
import { unByKey } from 'ol/Observable';
import type { Coordinate } from 'ol/coordinate';
import type { MapBrowserEvent } from 'ol';
import { DeployEditAction, DeployArea } from '../../../models/deploy-area.model';
import {
  FUEL_CAPACITY_LITERS,
  PlanSimulationConfig,
  RouteEvent,
  RouteWaypoint,
  VehicleSimulationState,
  WaypointAddedEvent,
} from '../../../models/plan.model';
import {
  cloneDeployVertices,
  createDeployAreaPolygon,
  distanceMeters,
  sampleEllipseVertices,
} from '../../../utils/ellipse.util';
import { fuelRemainingForDistance } from '../../../utils/plan-fuel.util';
import {
  computeEventProgresses,
  mergeEventProgressSteps,
  progressFromElapsed,
  snapToNearestEventProgress,
  snapToPreviousEventProgress,
} from '../../../utils/simulation-event.util';
import { DeployAreaApiService } from '../../../services/deploy-area-api.service';
import { DeployAreaCardComponent } from './deploy-area-card/deploy-area-card.component';

interface SavedRoute {
  waypoints: Coordinate[];
  color: string;
}

interface VehicleRuntime {
  planKey: string;
  speedKmh: number;
  travelDurationMs: number;
  line: LineString;
  progress: number;
  fuelLiters: number;
  finished: boolean;
  feature: Feature<Point>;
  eventProgresses: number[];
}

interface DeployDragState {
  pointerStart: Coordinate;
  areaSnapshot: DeployArea;
  reshapeVertexIndex?: number;
}

interface DeployPointerPayload {
  coordinate: Coordinate;
  pixel: number[];
}

const PLAN_ROUTE_COLORS = ['#10b981', '#059669', '#34d399'];
const AIRCRAFT_ICON_SRC = '/assets/aircraft.png';
const AIRCRAFT_ICON_SIZE = 40;
const DRAFT_ROUTE_COLOR = '#6ee7b7';
const MIN_ELLIPSE_RADIUS_M = 80;
const DEFAULT_DEPLOY_RADIUS_X_M = 150_000;
const DEFAULT_DEPLOY_RADIUS_Y_M = 80_000;
const RESHAPE_VERTEX_COUNT = 8;

@Component({
  selector: 'app-aerial-device-map',
  imports: [DeployAreaCardComponent],
  templateUrl: './aerial-device-map.component.html',
  styleUrl: './aerial-device-map.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AerialDeviceMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapTarget', { static: true }) mapTarget!: ElementRef<HTMLDivElement>;
  @ViewChild('mapControls', { static: true }) mapControls!: ElementRef<HTMLDivElement>;

  @Input() routeSelectionEnabled = false;
  @Input() deployEditingEnabled = false;
  @Input() playbackMode: 'event' | 'time' = 'event';
  @Input() highlightedPlanKey: string | null = null;
  @Output() waypointAdded = new EventEmitter<WaypointAddedEvent>();
  @Output() simulationStateChange = new EventEmitter<VehicleSimulationState[]>();
  @Output() simulationElapsedChange = new EventEmitter<number>();
  @Output() simulationFinished = new EventEmitter<void>();

  deployCardVisible = false;
  deployMapHint = 'Click on the map to place or select a deploy area';
  activeDeployAction: DeployEditAction | null = null;

  private map?: OlMap;
  private dragPan?: DragPan;
  private baseLayer = createGeoServerBaseLayer();
  private routeSource = new VectorSource();
  private routeLayer = new VectorLayer({
    source: this.routeSource,
    style: (feature) => this.styleRouteFeature(feature),
  });
  private routeEventSource = new VectorSource();
  private routeEventLayer = new VectorLayer({
    source: this.routeEventSource,
    style: (feature) => this.styleRouteEventFeature(feature),
  });
  private deployAreaSource = new VectorSource();
  private deployAreaLayer = new VectorLayer({
    source: this.deployAreaSource,
    style: (feature) => this.styleDeployAreaFeature(feature),
  });
  private vehicleSource = new VectorSource();
  private vehicleLayer = new VectorLayer({
    source: this.vehicleSource,
    zIndex: 20,
    style: (feature) => this.styleVehicleFeature(feature),
  });
  private savedRoutes = new Map<string, SavedRoute>();
  private draftWaypoints: Coordinate[] = [];
  private deployAreas = new Map<string, DeployArea>();
  private deployAreaFeatures = new Map<string, Feature<Polygon>>();
  private reshapeHandleFeatures = new Map<number, Feature<Point>>();
  private selectedDeployAreaId: string | null = null;
  private deployAreaCounter = 0;
  private deployDragState?: DeployDragState;
  private deployPointerDown = false;
  private deployDragging = false;
  private deployAreaDirty = false;
  private deployDragSessionActive = false;
  private suppressNextDeployClick = false;
  private clickKey?: EventsKey;
  private deployClickKey?: EventsKey;
  private deployDomCleanup: (() => void)[] = [];
  private deployWindowPointerCleanup: (() => void) | null = null;
  private vehicles: VehicleRuntime[] = [];
  private routeEvents: RouteEvent[] = [];
  private animationFrame?: number;
  private lastFrameTime?: number;
  private simulationRunning = false;
  private simulationElapsedMs = 0;

  private readonly deployAreaApi = inject(DeployAreaApiService);

  constructor(
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  commitDraftRoute(planKey: string): [number, number][] {
    const route = this.draftWaypoints.map((coordinate) => toLonLat(coordinate) as [number, number]);

    if (route.length > 0) {
      const color = PLAN_ROUTE_COLORS[this.savedRoutes.size % PLAN_ROUTE_COLORS.length];
      this.savedRoutes.set(planKey, {
        waypoints: [...this.draftWaypoints],
        color,
      });
    }

    this.draftWaypoints = [];
    this.rebuildAllFeatures();

    return route;
  }

  restoreSavedRoute(planKey: string, route: RouteWaypoint[], colorIndex: number): void {
    if (route.length === 0) {
      return;
    }

    const waypoints = route.map((point) => fromLonLat([point.longitude, point.latitude]));
    const color = PLAN_ROUTE_COLORS[colorIndex % PLAN_ROUTE_COLORS.length];
    this.savedRoutes.set(planKey, { waypoints, color });
    this.rebuildAllFeatures();
    this.cdr.markForCheck();
  }

  removeSavedRoute(planKey: string): void {
    this.savedRoutes.delete(planKey);
    this.rebuildAllFeatures();
    this.cdr.markForCheck();
  }

  clearAllRoutes(): void {
    this.savedRoutes.clear();
    this.draftWaypoints = [];
    this.routeEventSource.clear();
    this.stopSimulation();
    this.rebuildAllFeatures();
    this.cdr.markForCheck();
  }

  setRouteEvents(events: RouteEvent[]): void {
    this.routeEvents = events;
    this.routeEventSource.clear();

    for (const event of events) {
      this.routeEventSource.addFeature(
        new Feature({
          geometry: new Point(fromLonLat([event.longitude, event.latitude])),
          kind: 'route-event',
          planKeys: event.planKeys,
        })
      );
    }

    this.refreshVehicleEventProgresses();
  }

  clearDeploySelection(): void {
    this.commitDeployAreaChanges();
    this.hideDeployCard();
    this.activeDeployAction = null;
    this.deployDragState = undefined;
    this.deployDragging = false;
    this.deployPointerDown = false;
    this.deployDragSessionActive = false;
    this.detachDeployWindowPointerTracking();
    this.resetDeployMapHint();
    this.updateDeployCursorClasses();
    this.refreshDeployStyles();
    this.cdr.markForCheck();
  }

  onDeployDelete(): void {
    if (!this.selectedDeployAreaId) {
      return;
    }

    const areaId = this.selectedDeployAreaId;
    const feature = this.deployAreaFeatures.get(areaId);
    if (feature) {
      this.deployAreaSource.removeFeature(feature);
    }

    this.deployAreas.delete(areaId);
    this.deployAreaFeatures.delete(areaId);
    this.clearReshapeHandles();
    this.activeDeployAction = null;
    this.hideDeployCard();

    this.deployAreaApi.deleteDeployArea(areaId).subscribe({
      error: (error) => console.error('Failed to delete deploy area from database', error),
    });

    this.cdr.markForCheck();
  }

  onDeployMove(): void {
    this.commitDeployAreaChanges();
    this.clearReshapeHandles();
    this.activeDeployAction = 'move';
    this.updateDeployCursorClasses();
    this.cdr.markForCheck();
  }

  onDeployResize(): void {
    this.commitDeployAreaChanges();
    this.clearReshapeHandles();
    this.activeDeployAction = 'resize';
    this.updateDeployCursorClasses();
    this.cdr.markForCheck();
  }

  onDeployReshape(): void {
    this.commitDeployAreaChanges();
    this.activeDeployAction = 'reshape';
    this.deployMapHint = 'Drag control points to reshape the Bezier curve';

    if (this.selectedDeployAreaId) {
      const area = this.deployAreas.get(this.selectedDeployAreaId);
      if (area) {
        this.ensureBezierControlPoints(area);
        this.updateDeployAreaFeature(area);
        this.updateReshapeHandles(area);
        this.persistDeployAreaUpdate(area);
      }
    }

    this.updateDeployCursorClasses();
    this.cdr.markForCheck();
  }

  onDeployClose(): void {
    this.clearDeploySelection();
  }

  startPlanSimulation(plan: PlanSimulationConfig, autoStart = false): void {
    if (plan.route.length === 0 || this.vehicles.some((vehicle) => vehicle.planKey === plan.planKey)) {
      return;
    }

    const coordinates = plan.route.map((point) =>
      fromLonLat([point.longitude, point.latitude])
    );
    const line = new LineString(coordinates);
    const start = coordinates[0];
    const speedKmh = Math.max(1, Number(plan.speed) || 1);
    const feature = new Feature({
      geometry: new Point(start),
      planKey: plan.planKey,
      color: this.savedRoutes.get(plan.planKey)?.color ?? '#10b981',
      rotation: this.getLineRotation(line, 0),
    });

    this.vehicleSource.addFeature(feature);
    this.vehicles.push({
      planKey: plan.planKey,
      speedKmh,
      travelDurationMs: Math.max(1, plan.travelDurationMs),
      line,
      progress: 0,
      fuelLiters: FUEL_CAPACITY_LITERS,
      finished: false,
      feature,
      eventProgresses: computeEventProgresses(line, this.routeEvents, plan.planKey),
    });

    if (autoStart) {
      this.beginSimulationLoop();
    }

    this.emitSimulationState();
  }

  startSimulation(): void {
    this.beginSimulationLoop();
  }

  pauseSimulation(snapToEvents = false): void {
    this.simulationRunning = false;
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }

    if (!snapToEvents) {
      return;
    }

    for (const vehicle of this.vehicles) {
      if (vehicle.finished) {
        continue;
      }

      vehicle.progress = snapToPreviousEventProgress(vehicle.progress, vehicle.eventProgresses);
      this.syncVehicleToProgress(vehicle);
    }

    this.vehicleSource.changed();
    this.ngZone.run(() => this.emitSimulationState());
  }

  resumeSimulation(): void {
    if (this.vehicles.length === 0 || this.vehicles.every((vehicle) => vehicle.finished)) {
      return;
    }

    this.beginSimulationLoop();
  }

  resetSimulation(): void {
    this.pauseSimulation(false);
    this.simulationElapsedMs = 0;

    for (const vehicle of this.vehicles) {
      vehicle.progress = 0;
      vehicle.fuelLiters = FUEL_CAPACITY_LITERS;
      vehicle.finished = false;
      this.syncVehicleToProgress(vehicle);
    }

    this.vehicleSource.changed();
    this.emitSimulationState();
  }

  getSimulationElapsedMs(): number {
    return this.simulationElapsedMs;
  }

  getTimelineEventSteps(): number[] {
    return mergeEventProgressSteps(this.vehicles.map((vehicle) => vehicle.eventProgresses)).map(
      (progress) => Math.round(progress * 100)
    );
  }

  setTimelineProgress(sliderValue: number, mode: 'time' | 'event'): void {
    if (this.vehicles.length === 0) {
      return;
    }

    let targetProgress = Math.min(1, Math.max(0, sliderValue / 100));

    if (mode === 'event') {
      const eventProgresses = mergeEventProgressSteps(
        this.vehicles.map((vehicle) => vehicle.eventProgresses)
      );
      targetProgress = snapToNearestEventProgress(targetProgress, eventProgresses);
    }

    this.simulationElapsedMs = this.elapsedMsForProgress(targetProgress);

    for (const vehicle of this.vehicles) {
      const elapsedTarget = progressFromElapsed(
        this.simulationElapsedMs,
        vehicle.travelDurationMs
      );
      const vehicleProgress =
        mode === 'event'
          ? snapToPreviousEventProgress(elapsedTarget, vehicle.eventProgresses)
          : elapsedTarget;

      vehicle.progress = vehicleProgress;
      this.syncVehicleToProgress(vehicle);
      vehicle.finished = vehicleProgress >= 1 - 1e-9 || vehicle.fuelLiters <= 0;
    }

    this.vehicleSource.changed();
    this.emitSimulationState();
  }

  stopSimulation(clearMarkers = true): void {
    this.pauseSimulation();
    this.simulationElapsedMs = 0;
    if (clearMarkers) {
      this.vehicleSource.clear();
      this.vehicles = [];
      this.emitSimulationState();
    }
  }

  ngAfterViewInit(): void {
    this.map = new OlMap({
      target: this.mapTarget.nativeElement,
      layers: [
        this.baseLayer,
        this.routeLayer,
        this.routeEventLayer,
        this.deployAreaLayer,
        this.vehicleLayer,
      ],
      view: new View({
        center: fromLonLat([77.209, 28.6139]),
        zoom: 5,
      }),
      controls: defaultControls({ zoom: false, rotate: false }).extend([
        new Zoom({ target: this.mapControls.nativeElement }),
        new ScaleLine({ target: this.mapControls.nativeElement }),
      ]),
    });

    this.syncRouteSelectionHandler();
    this.syncDeployEditingHandler();
    this.updateDeployCursorClasses();

    for (const interaction of this.map.getInteractions().getArray()) {
      if (interaction instanceof DragPan) {
        this.dragPan = interaction;
        break;
      }
    }

    this.map.updateSize();
    requestAnimationFrame(() => this.map?.updateSize());
    this.loadSavedDeployAreas();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['routeSelectionEnabled']) {
      this.syncRouteSelectionHandler();
    }

    if (changes['deployEditingEnabled']) {
      this.syncDeployEditingHandler();
      this.updateDeployCursorClasses();

      if (!this.deployEditingEnabled) {
        this.clearDeploySelection();
        this.resetDeployMapHint();
      }

      this.setMapPanEnabled(!this.deployEditingEnabled);
    }

    if (changes['playbackMode'] && !changes['playbackMode'].firstChange) {
      this.applyPlaybackModeToVehicles();
    }

    if (changes['highlightedPlanKey']) {
      this.routeLayer.changed();
      this.vehicleLayer.changed();
    }
  }

  ngOnDestroy(): void {
    this.stopSimulation();
    this.detachClickHandler();
    this.detachDeployPointerHandlers();
    this.setMapPanEnabled(true);
    this.map?.setTarget(undefined);
    this.map?.dispose();
  }

  private beginSimulationLoop(): void {
    if (
      this.simulationRunning ||
      this.vehicles.length === 0 ||
      this.vehicles.every((vehicle) => vehicle.finished)
    ) {
      return;
    }

    this.simulationRunning = true;
    this.lastFrameTime = performance.now();
    this.ngZone.runOutsideAngular(() => this.animate());
  }

  private animate = (): void => {
    if (!this.simulationRunning) return;

    const now = performance.now();
    const deltaMs = now - (this.lastFrameTime ?? now);
    this.lastFrameTime = now;
    this.simulationElapsedMs += deltaMs;

    if (this.playbackMode === 'event') {
      this.animateEventBased();
    } else {
      this.animateTimeBased();
    }

    this.vehicleSource.changed();
    this.ngZone.run(() => this.emitSimulationState());

    if (this.vehicles.every((vehicle) => vehicle.finished)) {
      this.simulationRunning = false;
      this.ngZone.run(() => this.simulationFinished.emit());
      return;
    }

    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private animateTimeBased(): void {
    for (const vehicle of this.vehicles) {
      if (vehicle.finished) continue;

      const targetProgress = progressFromElapsed(
        this.simulationElapsedMs,
        vehicle.travelDurationMs
      );

      vehicle.progress = targetProgress;
      this.syncVehicleToProgress(vehicle);

      if (vehicle.fuelLiters <= 0 || vehicle.progress >= 1 - 1e-9) {
        vehicle.finished = true;
      }
    }
  }

  private animateEventBased(): void {
    for (const vehicle of this.vehicles) {
      if (vehicle.finished) continue;

      const targetProgress = progressFromElapsed(
        this.simulationElapsedMs,
        vehicle.travelDurationMs
      );
      const nextProgress = snapToPreviousEventProgress(
        targetProgress,
        vehicle.eventProgresses
      );

      if (Math.abs(nextProgress - vehicle.progress) < 1e-9) {
        continue;
      }

      vehicle.progress = nextProgress;
      this.syncVehicleToProgress(vehicle);

      if (vehicle.fuelLiters <= 0 || vehicle.progress >= 1 - 1e-9) {
        vehicle.finished = true;
      }
    }
  }

  private emitSimulationState(): void {
    this.simulationStateChange.emit(
      this.vehicles.map((vehicle) => ({
        planKey: vehicle.planKey,
        speed: vehicle.speedKmh,
        fuelLiters: Math.round(vehicle.fuelLiters * 10) / 10,
        progress: Math.round(vehicle.progress * 1000) / 10,
      }))
    );
    this.simulationElapsedChange.emit(this.simulationElapsedMs);
  }

  private getMaxSimulationDurationMs(): number {
    let maxDuration = 0;

    for (const vehicle of this.vehicles) {
      maxDuration = Math.max(maxDuration, vehicle.travelDurationMs);
    }

    return maxDuration;
  }

  private elapsedMsForProgress(progress: number): number {
    return progress * this.getMaxSimulationDurationMs();
  }

  private refreshVehicleEventProgresses(): void {
    for (const vehicle of this.vehicles) {
      vehicle.eventProgresses = computeEventProgresses(
        vehicle.line,
        this.routeEvents,
        vehicle.planKey
      );
    }
  }

  private applyPlaybackModeToVehicles(): void {
    if (this.vehicles.length === 0) {
      return;
    }

    for (const vehicle of this.vehicles) {
      if (vehicle.finished) {
        continue;
      }

      const elapsedProgress = progressFromElapsed(
        this.simulationElapsedMs,
        vehicle.travelDurationMs
      );

      vehicle.progress =
        this.playbackMode === 'event'
          ? snapToPreviousEventProgress(elapsedProgress, vehicle.eventProgresses)
          : elapsedProgress;

      this.syncVehicleToProgress(vehicle);
    }

    this.vehicleSource.changed();
    this.ngZone.run(() => this.emitSimulationState());
  }

  private syncVehicleToProgress(vehicle: VehicleRuntime): void {
    const coordinate = vehicle.line.getCoordinateAt(vehicle.progress);
    (vehicle.feature.getGeometry() as Point).setCoordinates(coordinate);
    vehicle.feature.set('rotation', this.getLineRotation(vehicle.line, vehicle.progress));

    const lineLength = getLength(vehicle.line);
    const distanceTraveled = lineLength * vehicle.progress;
    vehicle.fuelLiters = fuelRemainingForDistance(distanceTraveled, vehicle.speedKmh);
  }

  private syncRouteSelectionHandler(): void {
    if (this.routeSelectionEnabled) {
      this.attachClickHandler();
      return;
    }
    this.detachClickHandler();
  }

  private syncDeployEditingHandler(): void {
    this.detachDeployPointerHandlers();

    if (!this.deployEditingEnabled || !this.map) {
      return;
    }

    this.deployClickKey = this.map.on('singleclick', (event) => this.onDeploySingleClick(event));

    const viewport = this.map.getViewport();
    const downHandler = (nativeEvent: PointerEvent) => {
      if (!this.map) return;
      this.onDeployPointerDown({
        coordinate: this.map.getCoordinateFromPixel(this.map.getEventPixel(nativeEvent)),
        pixel: this.map.getEventPixel(nativeEvent),
      });
    };
    const moveHandler = (nativeEvent: PointerEvent) => {
      if (!this.map) return;
      this.onDeployPointerMove({
        coordinate: this.map.getCoordinateFromPixel(this.map.getEventPixel(nativeEvent)),
        pixel: this.map.getEventPixel(nativeEvent),
      });
    };
    const upHandler = (nativeEvent: PointerEvent) => {
      if (!this.map) return;
      this.onDeployPointerUp({
        coordinate: this.map.getCoordinateFromPixel(this.map.getEventPixel(nativeEvent)),
        pixel: this.map.getEventPixel(nativeEvent),
      });
    };

    viewport.addEventListener('pointerdown', downHandler);
    viewport.addEventListener('pointermove', moveHandler);
    viewport.addEventListener('pointerup', upHandler);
    this.deployDomCleanup = [
      () => viewport.removeEventListener('pointerdown', downHandler),
      () => viewport.removeEventListener('pointermove', moveHandler),
      () => viewport.removeEventListener('pointerup', upHandler),
    ];

    this.setMapPanEnabled(false);
  }

  private setMapPanEnabled(enabled: boolean): void {
    this.dragPan?.setActive(enabled);
  }

  private attachClickHandler(): void {
    if (!this.map || this.clickKey) return;

    this.clickKey = this.map.on('singleclick', (event) => this.onMapClick(event));
  }

  private detachClickHandler(): void {
    if (!this.clickKey) return;
    unByKey(this.clickKey);
    this.clickKey = undefined;
  }

  private detachDeployPointerHandlers(): void {
    if (this.deployClickKey) {
      unByKey(this.deployClickKey);
      this.deployClickKey = undefined;
    }

    for (const cleanup of this.deployDomCleanup) {
      cleanup();
    }
    this.deployDomCleanup = [];
    this.detachDeployWindowPointerTracking();
  }

  private onMapClick(event: MapBrowserEvent<PointerEvent | KeyboardEvent | WheelEvent>): void {
    if (!this.routeSelectionEnabled) return;

    this.draftWaypoints.push(event.coordinate);
    this.rebuildAllFeatures();

    this.waypointAdded.emit({ count: this.draftWaypoints.length });
  }

  private onDeploySingleClick(event: MapBrowserEvent<PointerEvent | KeyboardEvent | WheelEvent>): void {
    if (!this.deployEditingEnabled) {
      return;
    }

    if (this.suppressNextDeployClick) {
      this.suppressNextDeployClick = false;
      return;
    }

    const hitAreaId = this.getDeployAreaAtPixel(event.pixel);

    if (hitAreaId) {
      this.selectDeployArea(hitAreaId);
      return;
    }

    if (this.activeDeployAction) {
      return;
    }

    this.addDeployArea(
      event.coordinate,
      DEFAULT_DEPLOY_RADIUS_X_M,
      DEFAULT_DEPLOY_RADIUS_Y_M,
      0
    );
    this.cdr.markForCheck();
  }

  private onDeployPointerDown(event: DeployPointerPayload): void {
    if (!this.deployEditingEnabled || !this.map) {
      return;
    }

    this.deployPointerDown = true;

    if (this.activeDeployAction && this.selectedDeployAreaId) {
      const area = this.deployAreas.get(this.selectedDeployAreaId);
      if (!area) {
        return;
      }

      if (this.activeDeployAction === 'reshape') {
        const vertexIndex = this.getReshapeVertexIndexAtPixel(event.pixel);
        if (vertexIndex === null) {
          this.deployPointerDown = false;
          return;
        }

        this.deployDragState = {
          pointerStart: event.coordinate,
          areaSnapshot: this.cloneAreaSnapshot(area),
          reshapeVertexIndex: vertexIndex,
        };
      } else {
        this.deployDragState = {
          pointerStart: event.coordinate,
          areaSnapshot: this.cloneAreaSnapshot(area),
        };
      }

      this.deployDragging = true;
      this.deployDragSessionActive = true;
      this.attachDeployWindowPointerTracking();
      this.applyDeployDrag(event.coordinate);
      this.updateDeployCursorClasses();
    }
  }

  private onDeployPointerMove(event: DeployPointerPayload): void {
    if (!this.deployEditingEnabled) {
      return;
    }

    if (this.deployDragState && this.selectedDeployAreaId && this.deployPointerDown) {
      this.applyDeployDrag(event.coordinate);
    }
  }

  private onDeployPointerUp(event: DeployPointerPayload): void {
    if (!this.deployEditingEnabled) {
      return;
    }

    if (this.deployDragState) {
      this.finalizeDeployDrag(event);
      return;
    }

    this.deployPointerDown = false;
  }

  private finalizeDeployDrag(event: DeployPointerPayload): void {
    if (!this.deployDragState) {
      return;
    }

    const areaId = this.selectedDeployAreaId;
    this.applyDeployDrag(event.coordinate);
    this.deployDragState = undefined;
    this.deployDragging = false;
    this.deployPointerDown = false;
    this.suppressNextDeployClick = true;
    this.detachDeployWindowPointerTracking();
    this.updateDeployCursorClasses();

    if (areaId && this.deployDragSessionActive) {
      const area = this.deployAreas.get(areaId);
      if (area) {
        this.deployAreaDirty = false;
        this.persistDeployAreaUpdate(area);
      }
    }

    this.deployDragSessionActive = false;
  }

  private applyDeployDrag(current: Coordinate): void {
    if (!this.deployDragState || !this.selectedDeployAreaId || !this.activeDeployAction) {
      return;
    }

    const { pointerStart, areaSnapshot } = this.deployDragState;
    const area = this.deployAreas.get(this.selectedDeployAreaId);
    if (!area) {
      return;
    }

    const center = fromLonLat([areaSnapshot.longitude, areaSnapshot.latitude]);

    if (this.activeDeployAction === 'move') {
      const deltaX = current[0] - pointerStart[0];
      const deltaY = current[1] - pointerStart[1];
      const nextCenter: Coordinate = [center[0] + deltaX, center[1] + deltaY];
      const [longitude, latitude] = toLonLat(nextCenter);
      area.longitude = longitude;
      area.latitude = latitude;

      if (areaSnapshot.vertices?.length) {
        area.vertices = areaSnapshot.vertices.map(([lon, lat]) => {
          const vertex = fromLonLat([lon, lat]);
          return toLonLat([vertex[0] + deltaX, vertex[1] + deltaY]) as [number, number];
        });
      }
    }

    if (this.activeDeployAction === 'resize') {
      const initialDistance = Math.max(
        distanceMeters(toLonLat(center), toLonLat(pointerStart)),
        1
      );
      const currentDistance = Math.max(distanceMeters(toLonLat(center), toLonLat(current)), 1);
      const scale = currentDistance / initialDistance;

      if (areaSnapshot.vertices?.length) {
        area.vertices = areaSnapshot.vertices.map(([lon, lat]) => {
          const vertex = fromLonLat([lon, lat]);
          return toLonLat([
            center[0] + (vertex[0] - center[0]) * scale,
            center[1] + (vertex[1] - center[1]) * scale,
          ]) as [number, number];
        });
      } else {
        area.radiusX = Math.max(areaSnapshot.radiusX * scale, MIN_ELLIPSE_RADIUS_M);
        area.radiusY = Math.max(areaSnapshot.radiusY * scale, MIN_ELLIPSE_RADIUS_M);
        area.rotation = areaSnapshot.rotation;
      }
    }

    if (this.activeDeployAction === 'reshape') {
      const vertexIndex = this.deployDragState.reshapeVertexIndex;
      if (vertexIndex === undefined || !areaSnapshot.vertices?.length) {
        return;
      }

      area.vertices = cloneDeployVertices(areaSnapshot.vertices);
      area.vertices[vertexIndex] = toLonLat(current) as [number, number];
      area.longitude = areaSnapshot.longitude;
      area.latitude = areaSnapshot.latitude;
      area.radiusX = areaSnapshot.radiusX;
      area.radiusY = areaSnapshot.radiusY;
      area.rotation = areaSnapshot.rotation;
      this.updateReshapeHandles(area);
    }

    this.updateDeployAreaFeature(area);
    this.refreshDeployStyles();
    this.deployAreaDirty = true;
  }

  private addDeployArea(
    center: Coordinate,
    radiusX: number,
    radiusY: number,
    rotation: number
  ): void {
    const [longitude, latitude] = toLonLat(center);
    const area: DeployArea = {
      id: `area-${++this.deployAreaCounter}`,
      longitude,
      latitude,
      radiusX,
      radiusY,
      rotation,
    };

    this.deployAreas.set(area.id, area);
    const feature = this.createDeployFeature(area);
    this.deployAreaFeatures.set(area.id, feature);
    this.deployAreaSource.addFeature(feature);
    this.deployMapHint = 'Click on the map to place or select a deploy area';
    this.selectDeployArea(area.id);
    this.persistDeployAreaCreate(area);
  }

  private loadSavedDeployAreas(): void {
    this.deployAreaApi.listDeployAreas().subscribe({
      next: (records) => {
        for (const record of records) {
          this.restoreDeployArea(this.deployAreaApi.toDeployArea(record));
        }
        this.syncDeployAreaCounter();
        this.cdr.markForCheck();
      },
      error: (error) => console.error('Failed to load deploy areas from database', error),
    });
  }

  private restoreDeployArea(area: DeployArea): void {
    this.deployAreas.set(area.id, area);
    const feature = this.createDeployFeature(area);
    this.deployAreaFeatures.set(area.id, feature);
    this.deployAreaSource.addFeature(feature);
  }

  private syncDeployAreaCounter(): void {
    let maxCounter = 0;

    for (const areaId of this.deployAreas.keys()) {
      const match = /^area-(\d+)$/.exec(areaId);
      if (match) {
        maxCounter = Math.max(maxCounter, Number(match[1]));
      }
    }

    this.deployAreaCounter = maxCounter;
  }

  private persistDeployAreaCreate(area: DeployArea): void {
    this.deployAreaApi.createDeployArea(this.deployAreaApi.fromDeployArea(area)).subscribe({
      error: (error) => console.error('Failed to save deploy area to database', error),
    });
  }

  private commitDeployAreaChanges(areaId: string | null = this.selectedDeployAreaId): void {
    if (!areaId || !this.deployAreaDirty) {
      return;
    }

    const area = this.deployAreas.get(areaId);
    if (!area) {
      this.deployAreaDirty = false;
      return;
    }

    this.deployAreaDirty = false;
    this.persistDeployAreaUpdate(area);
  }

  private persistDeployAreaUpdate(area: DeployArea): void {
    this.deployAreaApi
      .updateDeployArea(area.id, this.deployAreaApi.updateRequestFromDeployArea(area))
      .subscribe({
        error: (error) => {
          console.error('Failed to update deploy area in database', error);
          this.deployAreaDirty = true;
        },
      });
  }

  private attachDeployWindowPointerTracking(): void {
    this.detachDeployWindowPointerTracking();

    const toPayload = (nativeEvent: PointerEvent): DeployPointerPayload => ({
      coordinate: this.map!.getCoordinateFromPixel(this.map!.getEventPixel(nativeEvent)),
      pixel: this.map!.getEventPixel(nativeEvent),
    });

    const moveHandler = (nativeEvent: PointerEvent) => {
      if (!this.map || !this.deployDragState || !this.deployPointerDown) {
        return;
      }

      this.onDeployPointerMove(toPayload(nativeEvent));
    };

    const upHandler = (nativeEvent: PointerEvent) => {
      if (!this.map || !this.deployDragState) {
        return;
      }

      this.onDeployPointerUp(toPayload(nativeEvent));
    };

    window.addEventListener('pointermove', moveHandler);
    window.addEventListener('pointerup', upHandler);
    window.addEventListener('pointercancel', upHandler);
    this.deployWindowPointerCleanup = () => {
      window.removeEventListener('pointermove', moveHandler);
      window.removeEventListener('pointerup', upHandler);
      window.removeEventListener('pointercancel', upHandler);
    };
  }

  private detachDeployWindowPointerTracking(): void {
    this.deployWindowPointerCleanup?.();
    this.deployWindowPointerCleanup = null;
  }

  private createDeployFeature(area: DeployArea): Feature<Polygon> {
    return new Feature({
      geometry: createDeployAreaPolygon(area),
      kind: 'deploy-area',
      areaId: area.id,
    });
  }

  private updateDeployAreaFeature(area: DeployArea): void {
    const feature = this.deployAreaFeatures.get(area.id);
    if (!feature) {
      return;
    }

    feature.setGeometry(createDeployAreaPolygon(area));
    this.deployAreaSource.changed();
  }

  private cloneAreaSnapshot(area: DeployArea): DeployArea {
    return {
      ...area,
      vertices: area.vertices ? cloneDeployVertices(area.vertices) : undefined,
    };
  }

  private ensureBezierControlPoints(area: DeployArea): void {
    if (!area.vertices || area.vertices.length < RESHAPE_VERTEX_COUNT) {
      area.vertices = sampleEllipseVertices(area, RESHAPE_VERTEX_COUNT);
    }
  }

  private updateReshapeHandles(area: DeployArea): void {
    const handlePositions =
      area.vertices && area.vertices.length >= 3
        ? area.vertices
        : sampleEllipseVertices(area, RESHAPE_VERTEX_COUNT);

    for (let index = 0; index < handlePositions.length; index++) {
      const coordinate = fromLonLat(handlePositions[index]);
      let feature = this.reshapeHandleFeatures.get(index);

      if (!feature) {
        feature = new Feature({
          geometry: new Point(coordinate),
          kind: 'reshape-handle',
          vertexIndex: index,
        });
        this.reshapeHandleFeatures.set(index, feature);
        this.deployAreaSource.addFeature(feature);
      } else {
        (feature.getGeometry() as Point).setCoordinates(coordinate);
      }
    }

    for (const [index, feature] of this.reshapeHandleFeatures) {
      if (index >= handlePositions.length) {
        this.deployAreaSource.removeFeature(feature);
        this.reshapeHandleFeatures.delete(index);
      }
    }

    this.deployAreaSource.changed();
  }

  private clearReshapeHandles(): void {
    for (const feature of this.reshapeHandleFeatures.values()) {
      this.deployAreaSource.removeFeature(feature);
    }
    this.reshapeHandleFeatures.clear();
  }

  private resetDeployMapHint(): void {
    this.deployMapHint = 'Click on the map to place or select a deploy area';
  }

  private getReshapeVertexIndexAtPixel(pixel: number[]): number | null {
    if (!this.map || this.activeDeployAction !== 'reshape' || this.reshapeHandleFeatures.size === 0) {
      return null;
    }

    let vertexIndex: number | null = null;
    this.map.forEachFeatureAtPixel(
      pixel,
      (feature) => {
        if (feature.get('kind') === 'reshape-handle') {
          vertexIndex = feature.get('vertexIndex') as number;
          return true;
        }
        return false;
      },
      {
        layerFilter: (layer) => layer === this.deployAreaLayer,
        hitTolerance: 12,
      }
    );

    return vertexIndex;
  }

  private getDeployAreaAtPixel(pixel: number[]): string | null {
    if (!this.map) {
      return null;
    }

    let areaId: string | null = null;
    this.map.forEachFeatureAtPixel(
      pixel,
      (feature) => {
        if (feature.get('kind') === 'deploy-area') {
          areaId = feature.get('areaId') as string;
          return true;
        }
        return false;
      },
      {
        layerFilter: (layer) => layer === this.deployAreaLayer,
        hitTolerance: 4,
      }
    );

    return areaId;
  }

  private selectDeployArea(areaId: string): void {
    this.clearReshapeHandles();
    const reselectingSameArea = this.selectedDeployAreaId === areaId;
    this.selectedDeployAreaId = areaId;
    this.deployCardVisible = true;
    if (!reselectingSameArea) {
      this.activeDeployAction = null;
    }
    this.updateDeployCursorClasses();
    this.refreshDeployStyles();
    this.cdr.markForCheck();
  }

  private hideDeployCard(): void {
    this.clearReshapeHandles();
    this.deployCardVisible = false;
    this.selectedDeployAreaId = null;
    this.refreshDeployStyles();
    this.cdr.markForCheck();
  }

  private refreshDeployStyles(): void {
    for (const feature of this.deployAreaFeatures.values()) {
      feature.set('selected', feature.get('areaId') === this.selectedDeployAreaId);
    }
    this.deployAreaSource.changed();
  }

  private updateDeployCursorClasses(): void {
    const element = this.mapTarget.nativeElement;
    element.classList.toggle('deploy-editing', this.deployEditingEnabled);
    element.classList.toggle('deploy-action-active', !!this.activeDeployAction);
    element.classList.toggle('deploy-reshape-active', this.activeDeployAction === 'reshape');
    element.classList.toggle('deploy-dragging', this.deployDragging);
  }

  private rebuildAllFeatures(): void {
    this.routeSource.clear();

    for (const [planKey, savedRoute] of this.savedRoutes) {
      this.addRouteFeatures(savedRoute.waypoints, savedRoute.color, planKey, false);
    }

    this.addRouteFeatures(this.draftWaypoints, DRAFT_ROUTE_COLOR, 'draft', true);
  }

  private addRouteFeatures(
    waypoints: Coordinate[],
    color: string,
    planKey: string,
    isDraft: boolean
  ): void {
    if (waypoints.length >= 2) {
      this.routeSource.addFeature(
        new Feature({
          geometry: new LineString(waypoints),
          kind: 'route',
          color,
          planKey,
          isDraft,
        })
      );
    }

    waypoints.forEach((coordinate, index) => {
      this.routeSource.addFeature(
        new Feature({
          geometry: new Point(coordinate),
          kind: 'waypoint',
          color,
          planKey,
          isDraft,
          index: index + 1,
        })
      );
    });
  }

  private styleRouteFeature(feature: FeatureLike): Style | Style[] {
    if (!(feature instanceof Feature)) {
      return new Style();
    }

    const kind = feature.get('kind');
    const color = feature.get('color') as string;
    const planKey = feature.get('planKey') as string;
    const isDraft = feature.get('isDraft') === true;
    const isHighlighted =
      !isDraft && !!this.highlightedPlanKey && planKey === this.highlightedPlanKey;
    const isDimmed =
      !isDraft && !!this.highlightedPlanKey && planKey !== this.highlightedPlanKey;

    if (kind === 'route') {
      const strokeColor = isDimmed ? this.withAlpha(color, 0.28) : color;
      const width = isHighlighted ? 6 : isDimmed ? 2 : 3;

      if (isHighlighted) {
        return [
          new Style({
            stroke: new Stroke({
              color: 'rgba(255, 255, 255, 0.85)',
              width: 10,
            }),
          }),
          new Style({
            stroke: new Stroke({
              color: strokeColor,
              width,
            }),
          }),
        ];
      }

      return new Style({
        stroke: new Stroke({
          color: strokeColor,
          width,
          lineDash: isDraft ? [8, 8] : undefined,
        }),
      });
    }

    const index = feature.get('index') as number;
    const waypointColor = isDimmed ? this.withAlpha(color, 0.35) : color;
    const radius = isHighlighted ? 10 : 8;

    return new Style({
      image: new Circle({
        radius,
        fill: new Fill({ color: waypointColor }),
        stroke: new Stroke({
          color: isHighlighted ? '#ffffff' : '#ffffff',
          width: isHighlighted ? 3 : 2,
        }),
      }),
      text: new Text({
        text: String(index),
        font: 'bold 11px sans-serif',
        fill: new Fill({ color: '#ffffff' }),
      }),
    });
  }

  private styleRouteEventFeature(feature: FeatureLike): Style {
    if (!(feature instanceof Feature)) {
      return new Style();
    }

    const planKeys = feature.get('planKeys') as [string, string];

    return new Style({
      image: new RegularShape({
        points: 4,
        radius: 9,
        angle: Math.PI / 4,
        fill: new Fill({ color: '#059669' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
      text: new Text({
        text: planKeys.join(' / '),
        offsetY: -16,
        font: '10px sans-serif',
        fill: new Fill({ color: '#334155' }),
        stroke: new Stroke({ color: '#ffffff', width: 2 }),
      }),
    });
  }

  private styleDeployAreaFeature(feature: FeatureLike): Style {
    if (!(feature instanceof Feature)) {
      return new Style();
    }

    if (feature.get('kind') === 'reshape-handle') {
      return new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ color: '#10b981', width: 3 }),
        }),
        zIndex: 3,
      });
    }

    const isDraft = feature.get('kind') === 'deploy-area-draft';
    const isSelected = feature.get('selected') === true;

    return new Style({
      fill: new Fill({
        color: isDraft ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.22)',
      }),
      stroke: new Stroke({
        color: isSelected ? '#059669' : '#10b981',
        width: isSelected ? 3 : 2,
        lineDash: isDraft ? [8, 8] : undefined,
      }),
    });
  }

  private styleVehicleFeature(feature: FeatureLike): Style {
    if (!(feature instanceof Feature)) {
      return new Style();
    }

    const planKey = feature.get('planKey') as string;
    const rotation = (feature.get('rotation') as number | undefined) ?? 0;
    const isHighlighted = !!this.highlightedPlanKey && planKey === this.highlightedPlanKey;
    const isDimmed = !!this.highlightedPlanKey && planKey !== this.highlightedPlanKey;
    const scale = isHighlighted ? 1.25 : 1;

    return new Style({
      image: this.createAircraftMarker(rotation, scale, isDimmed ? 0.35 : 1),
      zIndex: isHighlighted ? 22 : 21,
    });
  }

  private withAlpha(hex: string, alpha: number): string {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) {
      return hex;
    }

    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  private getLineRotation(line: LineString, progress: number): number {
    const delta = 0.002;
    const startT = Math.max(0, progress - delta);
    const endT = Math.min(1, progress + delta);
    const start = line.getCoordinateAt(startT);
    const end = line.getCoordinateAt(endT);
    return Math.atan2(end[1] - start[1], end[0] - start[0]);
  }

  private createAircraftMarker(rotation: number, scale = 1, opacity = 1): Icon {
    const size = AIRCRAFT_ICON_SIZE * scale;

    return new Icon({
      src: AIRCRAFT_ICON_SRC,
      width: size,
      height: size,
      anchor: [0.5, 0.5],
      rotation: -rotation + Math.PI / 4,
      opacity,
    });
  }
}
