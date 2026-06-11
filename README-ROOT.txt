# myDummyApp

Monorepo with two folders:

| Folder | Stack | Run |
|--------|-------|-----|
| `frontend/` | Angular 21, PrimeNG, OpenLayers | `cd frontend && npm start` or `START-FRONTEND.bat` |
| `backend/` | Spring Boot 3, JPA, PostgreSQL, Swagger | `cd backend && mvn spring-boot:run` or `START-BACKEND.bat` |

- Frontend: http://localhost:4200/dashboard
- Swagger: http://localhost:8081/swagger-ui.html
- Database: `drdo_poc` on PostgreSQL port 5433 (see `backend/DATABASE.md`)

See `README-WINDOWS.txt` for Windows setup and `README.md` for the full developer guide.
