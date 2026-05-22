# Workforce Scheduler

Initial project skeleton for the take-home assignment.

## Stack

- Frontend: Vite + React + TypeScript
- Backend: Express + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Container orchestration: Docker Compose

Starter used:

- Frontend started from the standard Vite React + TypeScript scaffold.
- Backend is a small custom Express + TypeScript setup rather than a larger starter template.

## Current Status

This project currently includes:

- PostgreSQL running in Docker
- Express API running in Docker
- React app running in Docker
- `GET /api/health` endpoint
- Cookie-based JWT authentication endpoints
- Role middleware for authenticated and supervisor-only routes
- Core schedule API endpoints for weekly schedule reads and assignment updates
- Basic CORS configuration for local development
- Prisma schema, migration, and seed data for the initial workforce domain
- React frontend with role-based supervisor and staff scheduling views

This project still does not include:

- Advanced scheduling UX like drag-and-drop or calendar views

## Project Structure

```text
workforce-scheduler/
  README.md
  docker-compose.yml
  .env.example
  .gitignore

  api/
    Dockerfile
    package.json
    tsconfig.json
    prisma/
      schema.prisma
      seed.ts
    src/
      index.ts
      app.ts
      db.ts

  web/
    Dockerfile
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      main.tsx
      App.tsx
      apiClient.ts
      styles.css
```

## Setup

1. Copy the example environment file if you want local overrides:

   ```bash
   cp .env.example .env
   ```

2. Start everything:

   ```bash
   docker compose up --build
   ```

   This starts PostgreSQL, runs Prisma migrations, seeds the database, starts the API, and starts the web app.

