import { test, expect } from '@playwright/test';

// UI paths are relative so `baseURL` in playwright.config.ts decides the target (prod or localhost).
// The API lives on a separate host in production; override with API_URL when testing locally.
const API_URL       = process.env.API_URL ?? 'https://api.eventhub.rahulshettyacademy.com/api';
const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

const CUSTOMER = {
  customerName:  'E2E Booking Tester',
  customerEmail: 'e2e.tester@example.com',
  customerPhone: '9876543210',
};

// Same formatter the UI uses (BookingCard / booking detail page)
const fmtPrice = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

// ── API helpers (test data setup / teardown) ───────────────────────────────────

async function apiToken(request) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Clears every booking for the test user. Idempotent (200 even when empty). */
async function apiClearBookings(request, token) {
  const res = await request.delete(`${API_URL}/bookings`, { headers: auth(token) });
  expect(res.ok()).toBeTruthy();
}

/** Returns a shared static event that still has enough seats for this user. */
async function apiFindStaticEvent(request, token, minSeats) {
  const res = await request.get(`${API_URL}/events`, { headers: auth(token), params: { limit: 50 } });
  expect(res.ok()).toBeTruthy();
  const { data } = await res.json();
  const event = data.find((e) => e.isStatic && e.availableSeats >= minSeats);
  expect(event, `no static event with >= ${minSeats} seats available`).toBeTruthy();
  return event;
}

