# EventHub — Ticket Booking Application

A full-stack ticket booking platform built with **Next.js 14**, **Express.js**, **Prisma ORM**, and **MySQL**.

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, React Query v5, TypeScript |
| Backend | Node.js, Express.js, Swagger UI |
| Database | MySQL 8 via Prisma ORM |

---

## Prerequisites

- **Node.js 18+**
- **MySQL 8+** running locally (or a remote instance)
- **npm** (comes with Node.js)

---

## Quick Start

### 1. Clone the repository

```bash
git clone <repo-url>
cd eventhub
```

### 2. Install dependencies

```bash
npm run setup
```

This installs npm packages in both `/backend` and `/frontend`.

### 3. Create the MySQL database

```bash
/usr/local/mysql/bin/mysql -u root -p -e "CREATE DATABASE eventhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Or using the standard `mysql` CLI if it's in your PATH:

```bash
mysql -u root -p -e "CREATE DATABASE eventhub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 4. Configure environment variables

**Backend** — create `/backend/.env`:

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/eventhub"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

**Frontend** — create `/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 5. Push the database schema

```bash
npm run db:push
```

> For a migration-based workflow (creates `/backend/prisma/migrations/`), run `npm run migrate` instead. This command is interactive and requires a terminal.

### 6. Seed the database

```bash
npm run seed
```

Inserts 10 sample events across 5 categories and 5 Indian cities.

### 7. Start both servers

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| Swagger UI | http://localhost:3001/api/docs |

---

## Root Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run setup` | Install npm deps in both `/backend` and `/frontend` |
| `npm run seed` | Insert 10 sample events into the database |
| `npm run migrate` | Run `prisma migrate dev` (interactive, creates migration files) |
| `npm run db:push` | Push schema to DB without migration files (non-interactive) |
| `npm run build` | Build the Next.js frontend for production |

---

## Running the Playwright Tests with Docker

The only thing you need installed is [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on Windows/macOS). You don't need Node, npm, or any browsers.

```bash
git clone <repository-url>
cd eventhub
docker compose run --rm tests
```

The first run builds the image, which is based on `mcr.microsoft.com/playwright` and comes with Chromium preinstalled. Later runs reuse it. The command exits non-zero when a test fails, so you can use it in scripts and CI.

| Task | Command |
|---|---|
| Run the whole suite | `docker compose run --rm tests` |
| Run a single file | `docker compose run --rm tests tests/booking-management.spec.js` |
| Run tests by title | `docker compose run --rm tests -g "test title"` |
| Run against a local frontend | `BASE_URL=http://host.docker.internal:3000 docker compose run --rm tests` |
| Rebuild after changing `package.json` / Playwright version | `docker compose build` |

- **Reports:** `playwright-report/` and `test-results/` are written to your machine. To view the report, open `playwright-report/index.html` in a browser.
- **Editing tests:** `tests/` and `playwright.config.ts` are mounted into the container, so you can edit them and rerun without rebuilding.
- **Upgrading Playwright:** the version in the `Dockerfile` image tag has to match `@playwright/test` in `package-lock.json`.
- **PowerShell:** set the URL first with `$env:BASE_URL="http://host.docker.internal:3000"`, then run the command.

---

## API Endpoints

Base URL: `http://localhost:3001`

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns API status + DB connection status |

### Events

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/events` | List events (paginated, filterable) |
| `GET` | `/api/events/:id` | Get a single event by ID |
| `POST` | `/api/events` | Create a new event |
| `PUT` | `/api/events/:id` | Update an existing event |
| `DELETE` | `/api/events/:id` | Delete an event (cascades bookings) |

**Query params for `GET /api/events`:**

| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by category (Conference, Concert, Sports, Workshop, Festival) |
| `city` | string | Filter by city |
| `search` | string | Full-text search on title, description, venue |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10) |

**POST / PUT `/api/events` body:**
```json
{
  "title": "India Tech Summit 2026",
  "description": "Annual tech conference featuring...",
  "category": "Conference",
  "venue": "Bangalore International Exhibition Centre",
  "city": "Bangalore",
  "eventDate": "2026-09-15T09:00:00.000Z",
  "price": 1500,
  "totalSeats": 2000,
  "imageUrl": "https://example.com/image.jpg"
}
```

### Bookings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/bookings` | List bookings (paginated, filterable by status) |
| `GET` | `/api/bookings/:id` | Get booking by ID |
| `GET` | `/api/bookings/ref/:ref` | Get booking by reference code (e.g. `EVT-A3B2C1`) |
| `POST` | `/api/bookings` | Create a booking (atomically decrements seats) |
| `DELETE` | `/api/bookings/:id` | Cancel a booking (atomically restores seats) |

**POST `/api/bookings` body:**
```json
{
  "eventId": 1,
  "customerName": "Rahul Shetty",
  "customerEmail": "rahul@example.com",
  "customerPhone": "9876543210",
  "quantity": 2
}
```

**Response includes** a unique `bookingRef` (format: `EVT-XXXXXX`), `totalPrice`, and `status: "confirmed"`.

---

## Folder Structure

