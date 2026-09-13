import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { apiToken, auth, featureUrl, loginAs, unique, watchErrors } from "../helpers/session";

/**
 * The admin dashboard, checked against the aggregate that feeds it.
 *
 * `01-page-health` already proves this page renders without a console error,
 * and `pages/01-dashboard` proves its headings and quick-action modals exist.
 * Neither reads a single number, and the numbers are the page — six KPI tiles,
 * three breakdowns and two tables, all of them derived server-side precisely so
 * the browser cannot come to its own answer (see `packages/shared/dashboard.ts`,
 * rule 1: NOTHING here is recomputed on the client).
 *
 * So this file asserts agreement rather than presence: what the API sent is
 * what the page shows, the window on the button is the window that was asked
 * for, the chart adds up to the tiles above it, and the role decides the scope.
 * A test that only checked a label would pass while the page displayed a total
 * from the wrong month.
 */

const DASHBOARD = /\/api\/v1\/dashboard\?/;

/**
 * A window wide enough to hold the dataset whatever year it sits in.
 *
 * The seed pins its projection month to a literal (`PERIOD` in
 * `packages/db/prisma/seed-promech.ts`), so a test window written as a literal
 * year would agree with it today and quietly start asserting over zero rows the
 * day either one moved — passing, while proving nothing. Asking for everything
 * and then checking the answer is not empty cannot rot that way.
 */
const EVERYTHING = "from=2000-01-01&to=2099-12-31";

interface Breakdown {
  id: string;
  name: string;
  committed: number;
  achieved: number;
  target: number | null;
}
interface Dash {
  from: string;
  to: string;
  months: string[];
  kpis: {
    recurringCommitted: number;
    recurringAchieved: number;
    newSalesCommitted: number;
    newSalesAchieved: number;
    totalCommitted: number;
    totalAchieved: number;
    followUpsDue: number;
    followUpsOverdue: number;
    target: number | null;
  };
  bySalesperson: Breakdown[];
  byPrincipal: Breakdown[];
  byCategory: { tier: string; committed: number; achieved: number }[];
  oralConfirmationDeals: { customerName: string }[];
  oralConfirmationTotal: number;
  topOpenProjections: { projValue: number }[];
  followUps: {
    id: string;
    entityType: "Customer" | "Lead" | "Order" | "Payment" | "Projection";
    entityId: string;
    title: string;
    ownerName: string | null;
    dueDate: string;
    daysOverdue: number;
    amount: number | null;
  }[];
}

type Role = "admin" | "mgmt" | "sales";

/**
 * One token per role per worker, so a capture costs a GET rather than a
 * sign-in. The API throttles logins, and a spec that authenticated per
 * assertion would start meeting 429s halfway through the suite.
 *
 * Keyed by role, not shared: the aggregate is scoped to the caller, so
 * re-reading a sales user's window with an admin token answers a different
 * question and the assertion would be checking the wrong page's numbers.
 */
const tokens = new Map<Role, Promise<string>>();
function token(request: APIRequestContext, role: Role) {
  const held = tokens.get(role) ?? apiToken(request, role);
  tokens.set(role, held);
  return held;
}

/**
 * Run `action`, then answer with the window the page asked for and the aggregate
 * that window returns.
 *
 * The reply is fetched again over the API rather than read out of the browser's
 * copy. Reading it there worked in isolation and failed under the full suite:
 * a response body is discarded the moment the page navigates away from it, so
 * whether a capture succeeded depended on what the app happened to do next. A
 * request's URL never expires, and the aggregate is a pure read, so asking for
 * the same window twice is the same answer without the race.
 */
const lastCapture = new WeakMap<Page, string>();

