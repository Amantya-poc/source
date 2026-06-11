# Frontend — offline deployment

Angular 21 dashboard with OpenLayers map. Talks to the Spring Boot API on **8081** and GeoServer WMS on **8080**.

See also: [Backend offline guide](../backend/OFFLINE_DEPLOYMENT.md) · [Overview](../OFFLINE_DEPLOYMENT.md)

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Prepare on an online machine](#2-prepare-on-an-online-machine)
3. [Transfer to the offline machine](#3-transfer-to-the-offline-machine)
4. [Set up GeoServer (base map)](#4-set-up-geoserver-base-map)
5. [Build fully offline](#5-build-fully-offline)
6. [Configure the frontend](#6-configure-the-frontend)
7. [Run the frontend](#7-run-the-frontend)
8. [Verification checklist](#8-verification-checklist)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 20.19+ (or 22.12+ / 24+) | Build and dev server |
| **GeoServer** | 2.24+ (typical) | WMS base map tiles |
| **Web server** (optional) | nginx, IIS, or Apache | Serve production build |

Angular CLI is installed via `node_modules` — no global `@angular/cli` install required if you copy dependencies.

---

## 2. Prepare on an online machine

### 2.1 Source to copy

Copy the `frontend/` folder **excluding** generated output:

```
frontend/
├── src/
├── public/
├── angular.json
├── package.json
├── package-lock.json
├── tsconfig*.json
└── OFFLINE_DEPLOYMENT.md
```

Do **not** copy:

- `node_modules/`
- `dist/`
- `.angular/cache/`

Always include **`package-lock.json`** — required for reproducible offline installs.

### 2.2 Install dependencies and verify build

```powershell
cd frontend
npm ci
npm run build
```

### 2.3 Pack dependencies for offline use

Choose one approach:

**Option 1 — Copy `node_modules` (simplest)**

```powershell
cd frontend
Compress-Archive -Path node_modules -DestinationPath frontend-node_modules.zip
```

Extract on the offline machine into `frontend/node_modules/` before building.

**Option 2 — npm cache tarball (smaller transfer)**

```powershell
cd frontend
npm ci
npm cache clean --force
npm ci
npm cache verify

Compress-Archive -Path "$env:LOCALAPPDATA\npm-cache" -DestinationPath npm-cache.zip
```

On the offline machine, extract to `%LOCALAPPDATA%\npm-cache`, then run `npm ci --offline --prefer-offline`.

### 2.4 GeoServer data directory

The map expects WMS layer **`ne:world`**. Copy your GeoServer **`data_dir`**, or at minimum the workspace that publishes that layer:

- Workspace: `ne`
- Layer: `world`

See [Set up GeoServer](#4-set-up-geoserver-base-map) below.

---

## 3. Transfer to the offline machine

| Item | Destination |
|------|-------------|
| `frontend/` source | e.g. `C:\apps\issacode\source\frontend\` |
| `frontend-node_modules.zip` **or** `npm-cache.zip` | `frontend/node_modules/` or `%LOCALAPPDATA%\npm-cache\` |
| GeoServer `data_dir` | GeoServer install on offline machine |

---

## 4. Set up GeoServer (base map)

1. Start GeoServer on port **8080** (Spring Boot uses **8081**).
2. Point GeoServer at the copied `data_dir`, or publish WMS layer **`ne:world`** manually.
3. Confirm in GeoServer admin → Layer Preview → `ne:world` tiles load.

If your offline layer name differs, update `src/app/config/geoserver.config.ts` **before** `npm run build`:

```typescript
export const GEOSERVER_CONFIG = {
  url: 'http://localhost:8080/geoserver',
  layer: 'ne:world',   // change to workspace:layer if needed
};
```

---

## 5. Build fully offline

**If you copied `node_modules`:**

```powershell
cd frontend
npm run build
```

**If you copied npm cache only:**

```powershell
cd frontend
npm ci --offline --prefer-offline
npm run build
```

Production output:

```
frontend/dist/my-dummy-app/browser/
```

Serve this folder in production, or use `npm start` for development.

---

## 6. Configure the frontend

Edit these files **before** `npm run build`. URLs are baked into the production bundle.

### 6.1 Backend API

**`src/app/config/api.config.ts`**

```typescript
/** Backend API (GeoServer uses port 8080; Spring Boot runs on 8081). */
export const API_CONFIG = {
  plansBaseUrl: 'http://localhost:8081/api/plans',
  deployAreasBaseUrl: 'http://localhost:8081/api/deploy-areas',
};
```

### 6.2 GeoServer WMS

**`src/app/config/geoserver.config.ts`**

```typescript
export const GEOSERVER_CONFIG = {
  url: 'http://localhost:8080/geoserver',
  layer: 'ne:world',
};
```

Replace `localhost` with the actual hostname or LAN IP if users open the app from other machines.

### 6.3 CORS (backend side)

The backend must allow the URL where users open the frontend. See [Backend CORS config](../backend/OFFLINE_DEPLOYMENT.md#62-cors).

| Frontend served at | Backend CORS origin |
|--------------------|-------------------|
| `http://localhost:4200` (`ng serve`) | `http://localhost:4200` |
| `http://localhost` (nginx port 80) | `http://localhost` |

---

## 7. Run the frontend

**Prerequisites:** GeoServer running (8080) and backend running (8081).

### Development (quick test)

```powershell
cd frontend
npm start
```

Open http://localhost:4200

### Production (recommended for offline demo)

Serve `dist/my-dummy-app/browser/` with a static web server.

**nginx example:**

```nginx
server {
    listen 80;
    root /path/to/frontend/dist/my-dummy-app/browser;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Update backend CORS to match the URL users open in the browser.

---

## 8. Verification checklist

- [ ] GeoServer WMS layer `ne:world` returns tiles
- [ ] Backend responds at http://localhost:8081/api/plans
- [ ] Frontend loads without console errors
- [ ] Base map tiles appear (not a grey box)
- [ ] Creating a plan persists after page refresh
- [ ] Browser dev tools show no CORS errors on API calls
- [ ] Deploy areas can be created and listed

---

## 9. Troubleshooting

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| `npm ci --offline` fails | Missing cache or lock mismatch | Copy full `node_modules` or ensure `package-lock.json` matches |
| Blank / grey map | GeoServer down or wrong layer | Check GeoServer; verify `GEOSERVER_CONFIG.layer` |
| API calls fail (network) | Backend not running or wrong URL | Verify backend on 8081; check `api.config.ts` |
| API calls fail (CORS) | Frontend origin not allowed by backend | Update backend CORS; rebuild backend JAR |
| Map container empty | CSS height missing | Map host element needs explicit height (see dashboard SCSS) |
| Build fails on Node version | Node too old | Use Node 20.19+ per `package.json` engines |

---

## Related docs

- `../backend/OFFLINE_DEPLOYMENT.md` — PostgreSQL, Maven build, CORS, backend run  
- `../OFFLINE_DEPLOYMENT.md` — full-stack overview and port reference  
- `../README.md` — developer guide (OpenLayers, PrimeNG, components)  
