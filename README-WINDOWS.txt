myDummyApp — Windows setup (npm start / ng serve)
=================================================

PROJECT LAYOUT
--------------
  frontend/   Angular app (npm start)
  backend/    Spring Boot API (mvn spring-boot:run)

PREREQUISITES
-------------
- Node.js 20.19+ OR 22.12+ OR 24+  →  https://nodejs.org
- (Optional backend) JDK 21+ + Maven


FIRST TIME ONLY
---------------
Install frontend dependencies (needs internet once):

  cd frontend
  npm install


RUN FRONTEND (every time)
-------------------------
  .\START-FRONTEND.bat

Or:

  cd frontend
  npm start

Open: http://localhost:4200/dashboard


RUN BACKEND
-----------
In a second terminal:

  .\START-BACKEND.bat

Or:

  cd backend
  mvn spring-boot:run

Swagger UI: http://localhost:8081/swagger-ui.html


TROUBLESHOOTING
---------------
Error: Cannot find module @rollup/rollup-win32-x64-msvc
  → Run npm install inside frontend/

Error: npm ERESOLVE / peer dependency
  → cd frontend && npm install
  → .npmrc in frontend/ sets legacy-peer-deps=true

Node version too old
  → Install Node 20.19+ or 22.12+ or 24+

Plans not saving
  → Ensure backend is running on port 8081 and PostgreSQL drdo_poc is up on 5433