async function apiCreateBooking(request, token, eventId, quantity) {
  const res = await request.post(`${API_URL}/bookings`, {
    headers: auth(token),
    data: { eventId, quantity, ...CUSTOMER },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data;
}

async function apiCountBookings(request, token) {
  const res = await request.get(`${API_URL}/bookings`, { headers: auth(token) });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).pagination.total;
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

async function loginViaUi(page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  // Home page loads after login — "Browse Events" link confirms successful auth
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

const bookingCardByRef = (page, ref) =>
  page.getByTestId('booking-card').filter({ has: page.locator('.booking-ref', { hasText: ref }) });

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('Booking Management — E2E (test-strategy §2.4)', () => {
  let token;

  // The account is shared and capped at 9 bookings (FIFO), so start and end with an empty sandbox.
  test.beforeEach(async ({ request }) => {
    token = undefined;
    token = await apiToken(request);
    await apiClearBookings(request, token);
  });

  test.afterEach(async ({ request }) => {
    // Skip cleanup if login failed in beforeEach, so the original error is the one reported
    if (token) await apiClearBookings(request, token);
  });

  // TC-001 ───────────────────────────────────────────────────────────────────
  test('TC-001: bookings list shows booking cards with full details, newest first', async ({ page, request }) => {
    // -- Step 1: Seed two bookings via API (older qty 1, newer qty 2) --
    const event  = await apiFindStaticEvent(request, token, 3);
    const older  = await apiCreateBooking(request, token, event.id, 1);
    const newer  = await apiCreateBooking(request, token, event.id, 2);

    // -- Step 2: Log in and open My Bookings --
    await loginViaUi(page);
    await page.goto('/bookings');
    await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible();

    // -- Step 3: Both bookings are listed, newest first --
    const cards = page.getByTestId('booking-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first().locator('.booking-ref')).toHaveText(newer.bookingRef);
    await expect(cards.nth(1).locator('.booking-ref')).toHaveText(older.bookingRef);

    // -- Step 4: The newer card shows ref, status, id, event, quantity, city, total and actions --
    const card = bookingCardByRef(page, newer.bookingRef);
    await expect(card.getByText('confirmed')).toBeVisible();
    await expect(card.getByTestId('booking-id')).toHaveText(`#${newer.id}`);
    await expect(card.getByRole('heading', { name: event.title })).toBeVisible();
    await expect(card).toContainText('2 tickets');
    await expect(card).toContainText(event.city);
    await expect(card).toContainText(fmtPrice(Number(event.price) * 2));
    await expect(card.getByRole('link', { name: 'View Details' })).toBeVisible();
    await expect(card.getByTestId('cancel-booking-btn')).toBeVisible();

    // -- Step 5: Singular wording for the single-ticket booking --
    // Regex so "11 tickets" / "1 tickets" can't satisfy the check
    await expect(bookingCardByRef(page, older.bookingRef)).toContainText(/🎫 1 ticket(?!s)/);
  });

  // TC-003 (+ TC-102 price display, TC-010 back navigation) ───────────────────
  test('TC-003: booking detail page shows all sections and navigates back to list', async ({ page, request }) => {
    // -- Step 1: Seed a 2-ticket booking via API --
    const event   = await apiFindStaticEvent(request, token, 2);
    const booking = await apiCreateBooking(request, token, event.id, 2);

    // -- Step 2: Log in and open the detail page via View Details --
    await loginViaUi(page);
    await page.goto('/bookings');
    await bookingCardByRef(page, booking.bookingRef).getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(new RegExp(`/bookings/${booking.id}$`));

    // -- Step 3: Breadcrumb and header show the booking ref, status and event title --
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'My Bookings', exact: true })).toBeVisible();
    await expect(main.getByText(booking.bookingRef)).toHaveCount(2); // breadcrumb + header badge
    await expect(main.getByText('confirmed')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(event.title);

    // -- Step 4: Event Details section --
    await expect(page.getByRole('heading', { name: 'Event Details' })).toBeVisible();
    await expect(main).toContainText(event.category);
    await expect(main).toContainText(event.venue);
    await expect(main).toContainText(event.city);

    // -- Step 5: Customer Details section --
    await expect(page.getByRole('heading', { name: 'Customer Details' })).toBeVisible();
    await expect(main.getByText(CUSTOMER.customerName)).toBeVisible();
    await expect(main.getByText(CUSTOMER.customerEmail)).toBeVisible();
    await expect(main.getByText(CUSTOMER.customerPhone)).toBeVisible();

    // -- Step 6: Payment Summary — total = price × quantity (TC-102) --
    await expect(page.getByRole('heading', { name: 'Payment Summary' })).toBeVisible();
    await expect(main).toContainText(`Price per ticket${fmtPrice(Number(event.price))}`);
    await expect(main).toContainText(`Total Paid${fmtPrice(Number(event.price) * 2)}`);

    // -- Step 7: Booking Information and refund entry point --
    await expect(main.getByText(`#${booking.id}`)).toBeVisible();
    await expect(page.getByTestId('check-refund-btn')).toBeVisible();

    // -- Step 8: "← Back to My Bookings" returns to the list (TC-010) --
    await main.getByRole('link', { name: /Back to My Bookings/ }).click();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(bookingCardByRef(page, booking.bookingRef)).toBeVisible();

    // -- Step 9: Breadcrumb "My Bookings" link also returns to the list (TC-010) --
    await page.goto(`/bookings/${booking.id}`);
    await main.getByRole('link', { name: 'My Bookings', exact: true }).click();
    await expect(page).toHaveURL(/\/bookings$/);
  });

  // TC-004 ───────────────────────────────────────────────────────────────────
  test('TC-004: "Clear all bookings" removes every booking after confirming', async ({ page, request }) => {
    // -- Step 1: Seed two bookings via API --
    const event = await apiFindStaticEvent(request, token, 2);
    await apiCreateBooking(request, token, event.id, 1);
    await apiCreateBooking(request, token, event.id, 1);

    // -- Step 2: Log in and verify both bookings are listed --
    await loginViaUi(page);
    await page.goto('/bookings');
    await expect(page.getByTestId('booking-card')).toHaveCount(2);

    // -- Step 3: Accept the native confirm dialog, checking its message --
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.getByRole('button', { name: 'Clear all bookings' }).click();

    // -- Step 4: Empty state replaces the list --
    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(page.getByTestId('booking-card')).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('link', { name: 'Browse Events' })).toBeVisible();
    expect(dialogMessage).toBe('Clear all your bookings? This cannot be undone.');

    // -- Step 5: Backend confirms nothing is left --
    expect(await apiCountBookings(request, token)).toBe(0);
  });
});

// ── Legacy tests — pending rewrite per docs/test-strategy.md §2.4 / §5 ──────────
// These still create data through the UI and use the old scenario numbering
// (TC-006 → TC-009, TC-102 → fold into TC-009; TC-005 already renumbered).

const BASE_URL = 'https://eventhub.rahulshettyacademy.com';

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

async function bookEvent(page) {
  await page.goto(`${BASE_URL}/events`);
  const firstCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(firstCard).toBeVisible();
  const eventTitle = (await firstCard.locator('h3').textContent())?.trim() ?? '';
  await firstCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);
  await page.getByLabel('Full Name').fill('Test User');
  await page.locator('#customer-email').fill('testuser@example.com');
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  await page.locator('.confirm-booking-btn').click();
  const refEl = page.locator('.booking-ref').first();
  await expect(refEl).toBeVisible();
  const bookingRef = (await refEl.textContent())?.trim() ?? '';
  return { bookingRef, eventTitle };
}

