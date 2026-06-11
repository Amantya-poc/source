# Backend — offline deployment

Spring Boot REST API for plans and deploy areas. Runs on port **8081** and uses PostgreSQL database **`drdo_poc`**.

See also: [Frontend offline guide](../frontend/OFFLINE_DEPLOYMENT.md) · [Overview](../OFFLINE_DEPLOYMENT.md)

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Prepare on an online machine](#2-prepare-on-an-online-machine)
3. [Transfer to the offline machine](#3-transfer-to-the-offline-machine)
4. [Set up PostgreSQL](#4-set-up-postgresql)
5. [Build fully offline](#5-build-fully-offline)
6. [Configure the backend](#6-configure-the-backend)
7. [Run the backend](#7-run-the-backend)
8. [Verification checklist](#8-verification-checklist)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| **Java JDK** | 21 | Run and build the JAR |
| **Maven** | 3.9+ | Offline build (`mvn -o package`) |
| **PostgreSQL** | 14+ | Application database |

PostGIS is optional — this backend stores coordinates as JSON/doubles, not PostGIS geometry types.

---

## 2. Prepare on an online machine

### 2.1 Source to copy

Copy the `backend/` folder **excluding** build output:

```
backend/
├── src/
├── pom.xml
├── DATABASE.md
└── OFFLINE_DEPLOYMENT.md
```

Do **not** copy `backend/target/`.

### 2.2 Download Maven dependencies

On a machine with internet:

```powershell
cd backend
mvn -B dependency:go-offline
mvn -B clean package -DskipTests
```

Archive the local Maven repository:

**Windows:**

```powershell
Compress-Archive -Path "$env:USERPROFILE\.m2\repository" -DestinationPath maven-repository.zip
```

**Linux:**

```bash
tar -czf maven-repository.tar.gz -C ~/.m2 repository
```

> Run `mvn package` before archiving so the Spring Boot parent POM and all transitive JARs are cached.

### 2.3 Database dump (optional)

To migrate existing plans and deploy areas:

```powershell
$env:PGPASSWORD = 'postgres'
pg_dump -h localhost -p 5433 -U postgres -d drdo_poc -F c -f drdo_poc.dump
```

If starting fresh, skip this — tables are created automatically on first backend start.

---

## 3. Transfer to the offline machine

| Item | Destination |
|------|-------------|
| `backend/` source | e.g. `C:\apps\issacode\source\backend\` |
| Maven repository archive | `%USERPROFILE%\.m2\repository\` |
| `drdo_poc.dump` (optional) | any convenient path |

Extract `maven-repository.zip` so dependencies land in:

```
C:\Users\<user>\.m2\repository\
```

---

## 4. Set up PostgreSQL

### 4.1 Create the database

```sql
CREATE DATABASE drdo_poc;
```

### 4.2 Default connection settings

From `src/main/resources/application.properties`:

| Setting | Default value |
|---------|---------------|
| Database | `drdo_poc` |
| Host | `localhost` |
| Port | **5433** |
| Username | `postgres` |
| Password | `postgres` |

Adjust on the offline machine if your PostgreSQL uses a different port or credentials.

### 4.3 Restore data (optional)

```powershell
$env:PGPASSWORD = 'postgres'
pg_restore -h localhost -p 5433 -U postgres -d drdo_poc drdo_poc.dump
```

### 4.4 Tables (auto-created if empty)

On first successful start, JPA and `DatabaseSchemaMigration` create:

| Table | Purpose |
|-------|---------|
| `plans` | Mission plans and routes (JSONB waypoints) |
| `deploy_areas` | Deploy ellipse areas |
| `timeline_settings` | Timeline slider state |

See `DATABASE.md` for column details and psql verification commands.

---

## 5. Build fully offline

```powershell
cd backend
mvn -B -o clean package -DskipTests
```

Output JAR:

```
backend/target/geo-backend-0.0.1-SNAPSHOT.jar
```

If `-o` (offline mode) fails, the Maven repository archive is incomplete. Re-run `mvn dependency:go-offline` on an online machine and re-copy `.m2/repository`.

---

## 6. Configure the backend

### 6.1 Database and port

Edit `src/main/resources/application.properties`:

```properties
server.port=8081

spring.datasource.url=jdbc:postgresql://localhost:5432/drdo_poc
spring.datasource.username=postgres
spring.datasource.password=yourpassword
```

Or override at runtime without editing the JAR:

```powershell
java -jar target/geo-backend-0.0.1-SNAPSHOT.jar `
  --spring.datasource.url=jdbc:postgresql://localhost:5432/drdo_poc `
  --spring.datasource.username=postgres `
  --spring.datasource.password=yourpassword
```

### 6.2 CORS

The frontend must be allowed to call the API. Default CORS is set to Angular dev server only.

**`src/main/java/com/mydummyapp/geobackend/config/CorsConfig.java`:**

```java
registry.addMapping("/api/**").allowedOrigins("http://localhost:4200");
```

Also on `PlanController` and `DeployAreaController`:

```java
@CrossOrigin(origins = "http://localhost:4200")
```

| How the frontend is served | CORS origin to allow |
|----------------------------|----------------------|
| `ng serve` (dev) | `http://localhost:4200` |
| nginx/IIS on port 80 | `http://localhost` or your host URL |
| Custom port / LAN IP | match exactly, e.g. `http://192.168.1.10` |

After changing CORS, rebuild the JAR (`mvn -B -o package -DskipTests`).

---

## 7. Run the backend

**Prerequisite:** PostgreSQL is running and database `drdo_poc` exists.

```powershell
cd backend
java -jar target/geo-backend-0.0.1-SNAPSHOT.jar
```

Endpoints:

| URL | Description |
|-----|-------------|
| http://localhost:8081/swagger-ui.html | Swagger UI |
| http://localhost:8081/v3/api-docs | OpenAPI JSON |
| http://localhost:8081/api/plans | Plans REST API |
| http://localhost:8081/api/deploy-areas | Deploy areas REST API |

**Port note:** GeoServer uses **8080**; keep the backend on **8081** to avoid conflicts.

---

## 8. Verification checklist

- [ ] PostgreSQL accepts connections to `drdo_poc`
- [ ] Backend starts without JDBC errors in the console
- [ ] Swagger opens at http://localhost:8081/swagger-ui.html
- [ ] `GET http://localhost:8081/api/plans` returns JSON (empty array is OK)
- [ ] `GET http://localhost:8081/api/deploy-areas` returns JSON
- [ ] Tables exist under `public` schema (`plans`, `deploy_areas`, `timeline_settings`)

---

## 9. Troubleshooting

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Maven `-o` build fails | Incomplete `.m2/repository` | Re-run `mvn dependency:go-offline` online; re-copy repo |
| JDBC connection error | Wrong port, DB name, or password | Fix `application.properties` or JVM args |
| Tables missing | Backend never started successfully | Start backend once; check logs for Hibernate DDL errors |
| API calls fail (CORS) | Frontend URL not in CORS list | Update `CorsConfig` and controller `@CrossOrigin`; rebuild JAR |
| Port already in use | Another process on 8081 | Stop conflicting service or change `server.port` |

---

## Related docs

- `DATABASE.md` — schema reference  
- `../frontend/OFFLINE_DEPLOYMENT.md` — frontend and GeoServer setup  
- `../OFFLINE_DEPLOYMENT.md` — full-stack overview  