3. Open the app:

   - Web: [http://localhost:5173](http://localhost:5173)
   - API health: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## Environment Variables

The Docker setup already provides sensible defaults, but these are the expected values:

```env
POSTGRES_DB=workforce_scheduler
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432
API_PORT=4000
WEB_PORT=5173
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@db:5432/workforce_scheduler?schema=public
JWT_SECRET=change-me-in-local-dev
```

## Useful Commands

### API

```bash
cd api
npm install
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed
npm run typecheck
npm run build
```

### Web

```bash
cd web
npm install
npm run typecheck
npm run build
```

## Next Steps

- Refine the schedule UI and add richer editing ergonomics

## Database Workflow

### Run migrations

```bash
cd api
npm run prisma:migrate
```

For a containerized workflow, you can also run:

```bash
docker compose up --build -d
docker compose exec api npm run prisma:migrate
```

### Run seed

```bash
cd api
npm run prisma:seed
```

Or inside Docker:

```bash
docker compose exec api npm run prisma:seed
```

The seed is written to be safe to re-run. It uses upserts for the base records and resets only the seeded shift assignments that are meant to remain unassigned.

## Assumptions

- Scheduling is managed one week at a time.
- Weekly hour limits are calculated from shifts whose `startAt` falls within a Monday-to-Monday window.
- Back-to-back shifts are allowed, but overlapping shifts are not.
- The seeded dataset is a demo fixture for the week starting `2026-01-05`.
- Staff users are read-only in the UI and can only view their own assigned shifts.

## Trade-Offs

- The frontend uses plain React state and simple fetch calls instead of a larger state or data-fetching library.
- The schedule editor uses dropdowns rather than drag-and-drop to keep the solution straightforward and easy to review.
- The API keeps validation in route-adjacent code plus a small rules module instead of introducing a more complex service layer.
- The Docker setup seeds automatically on startup for reviewer convenience, even though a larger production app might separate startup, migrations, and seeding more strictly.

## Seeded Login Details

These credentials are seeded and can now be used with the login endpoint:

- `supervisor@example.com` / `password123`
- `alice@example.com` / `password123`
- `bob@example.com` / `password123`
- `carol@example.com` / `password123`
- `dan@example.com` / `password123`
- `eve@example.com` / `password123`

## Auth Overview

Authentication currently works like this:

- `POST /api/auth/login` checks the email and bcrypt password hash
- On success, the API sets a JWT in an HttpOnly cookie
- `GET /api/me` returns the logged-in user from that cookie
- `POST /api/auth/logout` clears the auth cookie
- `GET /api/auth/supervisor-check` is a simple protected route for supervisor-only access

Role middleware:

- `requireAuth` returns `401` for unauthenticated requests
- `requireSupervisor` returns `403` for logged-in staff users on supervisor-only routes

Required auth environment variable:

- `JWT_SECRET`

Do not use a real production secret in this repo. Keep it in your local `.env`.

## Manual Auth Testing

### Test supervisor login with curl

```bash
curl -i -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"supervisor@example.com","password":"password123"}'
```

Then confirm the logged-in user:

```bash
curl -i -b cookies.txt http://localhost:4000/api/me
```

Then confirm supervisor-only access:

```bash
curl -i -b cookies.txt http://localhost:4000/api/auth/supervisor-check
```

### Test staff login with curl

```bash
curl -i -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
```

Then confirm staff access is authenticated:

```bash
curl -i -b cookies.txt http://localhost:4000/api/me
```

Then confirm supervisor-only access is blocked:

```bash
curl -i -b cookies.txt http://localhost:4000/api/auth/supervisor-check
```

### Test logout with curl

```bash
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:4000/api/auth/logout
curl -i -b cookies.txt http://localhost:4000/api/me
```

The second command should return `401`.

## Schedule API

Available endpoints:

- `GET /api/sites`
- `GET /api/schedule?siteId=<siteId>&weekStart=YYYY-MM-DD`
- `PUT /api/shifts/:shiftId/assignment`
- `GET /api/staff`
- `GET /api/my-shifts?weekStart=YYYY-MM-DD`

Access rules:

- `GET /api/sites` requires authentication
- `GET /api/schedule` requires authentication
- `PUT /api/shifts/:shiftId/assignment` requires supervisor role
- `GET /api/staff` requires supervisor role
- `GET /api/my-shifts` requires authentication and returns only the logged-in user's assigned shifts

Scheduling rules enforced by the API:

- A staff member cannot be assigned to overlapping shifts
- Back-to-back shifts are allowed
- A staff member cannot exceed 40 scheduled hours in a Monday-to-Monday week
- A staff member cannot be assigned to a shift requiring a certification they do not have

Validation error codes:

- `SHIFT_OVERLAP`
- `WEEKLY_HOURS_EXCEEDED`
- `CERTIFICATION_REQUIRED`

Known limitation:

- The full schedule frontend is not built yet. Use the API directly for schedule and assignment testing.

## Manual Schedule Testing

Start by logging in as a supervisor and saving the cookie:

```bash
curl -i -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"supervisor@example.com","password":"password123"}'
```

### Read the weekly schedule

If your local database has been reseeded multiple times, numeric IDs may differ. To find the current site IDs:

```bash
docker compose exec db psql -U postgres -d workforce_scheduler -c \
  'SELECT id, name FROM "Site" ORDER BY id;'
```

On the database I verified in this task, `Central Operations Hub` is `siteId=4`.

```bash
curl -i -b cookies.txt \
  "http://localhost:4000/api/schedule?siteId=4&weekStart=2026-01-05"
```

### Read staff list

```bash
curl -i -b cookies.txt http://localhost:4000/api/staff
```

### Make a valid assignment

First check `/api/staff` for current staff profile IDs. On the database I verified here:

- Alice = `staffId=1`
- Carol = `staffId=2`
- Bob = `staffId=3`
- Dan = `staffId=4`
- Eve = `staffId=5`

Then assign Dan to the unassigned Tuesday afternoon shift `shiftId=5`:

```bash
curl -i -b cookies.txt -X PUT http://localhost:4000/api/shifts/5/assignment \
  -H "Content-Type: application/json" \
  -d '{"staffId": 4}'
```

To unassign:

```bash
curl -i -b cookies.txt -X PUT http://localhost:4000/api/shifts/5/assignment \
  -H "Content-Type: application/json" \
  -d '{"staffId": null}'
```

### Read a staff user's own shifts

```bash
curl -i -c staff-cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'

curl -i -b staff-cookies.txt \
  "http://localhost:4000/api/my-shifts?weekStart=2026-01-05"
```

### Example invalid rule checks

Missing certification:

```bash
curl -i -b cookies.txt -X PUT http://localhost:4000/api/shifts/3/assignment \
  -H "Content-Type: application/json" \
  -d '{"staffId": 1}'
```

This attempts to place Alice on a night shift that requires `Electrical`.

Weekly hours:

- Bob starts the seeded week at 24 hours from night shifts.
- Assign Bob to `shiftId=6` and `shiftId=9` to reach exactly 40 hours.
- Then try `shiftId=18` to trigger `WEEKLY_HOURS_EXCEEDED`.

```bash
curl -i -b cookies.txt -X PUT http://localhost:4000/api/shifts/6/assignment \
  -H "Content-Type: application/json" \
  -d '{"staffId": 3}'

curl -i -b cookies.txt -X PUT http://localhost:4000/api/shifts/9/assignment \
  -H "Content-Type: application/json" \
  -d '{"staffId": 3}'

curl -i -b cookies.txt -X PUT http://localhost:4000/api/shifts/18/assignment \
  -H "Content-Type: application/json" \
  -d '{"staffId": 3}'
```

For a true overlap check, create a temporary overlapping shift in Postgres and then assign it through the API:

```bash
docker compose exec db psql -U postgres -d workforce_scheduler -c \
  "INSERT INTO \"Shift\" (\"siteId\", \"kind\", \"startAt\", \"endAt\", \"requiredCertificationId\", \"createdAt\", \"updatedAt\") VALUES (4, 'MORNING', '2026-01-05 10:00:00+00', '2026-01-05 18:00:00+00', 3, NOW(), NOW());"
```

Then find the new shift ID and assign it to Alice, who already has the Monday morning shift:

```bash
docker compose exec db psql -U postgres -d workforce_scheduler -c \
  'SELECT id, "startAt", "endAt" FROM "Shift" WHERE "siteId" = 4 ORDER BY id DESC LIMIT 3;'

curl -i -b cookies.txt -X PUT http://localhost:4000/api/shifts/NEW_SHIFT_ID/assignment \
  -H "Content-Type: application/json" \
  -d '{"staffId": 1}'
```

## Frontend Usage

### Supervisor UI

1. Open [http://localhost:5173](http://localhost:5173)
2. Log in as `supervisor@example.com` with `password123`
3. The app will load the weekly schedule builder for the current Monday
4. If you want to inspect the seeded data, change `Week Start` to `2026-01-05`
5. The UI uses a single site view and loads the seeded site automatically
6. Use the dropdown inside each shift cell to assign, reassign, or unassign staff
7. If a rule is violated, the API message is shown directly in the page

### Staff UI

1. Open [http://localhost:5173](http://localhost:5173)
2. Log in as `alice@example.com` with `password123`
3. If you want to inspect the seeded data, change `Week Start` to `2026-01-05`
4. The app will show a read-only `My Shifts` view for that week
5. Staff users do not see assignment controls

### Seeded Credentials

- `supervisor@example.com` / `password123`
- `alice@example.com` / `password123`
- `bob@example.com` / `password123`
- `carol@example.com` / `password123`
- `dan@example.com` / `password123`
- `eve@example.com` / `password123`

### Known UI Limitations

- I kept the UI to a single-site weekly view because that seemed closest to the brief. The backend can support multiple sites, but I did not build a broader multi-site scheduling workflow.
- The page starts on the current Monday. Since the seeded demo data is for `2026-01-05`, reviewers will need to switch the week to see the sample schedule right away.
- The schedule editor uses simple dropdowns. It is functional, but not especially fast for heavy editing.
- Validation messages are shown inline in the page, but there is no history, audit trail, or activity log.

## What I Would Improve With More Time

- I would add a few integration tests around the authenticated schedule routes, especially for assignment updates and error cases.
- I would make the seeded demo week easier to discover in the UI so a reviewer does not need the README to find the sample data.
- I would break the main React screen into a few smaller components once the behavior grows any further. For this take-home, I kept it in one place to avoid introducing extra structure too early.
- If this were going beyond a take-home, I would separate app startup, migrations, and seeding more cleanly instead of doing them together for Docker convenience.

## Optional Extensions

I did not implement the optional extensions. I focused on getting the required scheduling rules, role checks, Docker setup, and core scheduling flow working correctly first.

## Seeded Data Overview

The seed creates:

- 1 supervisor user
- 5 staff users
- 4 sites
- 3 certifications
- Mixed staff certifications
- 1 week of shifts for `Central Operations Hub`
- Morning, afternoon, and night shifts
- A mix of assigned and unassigned shifts
