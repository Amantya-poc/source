# myDummyApp — Developer Guide

Real-time drone tracking dashboard built with **Angular 21**, **PrimeNG 21**, **OpenLayers 10**, and **Cesium 1.142**.

Use this README as a **lookup while coding** — jump to any section from the table of contents below.

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [Project structure](#2-project-structure)
3. [PrimeNG — components & CSS classes](#3-primeng--components--css-classes)
4. [Responsive UI layout (header, side panel, cards)](#4-responsive-ui-layout-header-side-panel-cards)
5. [OpenLayers — draw a 2D map](#5-openlayers--draw-a-2d-map)
6. [OpenLayers — draw markers](#6-openlayers--draw-markers)
7. [OpenLayers — move markers](#7-openlayers--move-markers)
8. [OpenLayers — zoom in / zoom out](#8-openlayers--zoom-in--zoom-out)
9. [OpenLayers — change map layers (street, satellite, grid)](#9-openlayers--change-map-layers-street-satellite-grid)
10. [Cesium — draw a 3D globe](#10-cesium--draw-a-3d-globe)
11. [Cesium — markers, move, zoom](#11-cesium--markers-move-zoom)
12. [SSE — Angular implementation](#12-sse--angular-implementation)
13. [SSE — Java backend integration](#13-sse--java-backend-integration)
14. [WebSockets — Angular + Java alternative](#14-websockets--angular--java-alternative)
15. [Common mistakes](#15-common-mistakes)
16. [Tech versions](#16-tech-versions)

---

## 1. Quick start

```bash
cd frontend
npm start          # → http://localhost:4200
npm run build      # → dist/my-dummy-app/browser
```

Backend (separate terminal):

```bash
cd backend
mvn spring-boot:run   # → http://localhost:8081/swagger-ui.html
```

**Stack**

| Package | Version | Purpose |
|---------|---------|---------|
| Angular | 21 | Standalone components, routing |
| PrimeNG + Aura theme | 21 | UI (cards, tags, buttons, …) |
| OpenLayers (`ol`) | 10 | 2D map (`drone-map.component.ts`) |
| Cesium | 1.142 | 3D globe (assets in `angular.json`) |

**Useful commands**

```bash
ng generate component pages/my-page --standalone --skip-tests
ng generate service services/my-service --skip-tests
```

---

## 2. Project structure

```
frontend/                    # Angular app
├── src/app/
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── config/              # GeoServer + API URLs
│   ├── services/            # plan-api.service.ts
│   └── pages/dashboard/     # Map, plan panel, op-dash
├── angular.json
└── package.json

backend/                     # Spring Boot + JPA + Swagger
├── src/main/java/.../       # Controllers, entities, services
├── src/main/resources/      # application.properties
├── DATABASE.md              # Table/schema reference
└── pom.xml
```

**Key files when coding**

| Task | Open this file |
|------|----------------|
| Map layers / markers | `drone-map/drone-map.component.ts` |
| Live drone data (SSE) | `services/drone-telemetry.service.ts` |
| Page layout (grid) | `dashboard/dashboard.component.scss` |
| App shell / header | `layout/shell.component.html` |
| PrimeNG theme setup | `app.config.ts` |
| Cesium assets | `angular.json` → `assets` + `styles` |

---

## 3. PrimeNG — components & CSS classes

### Setup (already done)

```typescript
// app.config.ts
providePrimeNG({ theme: { preset: Aura } })
```

```json
// angular.json — styles
"node_modules/primeicons/primeicons.css"
```

### How to use a component

1. Import the component **directly** in your standalone component's `imports` array
2. Use the selector in HTML
3. Add `FormsModule` if you use `[(ngModel)]`

```typescript
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [Button, Card, Tag, FormsModule],
})
```

### Component cheat sheet

| Need | Import from | HTML tag | Common props |
|------|-------------|----------|--------------|
| Button | `primeng/button` | `<p-button>` | `label`, `icon`, `severity`, `(onClick)` |
| Card | `primeng/card` | `<p-card>` | `header="Title"` |
| Tag / badge | `primeng/tag` | `<p-tag>` | `[value]`, `[severity]`, `icon` |
| Select dropdown | `primeng/select` | `<p-select>` | `[options]`, `optionLabel`, `optionValue` |
| Select buttons | `primeng/selectbutton` | `<p-selectbutton>` | `[options]`, `[(ngModel)]`, `(onChange)` |
| Checkbox | `primeng/checkbox` | `<p-checkbox>` | `[binary]="true"`, `[(ngModel)]` |
| Divider | `primeng/divider` | `<p-divider />` | — |
| Menubar (header) | `primeng/menubar` | `<p-menubar>` | `[model]="menuItems"` |
| Dialog | `primeng/dialog` | `<p-dialog>` | `[(visible)]`, `header` |
| Table | `primeng/table` | `<p-table>` | `[value]`, `[paginator]="true"` |
| Tab view | `primeng/tabview` | `<p-tabView>` | `<p-tabPanel header="…">` |

**Severity values for `<p-tag>`:** `success` | `info` | `warn` | `danger` | `secondary` | `contrast`

### PrimeNG CSS classes & theme tokens

PrimeNG 21 uses the **Aura** design token system. Prefer CSS variables over hard-coded colors.

**Layout utility classes** (use on PrimeNG components via `styleClass`)

| Class | Effect |
|-------|--------|
| `w-full` | Full width (buttons, selects) |
| `mt-2`, `mb-2`, `ml-2`, `mr-2` | Margin spacing |
| `p-fluid` | Fluid form layout (on a container) |

**Theme CSS variables** (use in your SCSS)

| Variable | Use for |
|----------|---------|
| `var(--p-primary-color)` | Brand / accent color |
| `var(--p-surface-ground)` | Page background |
| `var(--p-content-background)` | Card / panel background |
| `var(--p-content-border-color)` | Borders |
| `var(--p-text-muted-color)` | Subtitles, hints |
| `var(--p-border-radius-lg)` | Rounded corners (maps, cards) |

**Example**

```scss
.subtitle {
  color: var(--p-text-muted-color);
}
.map-container {
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-border-radius-lg);
}
```

**Icons**

```html
<i class="pi pi-map"></i>
<i class="pi pi-globe"></i>
<i class="pi pi-map-marker"></i>
<p-button icon="pi pi-check" label="Save" />
```

Browse all icons: [primeng.org/icons](https://primeng.org/icons)

---

## 4. Responsive UI layout (header, side panel, cards)

### App shell — header + content

```
┌─────────────────────────────────────────┐
│  p-menubar  (header / navigation)       │
├─────────────────────────────────────────┤
│  router-outlet  (page content)          │
└─────────────────────────────────────────┘
```

**File:** `layout/shell.component.html`

```html
<div class="shell">
  <p-menubar [model]="menuItems">…</p-menubar>
  <main class="content">
    <router-outlet />
  </main>
</div>
```

```scss
// shell.component.scss
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--p-surface-ground);
}
.content {
  flex: 1;
  padding: 1rem 1.25rem;
}
```

### Dashboard — header + map + side panel

```
┌──────────────────────────────────────────────────┐
│  Page header (title + status tags)               │
├────────────────────────────┬─────────────────────┤
│  p-card                    │  p-card             │
│  ┌──────────────────────┐  │  Side panel         │
│  │  OpenLayers map      │  │  (drone list)       │
│  └──────────────────────┘  │                     │
└────────────────────────────┴─────────────────────┘
```

**File:** `dashboard/dashboard.component.html` + `.scss`

```html
<section class="dashboard">
  <header class="dashboard-header">…</header>
  <div class="dashboard-grid">
    <div class="map-area">
      <p-card header="Live map (OpenLayers)">
        <app-drone-map … />
      </p-card>
    </div>
    <aside class="panel-area">
      <p-card header="Fleet telemetry">
        <app-drone-panel … />
      </p-card>
    </aside>
  </div>
</section>
```

```scss
// Responsive 2-column → 1-column on mobile
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 360px);
  gap: 1rem;
}

@media (max-width: 960px) {
  .dashboard-grid {
    grid-template-columns: 1fr;   /* stack vertically */
  }
}
```

### Layout tips

- **Always set height on map containers** — maps won't render without it
- Use `flex-wrap: wrap` on header rows for small screens
- Use `overflow-y: auto` on side panels so long lists scroll independently
- Wrap sections in `<p-card>` for consistent padding and borders
- Use `max-width: 1400px; margin: 0 auto` to center content on wide screens

### Footer pattern (add if needed)

```html
<footer class="app-footer">
  <p-tag value="DRDO Demo" severity="secondary" />
</footer>
```

```scss
.app-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--p-content-border-color);
  text-align: center;
}
```

---

## 5. OpenLayers — draw a 2D map

**Live example:** `src/app/pages/dashboard/drone-map/drone-map.component.ts`

### Minimum steps

1. Add `ol/ol.css` to `angular.json` styles ✅ (already done)
2. HTML: `<div #mapTarget class="map-container"></div>`
3. SCSS: give `.map-container` a **height** (e.g. `min-height: 480px`)
4. TS: create map in `ngAfterViewInit`, dispose in `ngOnDestroy`

### HTML

```html
<div #mapTarget class="map-container"></div>
```

### SCSS

```scss
.map-container {
  width: 100%;
  height: 100%;
  min-height: 480px;   /* required — map is blank without height */
}
```

### TypeScript

```typescript
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';

@ViewChild('mapTarget', { static: true }) mapTarget!: ElementRef<HTMLDivElement>;
private map?: OlMap;

ngAfterViewInit(): void {
  this.map = new OlMap({
    target: this.mapTarget.nativeElement,
    layers: [new TileLayer({ source: new OSM() })],
    view: new View({
      center: fromLonLat([77.209, 28.6139]),  // [longitude, latitude]
      zoom: 10,
    }),
  });
}

ngOnDestroy(): void {
  this.map?.setTarget(undefined);
  this.map?.dispose();
}
```

### Rules

- Create the map in **`ngAfterViewInit`** (DOM must exist)
- Coordinates are **`[longitude, latitude]`** — use `fromLonLat([lon, lat])`
- Always call **`map.dispose()`** in `ngOnDestroy`

---

## 6. OpenLayers — draw markers

A marker = `Feature` + `Point` geometry on a `VectorLayer`.

### Create a marker

```typescript
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import { fromLonLat } from 'ol/proj';

const feature = new Feature({
  geometry: new Point(fromLonLat([77.209, 28.6139])),
});
feature.setId('DRN-01');
feature.set('name', 'Alpha Scout');

const vectorLayer = new VectorLayer({
  source: new VectorSource({ features: [feature] }),
  style: new Style({
    image: new Circle({
      radius: 9,
      fill: new Fill({ color: '#2e7d32' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
    text: new Text({
      text: 'Alpha Scout',
      offsetY: -18,
      fill: new Fill({ color: '#1a1a1a' }),
      stroke: new Stroke({ color: '#fff', width: 3 }),
    }),
  }),
});

// Add vectorLayer on top of tile layers in map layers array
```

### Style per marker (dynamic)

```typescript
style: (feature) => {
  const status = feature.get('drone')?.status;
  const color = status === 'critical' ? '#c62828' : '#2e7d32';
  return new Style({
    image: new Circle({ radius: 9, fill: new Fill({ color }), … }),
  });
}
```

### Add marker on map click

```typescript
import { toLonLat } from 'ol/proj';

this.map.on('click', (evt) => {
  const [lon, lat] = toLonLat(evt.coordinate);
  const f = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
  vectorLayer.getSource()?.addFeature(f);
});
```

### Update markers from live data (SSE)

See `syncDrones()` in `drone-map.component.ts`:

- Keep a `Map<string, Feature>` keyed by drone id
- **New drone** → create feature, add to source
- **Existing drone** → update geometry coordinates
- **Removed drone** → remove feature from source

---

## 7. OpenLayers — move markers

### A) Programmatic move (live telemetry — used in this app)

```typescript
// Update position when SSE sends new lat/lon
(feature.getGeometry() as Point).setCoordinates(
  fromLonLat([drone.longitude, drone.latitude])
);
feature.changed();   // trigger style refresh
source.changed();
```

### B) Drag marker with mouse

```typescript
import Translate from 'ol/interaction/Translate';
import Select from 'ol/interaction/Select';
import { click } from 'ol/events/condition';
import { toLonLat } from 'ol/proj';

const select = new Select({ condition: click, layers: [vectorLayer] });
const translate = new Translate({ features: select.getFeatures() });

this.map.addInteraction(select);
this.map.addInteraction(translate);

translate.on('translateend', (evt) => {
  const feature = evt.features.getArray()[0];
  const [lon, lat] = toLonLat((feature.getGeometry() as Point).getCoordinates());
  console.log('Moved to', lat, lon);
});
```

### C) Fly map to marker on selection

```typescript
this.map.getView().animate({
  center: fromLonLat([drone.longitude, drone.latitude]),
  zoom: 14,
  duration: 600,
});
```

---

## 8. OpenLayers — zoom in / zoom out

### Mouse / touch (built-in)

- **Scroll wheel** — zoom in/out
- **Double-click** — zoom in
- **Shift + drag** — zoom box
- Enabled by default via `defaultControls()`

### Programmatic zoom

```typescript
const view = this.map.getView();

// Instant
view.setZoom(14);
view.setCenter(fromLonLat([77.209, 28.6139]));

// Animated fly-to
view.animate({ center: fromLonLat([77.209, 28.6139]), zoom: 14, duration: 600 });

// Zoom in/out by delta
const current = view.getZoom() ?? 10;
view.animate({ zoom: current + 1, duration: 250 });   // zoom in
view.animate({ zoom: current - 1, duration: 250 });   // zoom out
```

### Custom zoom buttons (PrimeNG)

```html
<p-button icon="pi pi-plus" (onClick)="zoomIn()" />
<p-button icon="pi pi-minus" (onClick)="zoomOut()" />
```

```typescript
zoomIn(): void {
  const view = this.map?.getView();
  view?.animate({ zoom: (view.getZoom() ?? 10) + 1, duration: 200 });
}
zoomOut(): void {
  const view = this.map?.getView();
  view?.animate({ zoom: (view.getZoom() ?? 10) - 1, duration: 200 });
}
```

### Extra controls (already in drone-map)

```typescript
import { defaults as defaultControls, ScaleLine, FullScreen } from 'ol/control';

controls: defaultControls().extend([new ScaleLine(), new FullScreen()])
```

---

## 9. OpenLayers — change map layers (street, satellite, grid)

**Live example:** `drone-map.component.ts` — layer switcher with `<p-selectbutton>`

### Three base layers

| Layer | Source | Visible when |
|-------|--------|--------------|
| **Street** | OpenStreetMap (`ol/source/OSM`) | `selectedLayer === 'street'` |
| **Satellite** | Esri World Imagery (`ol/source/XYZ`) | `selectedLayer === 'satellite'` |
| **Grid** | CARTO light tiles + `Graticule` overlay | `selectedLayer === 'grid'` |

### Create layers

```typescript
import Graticule from 'ol/layer/Graticule';
import XYZ from 'ol/source/XYZ';

this.streetLayer = new TileLayer({ source: new OSM(), visible: true });
this.satelliteLayer = new TileLayer({
  source: new XYZ({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
  }),
  visible: false,
});
this.gridBaseLayer = new TileLayer({
  source: new XYZ({
    url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    maxZoom: 19,
  }),
  visible: false,
});
this.graticuleLayer = new Graticule({
  strokeStyle: new Stroke({ color: 'rgba(21, 101, 192, 0.55)', width: 1 }),
  showLabels: true,
  visible: false,
});
```

### Switch layers

```typescript
applyBaseLayer(layer: 'street' | 'satellite' | 'grid'): void {
  this.streetLayer?.setVisible(layer === 'street');
  this.satelliteLayer?.setVisible(layer === 'satellite');
  this.gridBaseLayer?.setVisible(layer === 'grid');
  this.graticuleLayer?.setVisible(layer === 'grid');
}
```

### UI switcher

```html
<p-selectbutton
  [options]="layerOptions"
  [(ngModel)]="selectedLayer"
  optionLabel="label"
  optionValue="value"
  (onChange)="onLayerChange()"
/>
```

### Toggle any layer visibility

```typescript
anyLayer.setVisible(true);   // show
anyLayer.setVisible(false);  // hide
anyLayer.setOpacity(0.5);    // semi-transparent overlay
```

---

## 10. Cesium — draw a 3D globe

Cesium assets are copied to `/assets/cesium` via `angular.json` ✅

### Step 1 — Set base URL in `main.ts`

```typescript
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/assets/cesium/';
// must be BEFORE importing anything from 'cesium'
```

### Step 2 — HTML + SCSS

```html
<div #cesiumContainer class="cesium-container"></div>
```

```scss
.cesium-container {
  width: 100%;
  height: 480px;   /* required */
}
```

### Step 3 — Create Viewer

```typescript
import { Viewer, Cartesian3, Color } from 'cesium';

@ViewChild('cesiumContainer', { static: true }) container!: ElementRef<HTMLDivElement>;
private viewer?: Viewer;

ngAfterViewInit(): void {
  this.viewer = new Viewer(this.container.nativeElement, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: true,
  });
}

ngOnDestroy(): void {
  this.viewer?.destroy();
}
```

---

## 11. Cesium — markers, move, zoom

### Draw a marker (entity)

```typescript
this.viewer!.entities.add({
  id: 'DRN-01',
  position: Cartesian3.fromDegrees(77.209, 28.6139, 120),  // lon, lat, altitude(m)
  point: {
    pixelSize: 12,
    color: Color.fromCssColorString('#2e7d32'),
    outlineColor: Color.WHITE,
    outlineWidth: 2,
  },
  label: {
    text: 'Alpha Scout',
    font: '12px sans-serif',
    pixelOffset: new Cartesian3(0, -20, 0),
    fillColor: Color.WHITE,
    outlineColor: Color.BLACK,
    outlineWidth: 2,
  },
});
```

### Move marker (live updates)

```typescript
import { ConstantPositionProperty } from 'cesium';

const entity = this.viewer!.entities.getById('DRN-01');
if (entity) {
  entity.position = new ConstantPositionProperty(
    Cartesian3.fromDegrees(drone.longitude, drone.latitude, drone.altitude)
  );
}
```

### Zoom / fly to marker

```typescript
import { HeadingPitchRange, Math as CesiumMath } from 'cesium';

// Fly to entity
this.viewer!.flyTo(entity, {
  duration: 1.2,
  offset: new HeadingPitchRange(0, CesiumMath.toRadians(-45), 8000),
});

// Fly to coordinates
this.viewer!.camera.flyTo({
  destination: Cartesian3.fromDegrees(77.209, 28.6139, 50000),
  duration: 2,
});
```

### Zoom in / out

```typescript
// By camera height
this.viewer!.camera.zoomIn(100000);
this.viewer!.camera.zoomOut(100000);

// Set exact height above ground
this.viewer!.camera.setView({
  destination: Cartesian3.fromDegrees(77.209, 28.6139, 10000),
});
```

### Change imagery layer

```typescript
import { OpenStreetMapImageryProvider, UrlTemplateImageryProvider, ImageryLayer } from 'cesium';

// OSM
this.viewer!.imageryLayers.removeAll();
this.viewer!.imageryLayers.addImageryProvider(
  new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
);

// Satellite (Esri)
this.viewer!.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
}));
```

### Click globe to drop a pin

```typescript
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium';

const handler = new ScreenSpaceEventHandler(this.viewer!.scene.canvas);
handler.setInputAction((click) => {
  const cartesian = this.viewer!.camera.pickEllipsoid(click.position, this.viewer!.scene.globe.ellipsoid);
  if (cartesian) {
    this.viewer!.entities.add({ position: cartesian, point: { pixelSize: 10, color: Color.ORANGE } });
  }
}, ScreenSpaceEventType.LEFT_CLICK);

// ngOnDestroy: handler.destroy();
```

---

## 12. SSE — Angular implementation

**Live example:** `src/app/services/drone-telemetry.service.ts`

Server-Sent Events (SSE) = one-way stream from Java → Angular. Ideal for live GPS telemetry.

### Data model

```typescript
// models/drone.model.ts
export interface DroneTelemetry {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  battery: number;
  status: 'active' | 'warning' | 'critical' | 'offline';
  lastUpdated: string;
}

export interface DroneStreamEvent {
  type: 'snapshot' | 'update';
  drones: DroneTelemetry[];
}
```

### Angular service pattern

```typescript
@Injectable({ providedIn: 'root' })
export class DroneTelemetryService implements OnDestroy {
  private readonly dronesSubject = new BehaviorSubject<DroneTelemetry[]>([]);
  readonly drones$ = this.dronesSubject.asObservable();

  constructor(private readonly ngZone: NgZone) {}

  connect(): void {
    this.ngZone.runOutsideAngular(() => {
      const es = new EventSource('http://localhost:8080/api/drones/stream');

      es.addEventListener('snapshot', (e: MessageEvent) => {
        this.ngZone.run(() => this.handleEvent(JSON.parse(e.data)));
      });
      es.addEventListener('update', (e: MessageEvent) => {
        this.ngZone.run(() => this.handleEvent(JSON.parse(e.data)));
      });
      es.onerror = () => this.ngZone.run(() => this.startMockFallback());
    });
  }

  disconnect(): void {
    this.eventSource?.close();
  }

  private handleEvent(payload: DroneStreamEvent): void {
    this.dronesSubject.next(payload.drones);
  }
}
```

### Use in a component

```typescript
// dashboard.component.ts
readonly vm$ = combineLatest([
  this.telemetry.drones$,
  this.telemetry.connected$,
]).pipe(map(([drones, connected]) => ({ drones, connected })));

ngOnInit(): void { this.telemetry.connect(); }
ngOnDestroy(): void { this.telemetry.disconnect(); }
```

```html
@if (vm$ | async; as vm) {
  <app-drone-map [drones]="vm.drones" />
  <app-drone-panel [drones]="vm.drones" />
}
```

### Why `NgZone`?

`EventSource` callbacks run **outside Angular's zone**. Wrap updates in `ngZone.run()` so the UI refreshes automatically.

### Mock fallback (when Java is offline)

This app auto-switches to mock drones if SSE fails or sends no data within 3 seconds — see `startMockFallback()` in the service.

---

## 13. SSE — Java backend integration

### Expected API

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/api/drones/stream` | SSE stream (snapshot + updates) |
| `GET` | `/api/drones` | Optional REST snapshot |

### Event format

Angular listens for named events **`snapshot`** and **`update`**:

```
event: snapshot
data: {"type":"snapshot","drones":[{...},{...}]}

event: update
data: {"type":"update","drones":[{...},{...}]}
```

### Spring Boot example

```java
@RestController
@RequestMapping("/api/drones")
@CrossOrigin(origins = "http://localhost:4200")
public class DroneStreamController {

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> stream() {
        return droneService.streamTelemetry()
            .map(json -> ServerSentEvent.<String>builder()
                .event(json.startsWith("{\"type\":\"snapshot\"") ? "snapshot" : "update")
                .data(json)
                .build());
    }
}
```

```java
// DroneService — emit JSON every 2 seconds
public Flux<String> streamTelemetry() {
    return Flux.interval(Duration.ofSeconds(2))
        .map(tick -> objectMapper.writeValueAsString(buildUpdateEvent()));
}
```

### Spring Boot — simple SseEmitter alternative

```java
@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter stream() {
    SseEmitter emitter = new SseEmitter(0L);  // no timeout
    scheduler.scheduleAtFixedRate(() -> {
        try {
            String json = buildUpdateJson();
            emitter.send(SseEmitter.event().name("update").data(json));
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
    }, 0, 2, TimeUnit.SECONDS);
    return emitter;
}
```

### CORS

Allow Angular dev origin:

```java
@CrossOrigin(origins = "http://localhost:4200")
```

Or global:

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedOrigins("http://localhost:4200");
    }
}
```

### Java JSON payload example

```json
{
  "type": "update",
  "drones": [
    {
      "id": "DRN-01",
      "name": "Alpha Scout",
      "latitude": 28.6139,
      "longitude": 77.209,
      "altitude": 120,
      "speed": 42,
      "heading": 45,
      "battery": 88,
      "status": "active",
      "lastUpdated": "2026-06-07T12:00:00Z"
    }
  ]
}
```

---

## 14. WebSockets — Angular + Java alternative

Use WebSockets when you need **two-way** communication (send commands to drones, chat, acknowledgements). SSE is simpler for one-way telemetry.

### When to use which

| | SSE | WebSocket |
|---|-----|-----------|
| Direction | Server → client only | Bidirectional |
| Reconnect | Built-in auto-reconnect | Manual |
| Complexity | Low | Medium |
| Best for | Live GPS feeds, logs | Commands, chat, gaming |

### Angular WebSocket service

```typescript
@Injectable({ providedIn: 'root' })
export class DroneWebSocketService implements OnDestroy {
  private socket?: WebSocket;
  private readonly dronesSubject = new BehaviorSubject<DroneTelemetry[]>([]);
  readonly drones$ = this.dronesSubject.asObservable();

  constructor(private readonly ngZone: NgZone) {}

  connect(): void {
    this.socket = new WebSocket('ws://localhost:8080/ws/drones');

    this.socket.onmessage = (event) => {
      this.ngZone.run(() => {
        const payload: DroneStreamEvent = JSON.parse(event.data);
        this.dronesSubject.next(payload.drones);
      });
    };

    this.socket.onclose = () => {
      setTimeout(() => this.connect(), 3000);   // auto-reconnect
    };
  }

  sendCommand(droneId: string, command: string): void {
    this.socket?.send(JSON.stringify({ droneId, command }));
  }

  disconnect(): void {
    this.socket?.close();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
```

### Use in component (same pattern as SSE)

```typescript
// Swap DroneTelemetryService for DroneWebSocketService — same drones$ API
this.telemetry.drones$.subscribe(drones => { … });
```

### Spring Boot WebSocket

**Dependency** (`pom.xml`):

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

**Config:**

```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(droneWebSocketHandler(), "/ws/drones")
                .setAllowedOrigins("http://localhost:4200");
    }

    @Bean
    public DroneWebSocketHandler droneWebSocketHandler() {
        return new DroneWebSocketHandler();
    }
}
```

**Handler:**

```java
public class DroneWebSocketHandler extends TextWebSocketHandler {

    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        sendJson(session, buildSnapshotEvent());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // Handle commands from Angular
        // e.g. {"droneId":"DRN-01","command":"RTH"}
        JsonNode cmd = objectMapper.readTree(message.getPayload());
        droneCommandService.execute(cmd.get("droneId").asText(), cmd.get("command").asText());
    }

    @Scheduled(fixedRate = 2000)
    public void broadcastUpdates() {
        String json = buildUpdateEventJson();
        sessions.forEach(s -> sendJson(s, json));
    }

    private void sendJson(WebSocketSession session, String json) {
        session.sendMessage(new TextMessage(json));
    }
}
```

### Migrating from SSE to WebSocket

1. Create `DroneWebSocketService` with the same `drones$`, `connected$` observables
2. In `dashboard.component.ts`, inject the WebSocket service instead of SSE service
3. Map and panel components **don't change** — they only consume `drones[]`

---

## 15. Common mistakes

| Problem | Fix |
|---------|-----|
| Map is blank / grey box | Set `height` or `min-height` on `.map-container` |
| Map not showing at all | Create map in `ngAfterViewInit`, not constructor |
| Wrong location | Use `fromLonLat([lon, lat])` — **longitude first** |
| Markers don't update on SSE | Wrap handler in `ngZone.run()` |
| UI doesn't refresh | Same — SSE/WebSocket callbacks need `NgZone` |
| Checkbox/select not working | Import `FormsModule` in component |
| Memory leak on navigate away | Call `map.dispose()` / `viewer.destroy()` in `ngOnDestroy` |
| Cesium blank globe | Set `CESIUM_BASE_URL = '/assets/cesium/'` in `main.ts` |
| SSE CORS error | Add `@CrossOrigin` on Java controller |
| SSE never connects | Check Java is running on port 8080; mock fallback kicks in after 3s |

---

## 16. Tech versions

| Package | Version |
|---------|---------|
| Angular | 21.2 |
| PrimeNG + Aura theme | 21.1 |
| PrimeIcons | 7.0 |
| OpenLayers | 10.9 |
| Cesium | 1.142 |
| TypeScript | 5.9 |
| Node.js | 20.19+ / 22.12+ / 24+ |

---

## Quick reference — import cheat sheet

### OpenLayers

| Task | Import |
|------|--------|
| Map | `ol/Map`, `ol/View` |
| OSM tiles | `ol/source/OSM`, `ol/layer/Tile` |
| Satellite tiles | `ol/source/XYZ`, `ol/layer/Tile` |
| Grid overlay | `ol/layer/Graticule` |
| Markers | `ol/Feature`, `ol/geom/Point`, `ol/layer/Vector`, `ol/source/Vector` |
| Coordinates | `fromLonLat`, `toLonLat` from `ol/proj` |
| Style | `Style`, `Circle`, `Fill`, `Stroke`, `Text` from `ol/style` |
| Drag marker | `Translate`, `Select` from `ol/interaction` |
| Controls | `ScaleLine`, `FullScreen` from `ol/control` |

### Cesium

| Task | Import |
|------|--------|
| Globe | `Viewer` from `cesium` |
| Position | `Cartesian3.fromDegrees(lon, lat, alt)` |
| Move entity | `ConstantPositionProperty` |
| Fly/zoom | `viewer.flyTo()`, `viewer.camera.flyTo()` |
| Imagery | `OpenStreetMapImageryProvider`, `UrlTemplateImageryProvider` |
