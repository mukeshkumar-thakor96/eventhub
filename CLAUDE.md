# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
EventHub is a full-stack event ticket booking platform built for QA training. Users browse events, book tickets, manage bookings, and create events. Each user operates in an isolated sandbox (see "Per-user sandboxing" below).

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript (mixed with some `.jsx`/`.js`), Tailwind CSS, React Query v5 — port 3000
- **Backend**: Express.js (plain JavaScript, JSDoc), Prisma 5 ORM, MySQL 8+, express-validator, Swagger UI — port 3001
- **Auth**: JWT (7-day expiry), bcryptjs
- **Testing**: Playwright E2E (Chromium only)

## Commands
```bash
npm run setup        # Install deps in backend/ and frontend/ (root has only Playwright + concurrently)
npm run dev          # Start backend (nodemon) + frontend (next dev) concurrently
npm run db:push      # Push Prisma schema to DB (non-interactive)
npm run migrate      # prisma migrate dev (interactive)
npm run seed         # Seed 10 static events
npm run build        # Build the Next.js frontend
npm run lint         # next lint (frontend only; backend has no linter)

npm run test                                               # All Playwright tests
npm run test:ui                                            # Playwright UI mode
npx playwright test tests/<file>.spec.js --reporter=line   # Single file
npx playwright test -g "<test title>" --reporter=line      # Single test by title
docker compose up --build                                  # Run tests in the Playwright container
```

Checks that CI (`.github/workflows/ci.yml`) runs on PRs — run these locally before pushing:
```bash
cd backend && node --check server.js && node --check app.js
cd backend && npx prisma validate && npx prisma format   # CI fails if format changes schema.prisma
cd frontend && npx tsc --noEmit && npm run build
```

Env setup: `backend/.env` (`DATABASE_URL`, `PORT`, `CORS_ORIGIN`, `JWT_SECRET`; see `backend/.env.example`) and `frontend/.env.local` (`NEXT_PUBLIC_API_URL=http://localhost:3001/api`). Swagger docs at `http://localhost:3001/api/docs`.

## Important: Tests run against the live site
`playwright.config.ts` sets `baseURL` to `https://eventhub.rahulshettyacademy.com`, **not** localhost. The Playwright workflow (`playwright.yml`) runs the suite against production on every push to `main`. To test local changes, override `baseURL` temporarily. `fullyParallel: false`, `retries: 0`, 5s expect timeout.

## Architecture

### Backend (`backend/`)
`server.js` (DB connect, shutdown) → `app.js` (CORS, Swagger, routes under `/api/auth`, `/api/events`, `/api/bookings`) → Routes → Controllers → Services → Repositories → Prisma.
- **Routes** hold the Swagger JSDoc and attach `authMiddleware` + validators.
- **Services** hold all business logic; they throw domain errors from `src/utils/errors.js` (`NotFoundError`, `ForbiddenError`, `ValidationError`, ...), which `middleware/errorHandler.js` maps to HTTP responses.
- **Repositories** are pure Prisma access and take `userId` to scope queries.
- `authMiddleware` reads `Authorization: Bearer <token>` and sets `req.user = { userId, email }`.

### Per-user sandboxing (cross-cutting; read before changing events/bookings)
- Events are either **static** (`isStatic: true`, seeded, shared, immutable) or **dynamic** (owned by `userId`). Event queries use `OR: [{ isStatic: true }, { userId }]`.
- `availableSeats` returned to clients is **computed per user** in `eventService.withPersonalSeats`: the DB value minus that user's own booked quantity. One user's bookings never change another user's seat counts.
- FIFO limits live in the services: `MAX_USER_DYNAMIC_EVENTS = 6` (`eventService`) and `MAX_USER_BOOKINGS = 9` (`bookingService`). When a booking would overflow, the oldest booking for a *different* event is pruned first, falling back to the same event.
- Booking refs are `<first letter of event title, uppercased>-<8 base36 chars>`. The `EVT-XXXXXX` format in the README is outdated.
- Accessing another user's booking throws `ForbiddenError` (UI shows "Access Denied").

### Frontend (`frontend/`)
- Pages are in `app/` (events, bookings, admin). Data goes through React Query hooks in `lib/hooks/` (`useEvents`, `useBookings`, `useAuth`) that wrap the API modules in `lib/api/`.
- The axios client (`lib/api/client.js`) attaches the JWT from `localStorage['eventhub_token']` and clears it on 401. `lib/api/` contains both `.js` and `.ts` versions of the client modules. Check which one a file imports before you edit.
- Refund eligibility (1 ticket = eligible, >1 = not) is computed **client-side** only.

## Testing Conventions
- Test files go in `tests/` as `<feature-name>.spec.js` (JavaScript, not TS).
- Locator priority: data-testid > role > label/placeholder > ID > CSS class.
- No `page.waitForTimeout()`. Use web-first assertions such as `expect().toBeVisible()`.
- Tests must be self-contained (login → action → assert) and leave the shared account in a usable state, because the FIFO limits apply to it.
- Test account: `rahulshetty1@gmail.com` / `Magiclife1!`
- Add step comments in tests.

## Project Skills (`.claude/skills/`)
These skills hold the detailed guidance. Load the relevant one before writing or reviewing tests:
- `eventhub-domain`: business rules, API reference, UI selectors (`ui-selectors.md`), user flows
- `playwright-best-practices`: testing standards
- `generate-tests <feature>`: generates Playwright tests
- `review-tests <file>`: reviews test code quality
- `create-scenarios <area>`: writes test scenario docs (output in `docs/test-scenarios.md`)
- `test-strategy <scenarios>`: assigns tests to pyramid layers (output in `docs/test-strategy.md`)
