import { DatePipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SliderModule } from 'primeng/slider';
import { ToastModule } from 'primeng/toast';
import {
  FUEL_CAPACITY_LITERS,
  MAX_PLANS,
  RouteEvent,
  RouteWaypoint,
  VehicleSimulationState,
  WaypointAddedEvent,
} from '../../models/plan.model';
import { findRouteIntersections } from '../../utils/route-intersection.util';
import { PlanApiService, PlanRecord, TimelineSettings } from '../../services/plan-api.service';
import { OpDashPlanInput } from '../../utils/plan-fuel.util';
import {
  snapToNearestEventProgress,
  snapToPreviousEventProgress,
} from '../../utils/simulation-event.util';
import { AerialDeviceMapComponent } from './aerial-device-map/aerial-device-map.component';
import { OpDashPanelComponent } from './op-dash-panel/op-dash-panel.component';
import { PlanPanelComponent } from './plan-panel/plan-panel.component';

type PlaybackMode = 'event' | 'time';
type SidebarPanel = 'plan' | 'deploy' | 'opDash';

interface AircraftSlotInfo {
  slot: number;
  planKey: string | null;
  planeName: string;
  speed: number;
  fuelLiters: number;
  progress: number;
  active: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    RadioButtonModule,
    SliderModule,
    ToastModule,
    AerialDeviceMapComponent,
    PlanPanelComponent,
    OpDashPanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class DashboardComponent implements AfterViewInit {
  @ViewChild(AerialDeviceMapComponent) private readonly aerialDeviceMap?: AerialDeviceMapComponent;

  private readonly datePipe = new DatePipe('en-US');
  private readonly messageService = inject(MessageService);
  private readonly fb = inject(FormBuilder);
  private readonly planApi = inject(PlanApiService);

  readonly maxPlans = MAX_PLANS;

  readonly planDraftForm = this.fb.group({
    planeName: ['', Validators.required],
    speed: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    startingDate: this.fb.control<Date | null>(null, Validators.required),
  });

  readonly savedPlans = this.fb.array<FormGroup>([]);

  isRunning = false;
  isPaused = false;
  simulationComplete = false;
  playbackMode: PlaybackMode = 'time';
  activePanel: SidebarPanel | null = null;
  timelineValue = 0;
  timelineSteps: number[] = [0, 100];
  routeSelectionActive = false;
  draftWaypointCount = 0;
  vehicleStates: VehicleSimulationState[] = [];
  selectedPlanKey: string | null = null;
  opDashPlans: OpDashPlanInput[] = [];
  opDashRouteEvents: RouteEvent[] = [];
  simulationElapsedMs = 0;
  timelineSettings: TimelineSettings | null = null;

  private syncingTimelineFromSimulation = false;
  private manualTimelineScrub = false;

  get savedPlanKeys(): string[] {
    return this.savedPlans.controls.map((plan) => plan.get('key')?.value as string);
  }

  get isFinishDisabled(): boolean {
    return (
      this.planDraftForm.invalid ||
      this.draftWaypointCount === 0 ||
      this.savedPlans.length >= MAX_PLANS
    );
  }

  get canPlaySimulation(): boolean {
    return this.savedPlans.length > 0 && !this.isRunning && !this.isPaused;
  }

  get canPauseSimulation(): boolean {
    return this.isRunning;
  }

  get canResumeSimulation(): boolean {
    return this.isPaused && !this.isRunning;
  }

  get canStopSimulation(): boolean {
    return this.isRunning || this.isPaused || this.vehicleStates.length > 0;
  }

  get isTimelineInteractive(): boolean {
    return this.isRunning || this.isPaused;
  }

  get aircraftSlots(): AircraftSlotInfo[] {
    return Array.from({ length: MAX_PLANS }, (_, index) => {
      const plan = this.savedPlans.at(index);
      const planKey = (plan?.get('key')?.value as string | undefined) ?? null;
      const vehicleState = planKey
        ? this.vehicleStates.find((state) => state.planKey === planKey)
        : undefined;
      const planeName = (plan?.get('planeName')?.value as string | undefined) ?? `Aircraft ${index + 1}`;
      const planSpeed = Number(plan?.get('speed')?.value ?? 0);
      return {
        slot: index + 1,
        planKey,
        planeName,
        speed: vehicleState?.speed ?? planSpeed,
        fuelLiters: vehicleState?.fuelLiters ?? FUEL_CAPACITY_LITERS,
        progress: vehicleState?.progress ?? 0,
        active: !!plan,
      };
    });
  }

  get mapStartTime(): string {
    const start = this.getTimelineStart();
    return start ? (this.datePipe.transform(start, 'medium') ?? '') : '';
  }

  get currentTime(): string {
    const start = this.getTimelineStart();
    const end = this.getTimelineEnd();
    if (!start || !end) {
      return '';
    }

    const durationMs = end.getTime() - start.getTime();
    const displayDate = new Date(start.getTime() + (this.timelineValue / 100) * durationMs);
    return this.datePipe.transform(displayDate, 'medium') ?? '';
  }

  get timelineStartLabel(): string {
    const start = this.getTimelineStart();
    return start ? (this.datePipe.transform(start, 'medium') ?? '') : '';
  }

  get timelineEndLabel(): string {
    const end = this.getTimelineEnd();
    return end ? (this.datePipe.transform(end, 'medium') ?? '') : '';
  }

  private getTimelineStart(): Date | null {
    const value = this.timelineSettings?.sliderStartTime;
    return value ? new Date(value) : null;
  }

  private getTimelineEnd(): Date | null {
    const value = this.timelineSettings?.sliderEndTime;
    return value ? new Date(value) : null;
  }

  ngAfterViewInit(): void {
    this.loadPlansFromDb();
  }

  onSidebarSelect(panel: SidebarPanel): void {
    this.activePanel = this.activePanel === panel ? null : panel;

    if (this.activePanel !== 'plan') {
      this.routeSelectionActive = false;
    }

    if (this.activePanel !== 'deploy') {
      this.aerialDeviceMap?.clearDeploySelection();
    }
  }

  onPlanDialogVisibleChange(visible: boolean): void {
    if (visible) {
      return;
    }

    this.activePanel = null;
    this.routeSelectionActive = false;
  }

  onStartMapRoute(): void {
    if (this.savedPlans.length >= MAX_PLANS) {
      return;
    }

    this.routeSelectionActive = true;
    this.messageService.add({
      severity: 'info',
      summary: 'Map route',
      detail: 'Click on the map to add waypoints.',
      life: 5000,
    });
  }

  onWaypointAdded(payload: WaypointAddedEvent): void {
    this.draftWaypointCount = payload.count;
  }

  onFinishPlan(): void {
    if (this.isFinishDisabled || !this.aerialDeviceMap) {
      return;
    }

    const planNumber = this.savedPlans.length + 1;
    const planKey = `plan${planNumber}`;
    const { planeName, speed, startingDate } = this.planDraftForm.getRawValue();
    const routeSegment = this.aerialDeviceMap.commitDraftRoute(planKey);

    this.planApi
      .createPlan({
        planeName: planeName as string,
        speed: Number(speed),
        startingDate: (startingDate as Date).toISOString(),
        route: routeSegment.map(([longitude, latitude]) => ({ longitude, latitude })),
      })
      .subscribe({
        next: (plan) => {
          if (plan.key !== planKey) {
            this.aerialDeviceMap?.removeSavedRoute(planKey);
            this.aerialDeviceMap?.restoreSavedRoute(plan.key, plan.route, this.savedPlans.length);
          }

          this.savedPlans.push(this.createPlanFormGroup(plan));
          this.syncRouteEvents();

          this.aerialDeviceMap?.startPlanSimulation({
            planKey: plan.key,
            speed: plan.speed,
            route: plan.route,
            travelDurationMs: plan.travelDurationMs,
          });

          this.simulationComplete = false;
          this.refreshTimelineSteps();
          this.loadTimelineFromBackend();

          this.planDraftForm.reset();
          this.routeSelectionActive = false;
          this.draftWaypointCount = 0;

          const detail =
            this.savedPlans.length >= MAX_PLANS
              ? `${plan.key} saved. Press Play to start all markers.`
              : `${plan.key} saved. Press Play to start markers, or create up to ${MAX_PLANS - this.savedPlans.length} more plan(s).`;

          this.messageService.add({ severity: 'success', summary: 'Plan saved', detail, life: 4000 });
        },
        error: () => {
          this.aerialDeviceMap?.removeSavedRoute(planKey);
          this.messageService.add({
            severity: 'error',
            summary: 'Save failed',
            detail: 'Could not save plan to database. Check that the backend is running.',
            life: 5000,
          });
        },
      });
  }

  onPlay(): void {
    if (this.simulationComplete) {
      this.aerialDeviceMap?.resetSimulation();
      this.simulationComplete = false;
      this.timelineValue = 0;
    }

    this.ensureSimulationVehiclesReady();
    this.aerialDeviceMap?.startSimulation();
    this.isRunning = true;
    this.isPaused = false;
  }

  onPause(): void {
    this.aerialDeviceMap?.pauseSimulation(this.playbackMode === 'event');
    this.isRunning = false;
    this.isPaused = true;
  }

  onResume(): void {
    this.aerialDeviceMap?.resumeSimulation();
    this.isRunning = true;
    this.isPaused = false;
  }

  onStop(): void {
    this.aerialDeviceMap?.resetSimulation();
    this.isRunning = false;
    this.isPaused = false;
    this.simulationComplete = false;
    this.simulationElapsedMs = 0;
    this.timelineValue = 0;
    this.timelineSteps = [0, 100];
  }

  onClearAllRoutes(): void {
    this.planApi.clearPlans().subscribe({
      next: () => this.resetLocalPlanState(),
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Clear failed',
          detail: 'Could not clear plans from database.',
          life: 5000,
        });
      },
    });
  }

  private resetLocalPlanState(): void {
    this.aerialDeviceMap?.clearAllRoutes();

    this.savedPlans.clear();
    this.planDraftForm.reset();
    this.routeSelectionActive = false;
    this.draftWaypointCount = 0;
    this.vehicleStates = [];
    this.selectedPlanKey = null;
    this.opDashPlans = [];
    this.opDashRouteEvents = [];
    this.simulationElapsedMs = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.simulationComplete = false;
    this.timelineValue = 0;
    this.timelineSteps = [0, 100];
    this.loadTimelineFromBackend();

    this.messageService.add({
      severity: 'info',
      summary: 'Routes cleared',
      detail: 'All routes and plan form data have been reset.',
      life: 4000,
    });
  }

  onSimulationStateChange(states: VehicleSimulationState[]): void {
    this.vehicleStates = states;
    this.syncTimelineFromSimulation(states);
  }

  onSimulationElapsedChange(elapsedMs: number): void {
    this.simulationElapsedMs = elapsedMs;
  }

  onSimulationFinished(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.simulationComplete = true;
    this.syncTimelineFromSimulation(this.vehicleStates);
    this.messageService.add({
      severity: 'info',
      summary: 'Simulation finished',
      detail: 'All markers stopped (route complete or fuel depleted).',
      life: 4000,
    });
  }

  formatProgress(progress: number): string {
    return `${Math.round(progress)}%`;
  }

  onAircraftCardClick(aircraft: AircraftSlotInfo): void {
    if (!aircraft.active || !aircraft.planKey) {
      return;
    }

    this.selectedPlanKey =
      this.selectedPlanKey === aircraft.planKey ? null : aircraft.planKey;
  }

  onTimelineChange(value: number): void {
    if (!this.isTimelineInteractive || this.syncingTimelineFromSimulation) {
      return;
    }

    this.pauseSimulationForTimelineScrub();
    this.manualTimelineScrub = true;
    this.applyTimelineChange(value);
    this.manualTimelineScrub = false;
  }

  private syncRouteEvents(): void {
    const intersections = findRouteIntersections(
      this.savedPlans.controls.map((plan) => ({
        planKey: plan.get('key')?.value as string,
        route: this.getPlanRoute(plan),
      }))
    );

    this.opDashRouteEvents = intersections;
    this.opDashPlans = this.savedPlans.controls.map((plan) => ({
      key: plan.get('key')?.value as string,
      planeName: plan.get('planeName')?.value as string,
      speed: Number(plan.get('speed')?.value),
      route: this.getPlanRoute(plan),
      startingDate: plan.get('startingDate')?.value as Date,
    }));

    this.aerialDeviceMap?.setRouteEvents(intersections);

    if (this.vehicleStates.length > 0) {
      this.timelineSteps = this.aerialDeviceMap?.getTimelineEventSteps() ?? [0, 100];
    }
  }

  private refreshTimelineSteps(): void {
    this.timelineSteps = this.aerialDeviceMap?.getTimelineEventSteps() ?? [0, 100];
  }

  private loadPlansFromDb(): void {
    this.planApi.getDashboard().subscribe({
      next: (dashboard) => {
        this.applyPlansFromApi(dashboard.plans);
        this.applyTimelineSettings(dashboard.timeline);
        this.opDashPlans = dashboard.plans.map((plan) => ({
          key: plan.key,
          planeName: plan.planeName,
          speed: plan.speed,
          route: plan.route,
          startingDate: plan.startingDate,
        }));
        this.opDashRouteEvents = this.planApi.toRouteEvents(dashboard.routeEvents);
      },
      error: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Plans not loaded',
          detail: 'Could not load saved plans from database.',
          life: 4000,
        });
      },
    });
  }

  private loadTimelineFromBackend(): void {
    this.planApi.getTimeline().subscribe({
      next: (timeline) => this.applyTimelineSettings(timeline),
      error: () => this.applyTimelineSettings(null),
    });
  }

  private applyTimelineSettings(timeline: TimelineSettings | null | undefined): void {
    this.timelineSettings =
      timeline?.sliderStartTime || timeline?.sliderEndTime ? timeline : null;
  }

  private applyPlansFromApi(plans: PlanRecord[]): void {
    this.savedPlans.clear();
    this.aerialDeviceMap?.clearAllRoutes();

    plans.forEach((plan, index) => {
      this.savedPlans.push(this.createPlanFormGroup(plan));
      this.aerialDeviceMap?.restoreSavedRoute(plan.key, plan.route, index);
    });

    this.syncRouteEvents();
    this.ensureSimulationVehiclesReady();
    this.refreshTimelineSteps();
  }

  private ensureSimulationVehiclesReady(): void {
    const map = this.aerialDeviceMap;
    if (!map) {
      return;
    }

    this.syncRouteEvents();

    this.savedPlans.controls.forEach((plan, index) => {
      const planKey = plan.get('key')?.value as string;
      const route = this.getPlanRoute(plan);
      if (!planKey || route.length === 0) {
        return;
      }

      map.startPlanSimulation({
        planKey,
        speed: Number(plan.get('speed')?.value),
        route,
        travelDurationMs: Number(plan.get('travelDurationMs')?.value ?? 0),
      });
    });

    this.timelineSteps = map.getTimelineEventSteps();
  }

  private createPlanFormGroup(plan: PlanRecord): FormGroup {
    return this.fb.group({
      key: [plan.key],
      planeName: [plan.planeName],
      speed: [plan.speed],
      startingDate: [new Date(plan.startingDate)],
      distanceMeters: [plan.distanceMeters ?? 0],
      travelDurationMs: [plan.travelDurationMs],
      route: this.fb.array(
        plan.route.map((point) =>
          this.fb.group({
            longitude: [point.longitude],
            latitude: [point.latitude],
          })
        )
      ),
    });
  }

  private getPlanRoute(plan: FormGroup): RouteWaypoint[] {
    const routeArray = plan.get('route') as FormArray<FormGroup>;
    return routeArray.controls.map((point) => ({
      longitude: point.get('longitude')?.value as number,
      latitude: point.get('latitude')?.value as number,
    }));
  }

  private pauseSimulationForTimelineScrub(): void {
    if (!this.isRunning) {
      return;
    }

    this.aerialDeviceMap?.pauseSimulation(false);
    this.isRunning = false;
    this.isPaused = true;
  }

  private applyTimelineChange(value: number): void {
    let nextValue = Math.min(100, Math.max(0, value));

    if (this.playbackMode === 'event') {
      const eventProgresses = this.timelineSteps.map((step) => step / 100);
      nextValue = Math.round(
        snapToNearestEventProgress(nextValue / 100, eventProgresses) * 100
      );
    } else {
      nextValue = Math.round(nextValue);
    }

    this.timelineValue = nextValue;
    this.aerialDeviceMap?.setTimelineProgress(nextValue, this.playbackMode);
  }

  private syncTimelineFromSimulation(states: VehicleSimulationState[]): void {
    if (!this.isTimelineInteractive || states.length === 0 || this.manualTimelineScrub) {
      return;
    }

    const maxProgress = Math.max(...states.map((state) => state.progress)) / 100;
    let nextValue: number;

    if (this.playbackMode === 'event') {
      const eventProgresses = this.timelineSteps.map((step) => step / 100);
      nextValue = Math.round(snapToPreviousEventProgress(maxProgress, eventProgresses) * 100);
    } else {
      nextValue = Math.round(maxProgress * 100);
    }

    if (nextValue === this.timelineValue) {
      return;
    }

    this.syncingTimelineFromSimulation = true;
    this.timelineValue = nextValue;
    this.syncingTimelineFromSimulation = false;
  }
}