async function captureDashboard(
  page: Page,
  request: APIRequestContext,
  role: Role,
  action: () => Promise<unknown>,
): Promise<{ query: URLSearchParams; body: Dash }> {
  // Ignore a repeat of the window already captured. The page can have a second
  // request for the CURRENT window still in flight — the workspace settles
  // after the first paint and the query refetches — and matching that one
  // instead of the one the click caused reported the old window's query,
  // which read as "the filter never reached the API".
  const previous = lastCapture.get(page);
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => DASHBOARD.test(r.url()) && r.status() === 200 && new URL(r.url()).search !== previous,
      { timeout: 20000 },
    ),
    action(),
  ]);
  const url = new URL(res.url());
  lastCapture.set(page, url.search);
  const again = await request.get(url.pathname + url.search, {
    headers: auth(await token(request, role)),
  });
  expect(again.status(), `re-reading ${url.search}`).toBe(200);
  return { query: url.searchParams, body: (await again.json()) as Dash };
}

/**
 * Sign in, let the landing page finish, then open the dashboard and keep the
 * aggregate it asked for.
 *
 * The settle in the middle is load-bearing: `loginAs` lands on the workspace,
 * which fires a dashboard request of its own, and without waiting for it the
 * next capture matches that one instead of the navigation's.
 */
async function openDashboard(page: Page, request: APIRequestContext, role: Role) {
  await loginAs(page, role);
  await page.waitForLoadState("networkidle");
  return captureDashboard(page, request, role, () => page.goto(featureUrl("dashboard")));
}

/**
 * Reverse of the console's `lakhs()` tile formatter — "₹12.5L" back to 1250000.
 *
 * The test parses rather than re-formats on purpose. Asserting the exact string
 * would pin the house style and fail the day a tile gains a space; parsing
 * still catches the only defect that matters here, which is a tile showing a
 * DIFFERENT number from the one the server sent.
 */
function parseTile(text: string): { value: number; step: number } {
  const m = text.replace(/[\s,]/g, "").match(/^₹(-?[\d.]+)(Cr|L|K)?$/);
  if (!m) throw new Error(`not a money tile: ${JSON.stringify(text)}`);
  const scale = m[2] === "Cr" ? 1_00_00_000 : m[2] === "L" ? 1_00_000 : m[2] === "K" ? 1_000 : 1;
  // How much one displayed digit is worth: ₹12.5L resolves to 0.1L, so any
  // figure within half of that rounds to the same tile.
  const decimals = (m[1].split(".")[1] ?? "").length;
  return { value: Number(m[1]) * scale, step: (scale * 10 ** -decimals) / 2 };
}

/** The value line of the KPI tile whose label starts with `label`. */
function tile(page: Page, label: string) {
  return page
    .getByText(new RegExp(`^${label}`, "i"))
    .first()
    .locator("xpath=..")
    .locator(".tabular-nums")
    .first();
}

async function expectTile(page: Page, label: string, expected: number) {
  const text = (await tile(page, label).innerText()).trim();
  const { value, step } = parseTile(text);
  expect(Math.abs(value - expected), `${label} shows ${text}, API sent ${expected}`).toBeLessThanOrEqual(step);
}

/**
 * Open the window picker, or leave it open if it already is.
 *
 * The trigger is a toggle and the granularity tabs deliberately do NOT close
 * the popover — changing length is something you do while still looking at the
 * calendar — so clicking the trigger unconditionally would shut it again.
 */
const openPicker = async (page: Page) => {
  const trigger = page.getByRole("button", { name: /^Reporting window:/ });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(page.getByRole("dialog", { name: "Choose a reporting window" })).toBeVisible();
};

