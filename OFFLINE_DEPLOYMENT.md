# Offline deployment — overview

How to move **myDummyApp** to a machine with **no internet**, build everything offline, and run the full stack.

Detailed steps are split by component:

| Guide | Location |
|-------|----------|
| **Backend** (Spring Boot, PostgreSQL, Maven) | [backend/OFFLINE_DEPLOYMENT.md](backend/OFFLINE_DEPLOYMENT.md) |
| **Frontend** (Angular, npm, GeoServer map) | [frontend/OFFLINE_DEPLOYMENT.md](frontend/OFFLINE_DEPLOYMENT.md) |

---

## Architecture

| Component | Role | Default port |
|-----------|------|--------------|
| Angular frontend | UI + OpenLayers map | `4200` (dev) or static files via a web server |
| Spring Boot backend | REST API (`/api/plans`, `/api/deploy-areas`) | **8081** |
| PostgreSQL | Plans, deploy areas, timeline settings | **5433** in this repo (often `5432` elsewhere) |
| GeoServer | WMS base map layer `ne:world` | **8080** |

PostGIS is **not required** — coordinates are stored as JSON/doubles in PostgreSQL.

---

## Prerequisites (offline machine)

| Software | Version | Used by |
|----------|---------|---------|
| Java JDK | 21 | Backend |
| Maven | 3.9+ | Backend build |
| Node.js | 20.19+ | Frontend build |
| PostgreSQL | 14+ | Backend |
| GeoServer | 2.24+ | Frontend map |
| Web server (optional) | nginx, IIS, Apache | Production frontend |

---

## What to transfer (summary)

| Item | Guide |
|------|-------|
| `backend/` source + Maven `.m2/repository` | [Backend §2–3](backend/OFFLINE_DEPLOYMENT.md#2-prepare-on-an-online-machine) |
| `frontend/` source + `node_modules` or npm cache | [Frontend §2–3](frontend/OFFLINE_DEPLOYMENT.md#2-prepare-on-an-online-machine) |
| GeoServer `data_dir` (layer `ne:world`) | [Frontend §4](frontend/OFFLINE_DEPLOYMENT.md#4-set-up-geoserver-base-map) |
| `drdo_poc.dump` (optional) | [Backend §2.3](backend/OFFLINE_DEPLOYMENT.md#23-database-dump-optional) |

Do **not** copy: `backend/target/`, `frontend/node_modules/` (unless archived separately), `frontend/dist/`, `frontend/.angular/cache/`, `.git_local_credentials`.

Suggested layout on the offline machine:

```
C:\apps\issacode\
├── source\
│   ├── backend\
│   └── frontend\
├── maven-repository\       → extract to ~/.m2/repository
├── frontend-node_modules\  → extract to frontend/node_modules (optional)
├── geoserver-data_dir\
└── drdo_poc.dump           (optional)
```

---

## Build order (fully offline)

1. Extract Maven repo → build backend JAR — [backend/OFFLINE_DEPLOYMENT.md §5](backend/OFFLINE_DEPLOYMENT.md#5-build-fully-offline)
2. Extract npm deps → configure URLs → build frontend — [frontend/OFFLINE_DEPLOYMENT.md §5–6](frontend/OFFLINE_DEPLOYMENT.md#5-build-fully-offline)
3. Update backend CORS to match how the frontend is served — [backend/OFFLINE_DEPLOYMENT.md §6.2](backend/OFFLINE_DEPLOYMENT.md#62-cors)

---

## Run order

1. **PostgreSQL** — database `drdo_poc` exists  
2. **GeoServer** — port 8080, layer `ne:world`  
3. **Backend** — `java -jar geo-backend-0.0.1-SNAPSHOT.jar` on 8081  
4. **Frontend** — `npm start` (dev) or serve `dist/my-dummy-app/browser/` (production)

---

## Port reference

| Service | Port |
|---------|------|
| GeoServer | 8080 |
| Spring Boot | 8081 |
| Angular dev server | 4200 |
| PostgreSQL (this repo default) | 5433 |

---

## Full-stack verification

- [ ] PostgreSQL accepts connections to `drdo_poc`
- [ ] GeoServer WMS layer `ne:world` returns tiles
- [ ] Backend Swagger opens at http://localhost:8081/swagger-ui.html
- [ ] Frontend loads; base map and API calls work
- [ ] Plans persist after page refresh
- [ ] No CORS errors in browser dev tools

---

## Related docs

- [backend/OFFLINE_DEPLOYMENT.md](backend/OFFLINE_DEPLOYMENT.md)  
- [frontend/OFFLINE_DEPLOYMENT.md](frontend/OFFLINE_DEPLOYMENT.md)  
- [backend/DATABASE.md](backend/DATABASE.md) — schema reference  
- [README.md](README.md) — developer guide  