```
eventhub/
├── package.json              ← Root scripts (dev, setup, seed, migrate)
├── README.md
│
├── backend/
│   ├── app.js                ← Express app setup (CORS, routes, Swagger)
│   ├── server.js             ← HTTP server, DB connect, graceful shutdown
│   ├── .env                  ← Environment variables (not committed)
│   ├── .env.example          ← Template for .env
│   ├── prisma/
│   │   ├── schema.prisma     ← Event + Booking Prisma models
│   │   └── seed.js           ← 10 sample events seeder
│   └── src/
│       ├── config/
│       │   ├── database.js   ← Prisma client singleton
│       │   ├── env.js        ← Validated env vars
│       │   └── swagger.js    ← swagger-jsdoc config
│       ├── controllers/      ← Thin HTTP layer (calls services)
│       │   ├── eventController.js
│       │   └── bookingController.js
│       ├── middleware/
│       │   ├── errorHandler.js   ← Maps domain errors → HTTP responses
│       │   └── requestLogger.js  ← Colorised request logging
│       ├── repositories/     ← Pure Prisma data access
│       │   ├── eventRepository.js
│       │   └── bookingRepository.js
│       ├── routes/           ← Express routers with full Swagger JSDoc
│       │   ├── eventRoutes.js
│       │   └── bookingRoutes.js
│       ├── services/         ← Business logic, validation, transactions
│       │   ├── eventService.js
│       │   └── bookingService.js
│       ├── utils/
│       │   └── errors.js     ← NotFoundError, InsufficientSeatsError, ValidationError
│       └── validators/       ← express-validator middleware
│           ├── eventValidator.js
│           └── bookingValidator.js
│
└── frontend/
    ├── app/                  ← Next.js 14 App Router
    │   ├── layout.tsx        ← Root layout (Providers + Navbar)
    │   ├── page.tsx          ← Home (hero, live stats, featured events)
    │   ├── events/
    │   │   ├── page.tsx      ← Events listing, filters, pagination
    │   │   └── [id]/page.tsx ← Event detail + booking form + confirmation
    │   ├── bookings/
    │   │   ├── page.tsx      ← My bookings list
    │   │   └── [id]/page.tsx ← Booking detail + cancel
    │   └── admin/
    │       ├── events/page.tsx   ← Admin: create/edit/delete events
    │       └── bookings/page.tsx ← Admin: view/cancel all bookings
    ├── components/
    │   ├── ui/               ← Reusable primitives
    │   │   ├── Button.jsx    ← 5 variants, 3 sizes, loading state
    │   │   ├── Input.tsx     ← Extends HTMLInputElement props
    │   │   ├── Select.jsx
    │   │   ├── Badge.jsx     ← 6 variants
    │   │   ├── Spinner.jsx
    │   │   ├── Modal.jsx     ← Portal-based, Escape key, scroll lock
    │   │   ├── EmptyState.tsx
    │   │   ├── ConfirmDialog.jsx
    │   │   ├── Pagination.jsx ← Smart ellipsis pagination
    │   │   └── Toast.tsx     ← Context-based toast system
    │   ├── events/
    │   │   ├── EventCard.jsx     ← Card + skeleton export
    │   │   ├── EventFilters.jsx  ← Debounced search + URL params
    │   │   └── EventForm.jsx     ← Create/edit form
    │   ├── bookings/
    │   │   └── BookingCard.jsx   ← Card + skeleton + cancel
    │   └── layout/
    │       └── Navbar.jsx        ← Sticky, responsive, admin dropdown
    ├── lib/
    │   ├── api/
    │   │   ├── client.js     ← Axios instance with interceptors
    │   │   ├── eventsApi.js
    │   │   └── bookingsApi.js
    │   ├── hooks/
    │   │   ├── useEvents.ts
    │   │   ├── useBookings.ts
    │   │   └── useDebounce.js
    │   └── providers.jsx     ← React Query + Toast providers
    └── types/
        └── index.ts          ← Shared TypeScript interfaces
```

---

## Playwright Test Selectors

All key UI elements have `data-testid` attributes for Playwright automation:

| `data-testid` | Element |
|---|---|
| `event-card` | Each event card in listings |
| `book-now-btn` | "Book Now" link on event card |
| `quantity-input` | Ticket quantity display in booking form |
| `customer-name` | Full name input field |
| `customer-email` | Email input field |
| `customer-phone` | Phone number input field |
| `confirm-booking-btn` | Submit booking button |
| `booking-ref` | Booking reference shown on confirmation |
| `booking-card` | Each booking card in my bookings list |
| `cancel-booking-btn` | Cancel booking button |
| `confirm-dialog-yes` | Confirm button in any confirmation dialog |
| `admin-event-form` | Admin event create/edit form |
| `event-title-input` | Title field in admin form |
| `add-event-btn` | Submit button in admin form |
| `event-table-row` | Each row in the admin events table |
| `edit-event-btn` | Edit button in admin events table row |
| `delete-event-btn` | Delete button in admin events table row |
| `nav-events` | Navbar "Events" link |
| `nav-bookings` | Navbar "My Bookings" link |

**Example Playwright usage:**
```javascript
await page.click('[data-testid="book-now-btn"]');
await page.fill('[data-testid="customer-name"]', 'Rahul Shetty');
await page.fill('[data-testid="customer-email"]', 'rahul@test.com');
await page.fill('[data-testid="customer-phone"]', '9876543210');
await page.click('[data-testid="confirm-booking-btn"]');
await expect(page.locator('[data-testid="booking-ref"]')).toBeVisible();
```