test.describe("Admin dashboard — the page agrees with its aggregate", () => {
  test("every KPI tile shows the figure the server sent", async ({ page, request }) => {
    const watch = watchErrors(page);
    const { body } = await openDashboard(page, request, "admin");
    await expect(page.getByRole("heading", { name: /Revenue Performance/i })).toBeVisible();

    const k = body.kpis;
    await expectTile(page, "Recurring committed", k.recurringCommitted);
    await expectTile(page, "Recurring achieved", k.recurringAchieved);
    await expectTile(page, "New sales committed", k.newSalesCommitted);
    await expectTile(page, "Total committed", k.totalCommitted);
    await expectTile(page, "Total achieved", k.totalAchieved);

    // The follow-ups tile is a count, not money: due AND overdue, since an
    // overdue follow-up is still one you owe somebody.
    await expect(tile(page, "Follow-ups due")).toHaveText(
      String(k.followUpsDue + k.followUpsOverdue),
    );

    watch.assertClean();
  });

  test("the totals are the sum of the salesperson chart under them", async ({ page, request }) => {
    // Asserted against the payload rather than the pixels: a chart bar cannot
    // be read back, but a dashboard whose tiles and chart disagree is the
    // thing users notice first, and the invariant is what makes them agree.
    const token = await apiToken(request, "admin");
    const res = await request.get(`/api/v1/dashboard?${EVERYTHING}`, { headers: auth(token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Dash;

    // Over a window with rows in it, or the sums below are 0 === 0 and prove
    // nothing. This is the assertion that fails when the dataset is gone.
    expect(
      body.kpis.totalCommitted,
      "no committed value in any period — re-seed with db:seed:promech",
    ).toBeGreaterThan(0);

    const sum = (f: (b: Breakdown) => number) => body.bySalesperson.reduce((a, b) => a + f(b), 0);
    expect(sum((b) => b.committed)).toBeCloseTo(body.kpis.totalCommitted, 2);
    expect(sum((b) => b.achieved)).toBeCloseTo(body.kpis.totalAchieved, 2);

    // Both recurring-only breakdowns answer for the recurring half, and only
    // that half — a lead carries no principal and no customer tier.
    const rec = body.kpis.recurringCommitted;
    expect(body.byPrincipal.reduce((a, b) => a + b.committed, 0)).toBeCloseTo(rec, 2);
    expect(body.byCategory.reduce((a, c) => a + c.committed, 0)).toBeCloseTo(rec, 2);

    // Top open projections are capped and ordered by value, which is what
    // makes the list worth reading top-down.
    expect(body.topOpenProjections.length).toBeLessThanOrEqual(10);
    const values = body.topOpenProjections.map((p) => p.projValue);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  test("the oral-confirmation table lists exactly the deals in the payload", async ({ page, request }) => {
    const { body } = await openDashboard(page, request, "admin");

    const section = page.getByText(/Deals at Oral Confirmation/i).first().locator("xpath=ancestor::*[self::div][2]");
    await expect(section).toBeVisible();
    await expect(section.getByText(new RegExp(`${body.oralConfirmationTotal} deals?`))).toBeVisible();

    for (const deal of body.oralConfirmationDeals) {
      await expect(page.getByText(deal.customerName, { exact: false }).first()).toBeVisible();
    }
  });

  test("the category mix always names the four tiers, in order", async ({ page, request }) => {
    const { body } = await openDashboard(page, request, "admin");

    // Four rows every time, even at zero: a tier that vanished when it had no
    // commitments would read as a tier that does not exist.
    expect(body.byCategory.map((c) => c.tier)).toEqual(["Platinum", "Gold", "Silver", "Brass"]);
    for (const tier of ["Platinum", "Gold", "Silver", "Brass"]) {
      await expect(page.getByText(`${tier} Customers`)).toBeVisible();
    }
  });
});

/** "₹1,92,000" back to 192000 — the full-grouping formatter the tables use. */
const parseInr = (text: string) => Number(text.replace(/[₹,\s]/g, ""));

/** Widen to the year, which is the window the seeded data actually sits in. */
async function openYearAsAdmin(page: Page, request: APIRequestContext) {
  await openDashboard(page, request, "admin");
  await openPicker(page);
  const year = await captureDashboard(page, request, "admin", () =>
    page.getByRole("tab", { name: "Year", exact: true }).click(),
  );
  await page.keyboard.press("Escape");
  return year;
}

test.describe("Admin dashboard — the breakdowns under the tiles", () => {
  test.describe.configure({ timeout: 60_000 });

  test("the salesperson chart draws every salesperson the payload names", async ({
    page,
    request,
  }) => {
    const { body } = await openYearAsAdmin(page, request);
    expect(body.bySalesperson.length, "no salesperson has any commitment").toBeGreaterThan(0);

    const chart = page.getByText(/Committed vs achieved by salesperson/i).locator("xpath=../..");
    await expect(chart.getByText(/No data available/i)).toHaveCount(0);
    for (const person of body.bySalesperson) {
      await expect(chart.getByText(person.name, { exact: true }).first()).toBeVisible();
    }
  });

  test("principal performance shows each principal's own achieved over committed", async ({
    page,
    request,
  }) => {
    const { body } = await openYearAsAdmin(page, request);
    expect(body.byPrincipal.length, "no principal has any commitment").toBeGreaterThan(0);

    const card = page.getByText("Principal performance this month").locator("xpath=..");
    // The card renders the first six and says nothing about the rest — a
    // heading that promises "principal performance" over a silently truncated
    // list. Asserted as it behaves, not as it reads.
    const shown = body.byPrincipal.slice(0, 6);
    for (const pr of shown) {
      const row = card.getByText(pr.name, { exact: true }).locator("xpath=../..");
      const text = await row.innerText();
      const figures = text.match(/₹[\d,]+/g) ?? [];
      expect(figures.length, `${pr.name} should show achieved and committed`).toBe(2);
      expect(parseInr(figures[0])).toBe(Math.round(pr.achieved));
      expect(parseInr(figures[1])).toBe(Math.round(pr.committed));
    }
  });
});

test.describe("Admin dashboard — the reporting window", () => {
  test("the window on the button is the window the API is asked for", async ({ page, request }) => {
    const first = await openDashboard(page, request, "admin");

    await openPicker(page);
    const footer = await page.getByRole("dialog").getByText(/^\d{4}-\d{2}-\d{2}( → \d{4}-\d{2}-\d{2})?$/).innerText();
    const [from, to] = footer.split("→").map((s) => s.trim());

    expect(first.query.get("from")).toBe(from);
    expect(first.query.get("to")).toBe(to ?? from);
    // And the server echoes the window back rather than answering for another.
    expect(first.body.from).toBe(from);
    expect(first.body.to).toBe(to ?? from);
  });

  test("each window length resolves its own range", async ({ page, request }) => {
    await openDashboard(page, request, "admin");
    await openPicker(page);
    const dialog = page.getByRole("dialog", { name: "Choose a reporting window" });
    const footer = dialog.getByText(/^\d{4}-\d{2}-\d{2}( → \d{4}-\d{2}-\d{2})?$/);

    /**
     * The range the picker resolves for a length, read off its own footer.
     *
     * Read from the popover rather than from the request it causes: the query
     * cache holds an already-fetched window for 30s, so switching BACK to the
     * length the page opened on is answered without going to the network and
     * a test that waited for a request there would hang on nothing. The
     * footer is the same `resolveRange` output the request is built from, and
     * that the two agree is pinned by the test above.
     */
    const rangeFor = async (name: string) => {
      const tab = dialog.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      const [from, to] = (await footer.innerText()).split("→").map((s) => s.trim());
      return { from, to: to ?? from };
    };
    const days = (r: { from: string; to: string }) =>
      (Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000;

    const day = await rangeFor("Day");
    expect(day.from).toBe(day.to);

    const week = await rangeFor("Week");
    expect(days(week)).toBe(6);
    // Monday-to-Sunday, which is the working week this product reports on.
    expect(new Date(`${week.from}T00:00:00Z`).getUTCDay()).toBe(1);

    const month = await rangeFor("Month");
    expect(month.from).toMatch(/-01$/);
    const [y, m] = month.from.split("-").map(Number);
    expect(month.to).toBe(new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10));

    const year = await rangeFor("Year");
    expect(year.from).toMatch(/^\d{4}-01-01$/);
    expect(year.to).toBe(`${year.from.slice(0, 4)}-12-31`);
  });

  test("a year window is asked for as a year, and answers for twelve months", async ({ page, request }) => {
    await openDashboard(page, request, "admin");
    await openPicker(page);

    // A length the page did not open on, so this one always reaches the API.
    const year = await captureDashboard(page, request, "admin", () =>
      page.getByRole("tab", { name: "Year", exact: true }).click(),
    );

    expect(year.query.get("from")).toMatch(/^\d{4}-01-01$/);
    expect(year.query.get("to")).toMatch(/^\d{4}-12-31$/);
    expect(year.body.months).toHaveLength(12);
    await expectTile(page, "Total committed", year.body.kpis.totalCommitted);
  });

  test("stepping back a month moves the window and the figures with it", async ({ page, request }) => {
    const before = await openDashboard(page, request, "admin");

    const after = await captureDashboard(page, request, "admin", () =>
      page.getByRole("button", { name: "Previous month" }).click(),
    );

    expect(after.query.get("from")! < before.query.get("from")!).toBe(true);
    expect(after.body.months[0] < before.body.months[0]).toBe(true);
    // The tiles must follow the window rather than keep the first answer.
    await expectTile(page, "Recurring committed", after.body.kpis.recurringCommitted);
  });

  test("a day window still reports the whole month's recurring commitment", async ({ page, request }) => {
    await openDashboard(page, request, "admin");

    await openPicker(page);
    const day = await captureDashboard(page, request, "admin", () =>
      page.getByRole("tab", { name: "Day", exact: true }).click(),
    );

    // A commitment is a month, so the sub-month tiles name the month they
    // actually answer for instead of implying a day's worth of one.
    const label = day.body.months[0]; // YYYY-MM
    const month = new Date(`${label}-01T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
    await expect(page.getByText(new RegExp(`Recurring committed · ${month}`, "i"))).toBeVisible();
    await expectTile(page, "Recurring committed", day.body.kpis.recurringCommitted);
  });
});

test.describe("Admin dashboard — scope", () => {
  test("the salesperson filter reaches the API and narrows the answer", async ({ page, request }) => {
    const all = await openDashboard(page, request, "admin");

    const filter = page.getByLabel("Filter by salesperson");
    await expect(filter).toBeVisible();
    const options = await filter.locator("option").all();
    const someone = await options[1].getAttribute("value");
    expect(someone).toBeTruthy();

    const one = await captureDashboard(page, request, "admin", () => filter.selectOption(someone!));

    expect(one.query.get("ownerId")).toBe(someone);
    // One person cannot have committed more than everyone did.
    expect(one.body.kpis.totalCommitted).toBeLessThanOrEqual(all.body.kpis.totalCommitted);
    expect(one.body.bySalesperson.every((b) => b.id === someone)).toBe(true);
    await expectTile(page, "Total committed", one.body.kpis.totalCommitted);
  });

  test("management reads the dashboard without the buttons that write to it", async ({ page, request }) => {
    await openDashboard(page, request, "mgmt");

    await expect(page.getByRole("heading", { name: /Revenue Performance/i })).toBeVisible();
    for (const label of [/New Sales Lead/i, /Add Customer/i, /Create Order/i]) {
      await expect(page.getByRole("button", { name: label })).toHaveCount(0);
    }

    // It reads the same tables as an administrator — including the open
    // projections — but the action that writes to one is not drawn at all.
    await expect(page.getByText(/Top open projections/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Log Follow-Up" })).toHaveCount(0);
  });

  test("a sales user gets their own dashboard and no filter to leave it", async ({ page, request }) => {
    const { query, body } = await openDashboard(page, request, "sales");

    // The scoping is the server's: a sales token is forced to its own rows
    // whatever the query says.
    //
    // This used to assert the breakdown came back EMPTY, with a comment about a
    // chart of one person against themselves — but nothing in the service ever
    // emptied it. It was empty because the seed's only month was three months
    // in the past, so the window this opens on held no lines for anybody, and
    // the assertion was reading that accident as a rule. What the scoping
    // actually guarantees is containment: whoever appears in a sales user's
    // breakdown is that sales user, and nobody else's numbers reach them.
    expect(query.get("ownerId")).toBeNull();
    const mine = body.bySalesperson.map((r) => r.name);
    expect(new Set(mine).size, `a sales dashboard named ${mine.join(", ")}`)
      .toBeLessThanOrEqual(1);
    // The chart and the filter are drawn on the admin branch only, so neither
    // reaches this page however many rows the payload carries.
    await expect(page.getByLabel("Filter by salesperson")).toHaveCount(0);
    await expect(page.getByText(/by salesperson/i)).toHaveCount(0);
    await expectTile(page, "Total committed", body.kpis.totalCommitted);
  });
});

test.describe("Admin dashboard — what the tiles are made of", () => {
  test.describe.configure({ timeout: 60_000 });

  test("the follow-ups tile counts the Follow-ups page's own rows", async ({
    page,
    request,
  }) => {
    /**
     * A follow-up in this product is a `FollowUp` row pointing at a record —
     * what the Follow-ups page and the mobile screen list. The tile used to
     * count the `nextFollowUp` DATE COLUMNS on leads and lines instead, which
     * are fields on those records, so it read "8 overdue" above a page holding
     * nothing and a follow-up created on that page moved no number here.
     *
     * So this creates one and watches the tile move. The Promech seed carries
     * no follow-ups, which is exactly why asserting against the seed alone
     * would prove nothing.
     */
    const token = await apiToken(request, "admin");
    const before = await request.get(`/api/v1/dashboard?${EVERYTHING}`, {
      headers: auth(token),
    });
    const start = (await before.json()) as Dash;
    const startTotal = start.kpis.followUpsDue + start.kpis.followUpsOverdue;

    const customers = await request.get("/api/v1/customers?limit=1", { headers: auth(token) });
    const { items } = (await customers.json()) as { items: { id: string; name: string }[] };
    expect(items.length, "no customer to hang a follow-up on").toBeGreaterThan(0);

    const title = unique("QA follow-up");
    const today = new Date().toISOString().slice(0, 10);
    const made = await request.post("/api/v1/followups", {
      headers: auth(token),
      data: {
        entityType: "Customer",
        entityId: items[0].id,
        dueDate: today,
        title,
        amount: 4321,
      },
    });
    expect(made.status(), "creating the follow-up").toBe(201);
    const { id } = (await made.json()) as { id: string };

    try {
      const { body } = await openDashboard(page, request, "admin");
      const total = body.kpis.followUpsDue + body.kpis.followUpsOverdue;
      expect(total, "the tile did not count a follow-up that exists").toBeGreaterThan(startTotal);
      await expect(tile(page, "Follow-ups due")).toHaveText(String(total));

      await tile(page, "Follow-ups due").click();
      const dialog = page.getByRole("dialog", { name: "Follow-ups due" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(new RegExp(`${total} outstanding`))).toBeVisible();

      // The row names itself and the kind of record it hangs off, which is how
      // the number can be reconciled against the page that lists it.
      const row = dialog.getByRole("row").filter({ hasText: title });
      await expect(row).toHaveCount(1);
      await expect(row.getByText("Customer", { exact: true })).toBeVisible();
      await expect(row.getByRole("link", { name: "Open" })).toHaveAttribute(
        "href",
        /\/customers$/,
      );

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    } finally {
      await request.delete(`/api/v1/followups/${id}`, { headers: auth(token) });
    }
  });

  test("a date on a lead is not counted as a follow-up", async ({ request }) => {
    // The other half of the same rule, asserted where it is cheap: a lead's
    // `nextFollowUp` is a column on the lead, shown on the Leads page. The
    // Promech seed sets eight of them, in the past, and none of them belongs
    // in a count the Follow-ups page cannot account for.
    const token = await apiToken(request, "admin");
    const [dash, followups] = await Promise.all([
      request.get(`/api/v1/dashboard?${EVERYTHING}`, { headers: auth(token) }),
      request.get("/api/v1/followups?limit=1", { headers: auth(token) }),
    ]);
    const body = (await dash.json()) as Dash;
    const { total } = (await followups.json()) as { total: number };

    // Whatever the tile says, the Follow-ups page can account for all of it.
    expect(body.kpis.followUpsDue + body.kpis.followUpsOverdue).toBeLessThanOrEqual(total);
    expect(body.followUps.every((f) => f.entityType)).toBe(true);
  });

  test("an administrator sees the open projections the payload sends them", async ({
    page,
    request,
  }) => {
    // The aggregate has always carried these for every role; only the sales
    // branch drew them, so an admin was sent ten rows a page that never
    // rendered.
    const { body } = await openYearAsAdmin(page, request);
    test.skip(body.topOpenProjections.length === 0, "no open projections in any window");

    const card = page.getByText(/Top open projections/i).locator("xpath=../..");
    await expect(card).toBeVisible();
    await expect(card.getByText(`${body.topOpenProjections.length} lines`)).toBeVisible();
    await expect(card.locator("tbody tr")).toHaveCount(body.topOpenProjections.length);
  });

  test("principal performance lists every principal, not the first six", async ({
    page,
    request,
  }) => {
    const { body } = await openYearAsAdmin(page, request);
    expect(body.byPrincipal.length, "no principal has any commitment").toBeGreaterThan(0);

    const card = page.getByText("Principal performance this month").locator("xpath=..");
    for (const pr of body.byPrincipal) {
      await expect(card.getByText(pr.name, { exact: true })).toBeVisible();
    }
  });
});

test.describe("Admin dashboard — the drill-downs", () => {
  // A sign-in, a window change and a modal, each step slowed by the suite's
  // `slowMo`, does not fit the 30s default the rest of the file lives inside.
  test.describe.configure({ timeout: 60_000 });

  /**
   * The two tables are the page's way into a record, and both are populated
   * from the reporting window. The current month can legitimately be empty, so
   * these widen to the year first — an empty table would make the test pass
   * without ever opening anything.
   */
  /**
   * A sales user's dashboard, widened to the year.
   *
   * "Top open projections" and its Log Follow-Up button live in the sales
   * branch of the page — an administrator never sees that table, however many
   * lines the aggregate carries for them — so these two drill-downs are a
   * salesperson's, and the reporting window is widened because the current
   * month can legitimately hold no open lines.
   */
  const openYear = async (page: Page, request: APIRequestContext) => {
    const first = await openDashboard(page, request, "sales");
    await openPicker(page);
    const year = await captureDashboard(page, request, "sales", () =>
      page.getByRole("tab", { name: "Year", exact: true }).click(),
    );
    await page.keyboard.press("Escape");
    return year.body.topOpenProjections.length ? year : first;
  };

  test("an oral-confirmation row opens that deal", async ({ page, request }) => {
    const { body } = await openDashboard(page, request, "admin");
    test.skip(body.oralConfirmationDeals.length === 0, "no deals at oral confirmation");
    const deal = body.oralConfirmationDeals[0];

    await page.getByRole("button", { name: "Open Deal" }).first().click();
    const dialog = page.getByRole("dialog", { name: new RegExp(`Sales Lead: ${deal.customerName}`, "i") });
    await expect(dialog).toBeVisible();

    // Closing must leave the page behind it intact rather than a blank shell.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Revenue Performance/i })).toBeVisible();
  });

  test("a top open projection opens that customer's record", async ({ page, request }) => {
    const { body } = await openYear(page, request);
    test.skip(body.topOpenProjections.length === 0, "no open projections in any window");
    const top = body.topOpenProjections[0];

    // Wait for the row before clicking it: a bare click on a locator that never
    // resolves hangs until the test timeout with nothing to read afterwards.
    const row = page.getByRole("button", { name: top.customerName, exact: true }).first();
    await expect(row, `${top.customerName} should be in the top-open table`).toBeVisible({
      timeout: 15000,
    });
    await row.click();
    await expect(page.getByRole("heading", { name: top.customerName }).first()).toBeVisible();
  });

  test("a top open projection offers its follow-up log without writing anything", async ({ page, request }) => {
    const { body } = await openYear(page, request);
    test.skip(body.topOpenProjections.length === 0, "no open projections in any window");

    const log = page.getByRole("button", { name: "Log Follow-Up" }).first();
    await expect(log).toBeVisible({ timeout: 15000 });
    await log.click();
    const dialog = page.getByRole("dialog", { name: /Follow-Up & Status Log/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("Targets opens the editor for the window on the button", async ({ page, request }) => {
    const { body } = await openDashboard(page, request, "admin");

    await page.getByRole("button", { name: /^Targets$/ }).click();
    // Named with the month it will write to, since a target is set per month
    // and the button sits next to a window that may be a day or a year.
    const dialog = page.getByRole("dialog", { name: /^Targets — / });
    await expect(dialog).toBeVisible();

    const month = new Date(`${body.months[0]}-01T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
    await expect(dialog.getByText(new RegExp(month, "i")).first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});
