# DRDO POC — Database Guide

## Connection

| Setting   | Value                                      |
|-----------|--------------------------------------------|
| Database  | `drdo_poc`                                 |
| Host      | `localhost`                                |
| Port      | `5433`                                     |
| Username  | `postgres`                                 |
| Password  | `postgres`                                 |
| JDBC URL  | `jdbc:postgresql://localhost:5433/drdo_poc` |

## Schema

This application uses the PostgreSQL **`public`** schema (the default schema).

- In pgAdmin: expand **Databases → drdo_poc → Schemas → public → Tables**
- In psql:

```sql
\c drdo_poc
SET search_path TO public;
\dt
```

If you only expand **Schemas** and do not open **Tables** underneath **public**, it can look like no tables exist even though they are there.

## How many tables are used?

**1 application table** is used by the backend:

| # | Table   | Schema  | Purpose                                      |
|---|---------|---------|----------------------------------------------|
| 1 | `plans` | `public` | Stores mission plan parameters and routes   |

No other custom tables are created by this backend.

## `plans` table structure

| Column             | Type           | Notes                                      |
|--------------------|----------------|--------------------------------------------|
| `id`               | `BIGSERIAL`    | Primary key (auto-generated)               |
| `plan_key`         | `VARCHAR(32)`  | Unique key, e.g. `plan1`, `plan2`, `plan3` |
| `plane_name`       | `VARCHAR(255)` | Display name from the UI                   |
| `speed`            | `DOUBLE`       | Speed in km/h                              |
| `starting_date`    | `TIMESTAMPTZ`  | Plan start date/time                       |
| `marker_shape`     | `VARCHAR(20)`  | `triangle`, `square`, or `pentagon`        |
| `sort_order`       | `INT`          | Order of creation (0, 1, 2)                |
| `route_waypoints`  | `JSONB`        | Array of `{longitude, latitude}` points  |
| `created_at`       | `TIMESTAMPTZ`  | Row creation timestamp                     |

Example route JSON stored in `route_waypoints`:

```json
[
  {"longitude": 77.209, "latitude": 28.6139},
  {"longitude": 77.1025, "latitude": 28.7041}
]
```

## Why tables may not appear

1. **Backend not running** — tables are created/updated by **JPA/Hibernate** when the backend starts (`spring.jpa.hibernate.ddl-auto=update`).
2. **Wrong database** — confirm you are connected to `drdo_poc`, not `postgis_36_sample` or `postgres`.
3. **Wrong schema node in pgAdmin** — open **public → Tables**, not only the **Schemas** folder.
4. **Backend failed to start** — check the terminal for JDBC connection errors (wrong port, DB missing, bad password).
5. **Refresh needed** — right-click **Tables** in pgAdmin and choose **Refresh**.

## Verify from command line

```powershell
$env:PGPASSWORD='postgres'
psql -h localhost -p 5433 -U postgres -d drdo_poc -c "\dt public.*"
psql -h localhost -p 5433 -U postgres -d drdo_poc -c "SELECT plan_key, plane_name, sort_order FROM public.plans;"
```

## Persistence technology

- **JPA (Hibernate)** via `spring-boot-starter-data-jpa`
- Entity: `com.mydummyapp.geobackend.entity.PlanEntity` (in `backend/`)
- Repository: `com.mydummyapp.geobackend.repository.PlanRepository` (extends `JpaRepository`)
- DDL mode: `update` (creates/alters `public.plans` automatically on startup)

## API documentation (Swagger)

After starting the backend:

- **Swagger UI:** http://localhost:8081/swagger-ui.html
- **OpenAPI JSON:** http://localhost:8081/v3/api-docs

Endpoints documented:

| Method   | Path                   | Description                    |
|----------|------------------------|--------------------------------|
| `GET`    | `/api/plans`           | List saved plans               |
| `GET`    | `/api/plans/dashboard` | Output dashboard snapshot      |
| `POST`   | `/api/plans`           | Save a new plan                |
| `DELETE` | `/api/plans`           | Delete all plans               |