async function clearBookings(page) {
  await page.goto(`${BASE_URL}/bookings`);
  const alreadyEmpty = await page.getByText('No bookings yet').isVisible().catch(() => false);
  if (alreadyEmpty) return;
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

test.describe('Booking Management — Legacy (pending rewrite)', () => {

  test('TC-006: navigates to bookings list after booking via View My Bookings link', async ({ page }) => {
    // -- Step 1: Login and clear state --
    await login(page);
    await clearBookings(page);

    // -- Step 2: Book the first available event --
    await page.goto(`${BASE_URL}/events`);
    const firstCard = page.getByTestId('event-card').filter({
      has: page.getByTestId('book-now-btn'),
    }).first();
    await expect(firstCard).toBeVisible();
    await firstCard.getByTestId('book-now-btn').click();
    await expect(page).toHaveURL(/\/events\/\d+/);

    await page.getByLabel('Full Name').fill('Test User');
    await page.locator('#customer-email').fill('testuser@example.com');
    await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
    await page.locator('.confirm-booking-btn').click();

    // -- Step 3: Confirm booking ref appears on confirmation card --
    const refEl = page.locator('.booking-ref').first();
    await expect(refEl).toBeVisible();
    const bookingRef = (await refEl.textContent())?.trim() ?? '';

    // -- Step 4: Click "View My Bookings" link on confirmation card --
    await page.getByRole('link', { name: 'View My Bookings' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);

    // -- Step 5: Assert the new booking appears in the list --
    const bookingCard = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(bookingCard).toBeVisible();
  });

  test('TC-102: booking reference starts with first letter of event title (uppercase)', async ({ page }) => {
    // -- Step 1: Login and clear state --
    await login(page);
    await clearBookings(page);

    // -- Step 2: Book first available event and capture title --
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 3: Assert ref starts with the event title's first char --
    const expectedPrefix = eventTitle[0].toUpperCase();
    expect(bookingRef).toMatch(new RegExp(`^${expectedPrefix}-[A-Z0-9]{6}$`));
  });

  test('TC-005: cancels booking from detail page — shows toast and redirects', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookEvent(page);

    // -- Step 2: Navigate to booking detail via View Details --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click Cancel Booking button on detail page --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();

    // -- Step 4: Assert React confirmation dialog appears --
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    await expect(page.locator('#confirm-dialog-yes')).toBeVisible();

    // -- Step 5: Confirm cancellation --
    await page.locator('#confirm-dialog-yes').click();

    // -- Step 6: Assert redirect to /bookings and success toast --
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();

    // -- Step 7: Assert booking is no longer in the list --
    await expect(page.getByText('No bookings yet')).toBeVisible();
  });
});
