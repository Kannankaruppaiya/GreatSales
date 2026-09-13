import { test, expect } from "@playwright/test";
import { apiToken, auth, featureUrl, loginAs, unique, watchErrors } from "../helpers/session";

/**
 * The two surfaces where a mistake costs the most: the projection worksheet
 * (the committed/achieved numbers the business runs on) and user governance
 * (who can do what). Both are edited in place, so the checks follow the value
 * from the cell to the API and back after a reload.
 */
const NUMBER_CELL = 'table tbody tr input[type="number"]';

/**
 * The month the seed leaves open, asked of the data rather than written down.
 *
 * It was the literal "2026-06" beside a comment about a page that opened on a
 * hardcoded "2026-08" — neither of which is true any more. Then it was that
 * literal parsed out of the seed file, which held only while the seed itself
 * named a month; the seed now counts its months back from the day it runs, so
 * there is no literal left to read. Two places agreeing by luck is how a suite
 * starts asserting over an empty table without failing, and the only source
 * that cannot drift is the workspace itself.
 */
let seededPeriod: string | null = null;
async function seededMonth(
  request: import("@playwright/test").APIRequestContext,
  token: string,
): Promise<string> {
  if (seededPeriod) return seededPeriod;
  // Walk back from this month until one has lines. The seed opens the current
  // month, so this normally answers on the first try — but a run that starts
  // seconds after midnight on the 1st, or against a database seeded yesterday,
  // finds the month that is actually there instead of asserting over an empty
  // table and blaming the code.
  const now = new Date();
  for (let back = 0; back < 6; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const res = await request.get(`/api/v1/projections?period=${period}`, {
      headers: auth(token),
    });
    expect(res.status(), `probing ${period}`).toBe(200);
    if ((await res.json()).summary.totLines > 0) {
      seededPeriod = period;
      return period;
    }
  }
  throw new Error("no month in the last six has any projections — is the seed loaded?");
}

/** The page's own month control. Not the topbar: this page declares no window. */
const monthSelect = (page: import("@playwright/test").Page) =>
  page.getByLabel("Worksheet month");

/**
 * A far-future month with nothing in it, found by trying rather than assumed.
 *
 * `(mappingId, period)` is unique, so a month that still holds rows — from a
 * run that crashed before its cleanup, say — accepts nothing on a second roll,
 * and a test asserting "created > 0" against it would fail for a reason that
 * has nothing to do with the code. Walking forward until a roll actually
 * creates something recovers from that on its own, and says so out loud when
 * it runs out of months.
 *
 * Years past 2100 so this can never collide with a month anyone reports on.
 */
async function freshMonth(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  ownerId?: string,
): Promise<{ period: string; created: number }> {
  for (let i = 0; i < 36; i++) {
    const period = `${2100 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
    const res = await request.post("/api/v1/projections/roll-forward", {
      headers: auth(token),
      data: { to: period, ...(ownerId ? { ownerId } : {}) },
    });
    expect(res.status(), `rolling into ${period}`).toBe(201);
    const { created } = (await res.json()) as { created: number };
    if (created > 0) return { period, created };
  }
  throw new Error("no unused far-future month left — the suite has run a lot");
}

/**
 * Put a month back to empty.
 *
 * A roll forward writes rows, and this file's rule is the one the write-path
 * specs follow: the dataset is left as the run found it.
 *
 * Every delete is checked, and the month is read back afterwards. It used to
 * fire the requests and look at none of them, which is how two months of rolled
 * rows — exact copies of the seeded book — ended up sitting in the development
 * database while this file reported green: the API restarted mid-run, every
 * cleanup delete failed, and nothing was watching. A cleanup that cannot clean
 * up has to fail out loud, because the run after it is the one that pays.
 */
async function clearMonth(
  request: import("@playwright/test").APIRequestContext,
  token: string,
  period: string,
) {
  const res = await request.get(`/api/v1/projections?period=${period}`, {
    headers: auth(token),
  });
  const { lines } = (await res.json()) as { lines: { id: string }[] };
  for (const l of lines) {
    const del = await request.delete(`/api/v1/projections/${l.id}`, {
      headers: auth(token),
    });
    expect(
      del.status(),
      `cleaning up ${period}: DELETE ${l.id} left a row behind`,
    ).toBe(204);
  }
  const after = await request.get(`/api/v1/projections?period=${period}`, {
    headers: auth(token),
  });
  expect(
    (await after.json()).summary.totLines,
    `${period} still holds rows after cleanup`,
  ).toBe(0);
}

/**
 * A month the picker offers that currently holds no lines.
 *
 * Asked of the page rather than computed: the range starts at the workspace's
 * first period, so an earlier month is not selectable, and a later one may have
 * been filled by a roll-forward. Assuming either is how a test starts asserting
 * "empty" against a table with rows in it.
 */
async function emptyMonth(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  token: string,
): Promise<string> {
  // Wait for the control before reading it. Reading straight after `goto` got
  // an empty option list, and an empty list falls out of the loop below at the
  // "everything is full" error — which is the opposite of what had happened.
  await expect(monthSelect(page)).toBeVisible({ timeout: 20000 });
  const options = await monthSelect(page).locator("option").all();
  const seeded = await seededMonth(request, token);
  const periods = (
    await Promise.all(options.map((o) => o.getAttribute("value")))
  ).filter((v): v is string => !!v && v > seeded);
  expect(periods.length, "the month picker offers nothing after the seeded month")
    .toBeGreaterThan(0);

  for (const period of periods) {
    // The request fixture with a bearer token, not `page.request`: this API
    // authenticates on the Authorization header, and the browser context only
    // carries the refresh cookie — every probe came back 401 and read as
    // "this month has lines", which is the opposite of what it means.
    const res = await request.get(`/api/v1/projections?period=${period}`, {
      headers: auth(token),
    });
    if (!res.ok()) throw new Error(`probing ${period}: ${res.status()}`);
    if ((await res.json()).summary.totLines === 0) return period;
  }
  throw new Error("every month the picker offers has lines in it");
}

async function openWorksheet(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  token: string,
) {
  await page.goto(featureUrl("projections"));
  await monthSelect(page).selectOption(await seededMonth(request, token));
  await expect(page.locator(NUMBER_CELL).first()).toBeVisible({ timeout: 20000 });
}

test.describe("Projection worksheet", () => {
  test("an achieved quantity typed into a cell is saved and survives a reload", async ({
    page,
    request,
  }) => {
    const watch = watchErrors(page);
    const token = await apiToken(request, "admin");
    await loginAs(page, "admin");
    await openWorksheet(page, request, token);

    const cell = page.locator(NUMBER_CELL).first();
    const original = await cell.inputValue();
    const next = String((Number(original) || 0) + 7);

    const patch = page.waitForResponse(
      (r) => r.url().includes("/api/v1/projections") && r.request().method() === "PATCH",
    );
    await cell.fill(next);
    await cell.press("Enter");
    expect((await patch).status(), "the cell edit must reach the API").toBe(200);

    await openWorksheet(page, request, token);
    await expect(page.locator(NUMBER_CELL).first()).toHaveValue(next);

    // Put the row back the way it was found.
    const restore = page.waitForResponse(
      (r) => r.url().includes("/api/v1/projections") && r.request().method() === "PATCH",
    );
    const cellAgain = page.locator(NUMBER_CELL).first();
    await cellAgain.fill(original);
    await cellAgain.press("Enter");
    await restore;

    watch.assertClean();
  });

  test("changing the line status writes it through and re-renders the badge", async ({
    page,
    request,
  }) => {
    const token = await apiToken(request, "admin");
    await loginAs(page, "admin");
    await openWorksheet(page, request, token);

    const status = page.locator("table tbody tr select").first();
    const original = await status.inputValue();
    const next = original === "Confirmed" ? "Lost" : "Confirmed";

    const patch = page.waitForResponse(
      (r) => r.url().includes("/api/v1/projections") && r.request().method() === "PATCH",
    );
    await status.selectOption(next);
    expect((await patch).status()).toBe(200);
    await expect(status).toHaveValue(next);

    const restore = page.waitForResponse(
      (r) => r.url().includes("/api/v1/projections") && r.request().method() === "PATCH",
    );
    await status.selectOption(original);
    await restore;
  });

  test("the month control drives the worksheet, not just its initial render", async ({
    page,
    request,
  }) => {
    await loginAs(page, "admin");
    await page.goto(featureUrl("projections"));

    // A month with no lines, then the one that has them: the table must follow
    // both times, not only the value present when the page mounted.
    //
    // Which month is empty is ASKED, not assumed: the picker only offers months
    // from the workspace's first period onward, and any of them can be filled
    // by a roll-forward — including by another test in this file.
    const token = await apiToken(request, "admin");
    const empty = await emptyMonth(page, request, token);
    await monthSelect(page).selectOption(empty);
    await expect(page.getByText(/No projection lines for this period/i)).toBeVisible({
      timeout: 20000,
    });

    await monthSelect(page).selectOption(await seededMonth(request, token));
    await expect(page.locator(NUMBER_CELL).first()).toBeVisible({ timeout: 20000 });
  });

  test("the footer totals are the server's, over the rows on screen", async ({
    page,
    request,
  }) => {
    const token = await apiToken(request, "admin");
    await loginAs(page, "admin");
    await openWorksheet(page, request, token);

    const res = await request.get(`/api/v1/projections?period=${await seededMonth(request, token)}`, {
      headers: auth(token),
    });
    const { lines, summary } = (await res.json()) as {
      lines: unknown[];
      summary: { totLines: number; totCommitted: number };
    };
    expect(summary.totLines, "the seed's worksheet is empty").toBeGreaterThan(0);

    const footer = page.getByText(/^Showing/);
    await expect(footer).toContainText(`${summary.totLines} lines`);
    await expect(page.locator("table tbody tr.group")).toHaveCount(lines.length);
  });

  test("each line filter asks the API for itself and the table follows", async ({
    page,
    request,
  }) => {
    const token = await apiToken(request, "admin");
    await loginAs(page, "admin");
    await openWorksheet(page, request, token);

    // Only the three the page did not open on: "all" was fetched at mount and
    // the query cache answers a return to it without going to the network, so
    // waiting for a request there waits for one that is never made.
    for (const [label, expected] of [
      ["Projected", "projected"],
      ["Unprojected", "blank"],
      ["Needs follow-up", "due"],
    ] as const) {
      const [req] = await Promise.all([
        page.waitForRequest((r) => /\/api\/v1\/projections\?/.test(r.url())),
        page.getByRole("button", { name: label, exact: true }).click(),
      ]);
      expect(new URL(req.url()).searchParams.get("lineFilter")).toBe(expected);
      // Rows or the empty state — both are a `tr`, so the table is never blank.
      await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });
    }

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.locator(NUMBER_CELL).first()).toBeVisible({ timeout: 15000 });
  });

  test("the follow-up date is on the worksheet, and editable from it", async ({
    page,
    request,
  }) => {
    // "Needs follow-up" sorts on this date. The worksheet used to neither show
    // it nor offer any way to set it, so that pill could empty the table with
    // nothing on screen explaining what to change.
    const token = await apiToken(request, "admin");
    await loginAs(page, "admin");
    await openWorksheet(page, request, token);

    await expect(page.getByRole("columnheader", { name: "Next follow-up" })).toBeVisible();

    const cell = page.locator("table tbody tr.group").first().getByRole("button", { name: /Log follow-up|Next/i });
    await cell.click();
    await expect(page.getByRole("dialog", { name: /Follow-Up & Status Log/i })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("a locked month is read-only on the page, not only at the API", async ({
    page,
    request,
  }) => {
    const token = await apiToken(request, "admin");
    const lock = await request.post("/api/v1/period-locks", {
      headers: auth(token),
      data: { period: await seededMonth(request, token) },
    });
    expect(lock.status(), "locking the period").toBe(201);

    try {
      await loginAs(page, "admin");
      await page.goto(featureUrl("projections"));
      await monthSelect(page).selectOption(await seededMonth(request, token));

      await expect(page.getByText(/is locked for reporting/i)).toBeVisible({ timeout: 20000 });
      await expect(page.locator(NUMBER_CELL).first()).toBeDisabled();
      await expect(page.locator("table tbody tr select").first()).toBeDisabled();
    } finally {
      await request.delete(`/api/v1/period-locks/${await seededMonth(request, token)}`, {
        headers: auth(token),
      });
    }
  });

  test("management reads the worksheet without being able to type into it", async ({
    page,
    request,
  }) => {
    // The API refuses management's PATCH with a 403. The cells used to stay
    // live anyway, so the only way to discover that was to type a number and
    // watch it bounce.
    const period = await seededMonth(request, await apiToken(request, "admin"));
    await loginAs(page, "mgmt");
    await page.goto(featureUrl("projections"));
    await monthSelect(page).selectOption(period);

    await expect(page.locator(NUMBER_CELL).first()).toBeVisible({ timeout: 20000 });
    await expect(page.locator(NUMBER_CELL).first()).toBeDisabled();
    await expect(page.locator("table tbody tr select").first()).toBeDisabled();
  });

  test("the topbar principal filter reaches the worksheet", async ({ page, request }) => {
    // The page declares `principal` among its global filters, so the topbar
    // draws that control on it. It was read by nothing, while a second
    // principal select sat in the toolbar below — one filter, two controls, and
    // the one nearest the eye did nothing.
    const token = await apiToken(request, "admin");
    await loginAs(page, "admin");
    await openWorksheet(page, request, token);

    const all = await page.locator("table tbody tr").count();
    const filter = page.getByLabel("Filter by principal brand");
    const options = await filter.locator("option").all();
    expect(options.length, "no principal to filter by").toBeGreaterThan(1);
    const one = await options[1].getAttribute("value");

    const [req] = await Promise.all([
      page.waitForRequest((r) => /\/api\/v1\/projections\?/.test(r.url())),
      filter.selectOption(one!),
    ]);
    expect(new URL(req.url()).searchParams.get("principalId")).toBe(one);

    await expect
      .poll(() => page.locator("table tbody tr").count(), { timeout: 15000 })
      .toBeLessThan(all);
  });

  test("an empty month is opened by rolling the last one forward", async ({
    page,
    request,
  }) => {
    /**
     * The worksheet had no way to put a line into a month at all: the only rows
     * that existed were the import's, so every month after it was permanently
     * empty and nobody could commit to one. This is that way in, and the empty
     * state is where it lives — the only place a person is looking when they
     * need it.
     */
    await loginAs(page, "admin");
    await page.goto(featureUrl("projections"));
    const token = await apiToken(request, "admin");
    const target = await emptyMonth(page, request, token);

    // Narrowed to one salesperson from the topbar before rolling. Two reasons,
    // and both matter: the button carries that filter into the request, which
    // nothing else here covers — and the whole workspace is ninety-odd lines,
    // which is ninety-odd DELETEs to put back and lands the cleanup on the
    // 120-per-minute limiter.
    //
    // WHICH salesperson is read off the month being rolled from, not taken as
    // the first name the topbar offers. That list is every salesperson in the
    // workspace, including ones who hold no mappings at all — picking one of
    // those rolled nothing, left the month empty, and failed this test on an
    // assertion about the page when the dataset was the thing at fault.
    const source = await request.get(
      `/api/v1/projections?period=${await seededMonth(request, token)}`,
      { headers: auth(token) },
    );
    const { lines: sourceLines } = (await source.json()) as {
      lines: { salespersonId: string }[];
    };
    const someone = sourceLines[0]?.salespersonId;
    expect(someone, "the month being rolled from has no lines").toBeTruthy();
    await page.getByLabel("Filter by salesperson").selectOption(someone);

    await monthSelect(page).selectOption(target);
    await expect(page.getByText(/No projection lines for this period/i)).toBeVisible({
      timeout: 20000,
    });

    try {
      await page.getByRole("button", { name: /Roll forward into/i }).click();

      // The rows arrive, and they arrive clean: the commitment carries, the
      // achievement does not.
      await expect(page.locator(NUMBER_CELL).first()).toBeVisible({ timeout: 20000 });
      const res = await request.get(`/api/v1/projections?period=${target}`, {
        headers: auth(token),
      });
      const { lines, summary } = (await res.json()) as {
        lines: { achievedQty: number; committedQty: number; status: string; nextFollowUp: string | null }[];
        summary: { totCommitted: number; totAchieved: number };
      };
      expect(summary.totCommitted).toBeGreaterThan(0);
      expect(summary.totAchieved, "last month's achievement is not this month's").toBe(0);
      expect(lines.every((l) => l.committedQty > 0)).toBe(true);
      expect(lines.every((l) => l.status === "ProjectionCreated")).toBe(true);
      expect(lines.every((l) => l.nextFollowUp === null)).toBe(true);
    } finally {
      await clearMonth(request, token, target);
    }
  });

  test("rolling the same month twice adds nothing the second time", async ({ request }) => {
    // It must be safe to press twice: the button is in an empty state that a
    // slow network can leave on screen after the first press worked.
    const token = await apiToken(request, "admin");
    // One salesperson's book: the assertion is about the second call writing
    // nothing, and a smaller roll is a smaller thing to put back.
    const sales = await request.get("/api/v1/users?limit=50", { headers: auth(token) });
    const { items } = (await sales.json()) as { items: { id: string; name: string }[] };
    const owner = items.find((u) => u.name === "Megala")?.id;
    expect(owner, "the seeded salesperson is gone").toBeTruthy();

    const { period: target, created } = await freshMonth(request, token, owner);
    const one = { created };

    try {
      const again = await request.post("/api/v1/projections/roll-forward", {
        headers: auth(token),
        data: { to: target, ownerId: owner },
      });
      const two = (await again.json()) as { created: number; skipped: number };
      expect(two.created, "a second roll must write nothing").toBe(0);
      expect(two.skipped).toBe(one.created);
    } finally {
      await clearMonth(request, token, target);
    }
  });

  test("a line can be dropped from the worksheet, and stops counting when it is", async ({
    page,
    request,
  }) => {
    // The counterpart to rolling forward: a carried commitment for a customer
    // who has stopped buying has to be removable, or it sits in the total and
    // the only way out is to commit zero and pretend.
    const token = await apiToken(request, "admin");
    // A month the picker offers, because the second half of this checks the
    // control on the page and the page can only show a month you can select.
    await loginAs(page, "admin");
    await page.goto(featureUrl("projections"));
    const target = await emptyMonth(page, request, token);

    // One salesperson's book, not the whole workspace. Rolling everybody put
    // ninety-odd lines into the month, and putting them back is ninety-odd
    // DELETEs — which, added to what this test already spends, walks straight
    // into the 120-per-minute limiter and fails the cleanup with a 429. The
    // sibling test above scopes its roll for the same reason: a smaller roll is
    // a smaller thing to put back.
    const people = await request.get("/api/v1/users?limit=50", { headers: auth(token) });
    const { items } = (await people.json()) as { items: { id: string; name: string }[] };
    const owner = items.find((u) => u.name === "Megala")?.id;
    expect(owner, "the seeded salesperson is gone").toBeTruthy();

    const rolled = await request.post("/api/v1/projections/roll-forward", {
      headers: auth(token),
      data: { to: target, ownerId: owner },
    });
    expect(rolled.status(), `rolling into ${target}`).toBe(201);

    try {
      const before = await request.get(`/api/v1/projections?period=${target}`, {
        headers: auth(token),
      });
      const start = (await before.json()) as {
        lines: { id: string; projValue: number }[];
        summary: { totLines: number; totCommitted: number };
      };
      const dropped = start.lines[0];

      const del = await request.delete(`/api/v1/projections/${dropped.id}`, {
        headers: auth(token),
      });
      expect(del.status()).toBe(204);

      const after = await request.get(`/api/v1/projections?period=${target}`, {
        headers: auth(token),
      });
      const end = (await after.json()) as {
        lines: { id: string }[];
        summary: { totLines: number; totCommitted: number };
      };
      expect(end.summary.totLines).toBe(start.summary.totLines - 1);
      expect(end.lines.some((l) => l.id === dropped.id)).toBe(false);
      expect(end.summary.totCommitted).toBe(
        start.summary.totCommitted - dropped.projValue,
      );

      // Gone from the worksheet, and gone for good: a second delete is a 404.
      const twice = await request.delete(`/api/v1/projections/${dropped.id}`, {
        headers: auth(token),
      });
      expect(twice.status()).toBe(404);

      // And the page offers it, rather than the endpoint existing alone: a
      // Remove on every row an editor may touch, behind the same confirmation
      // every other destructive action in this console uses.
      //
      // Checked on THIS test's own month, never the seeded one. Pointing it at
      // the seeded worksheet and trusting Escape to cancel took a real line out
      // of the dataset, and every later test that needed a June row failed for
      // a reason that had nothing to do with it.
      await monthSelect(page).selectOption(target);
      await expect(page.locator(NUMBER_CELL).first()).toBeVisible({ timeout: 20000 });
      const remove = page.getByRole("button", { name: "Remove", exact: true }).first();
      await expect(remove).toBeVisible();
      await remove.click();
      await expect(page.getByRole("dialog")).toContainText(/comes off the month/i);
      await page.keyboard.press("Escape");
    } finally {
      await clearMonth(request, token, target);
    }
  });

  test("a roll forward is refused where an edit would be", async ({ request }) => {
    const admin = await apiToken(request, "admin");
    const mgmt = await apiToken(request, "mgmt");

    // Management reads the workspace; it does not start months in it.
    const readOnly = await request.post("/api/v1/projections/roll-forward", {
      headers: auth(mgmt),
      data: { to: "2099-02" },
    });
    expect(readOnly.status()).toBe(403);

    // Backwards is not a roll forward, and a month with nothing before it has
    // nothing to carry.
    for (const [data, why] of [
      [{ to: await seededMonth(request, admin), from: "2099-03" }, "backwards"],
      [{ to: "1990-01" }, "nothing earlier"],
      [{ to: "not-a-month" }, "not a period"],
    ] as const) {
      const res = await request.post("/api/v1/projections/roll-forward", {
        headers: auth(admin),
        data,
      });
      expect(res.status(), why).toBeGreaterThanOrEqual(400);
      expect(res.status(), why).toBeLessThan(500);
    }

    // A locked month is frozen for everyone, including the administrator who
    // just pressed the button.
    const locked = "2099-04";
    await request.post("/api/v1/period-locks", {
      headers: auth(admin),
      data: { period: locked },
    });
    try {
      const res = await request.post("/api/v1/projections/roll-forward", {
        headers: auth(admin),
        data: { to: locked },
      });
      expect(res.status()).toBe(403);
    } finally {
      await request.delete(`/api/v1/period-locks/${locked}`, { headers: auth(admin) });
    }
  });

  test("the API refuses a status value that is not in the enum", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const list = await request.get(`/api/v1/projections?limit=1&period=${await seededMonth(request, token)}`, {
      headers: auth(token),
    });
    const body = await list.json();
    const line = (body.items ?? body.lines ?? body.data ?? [])[0];
    test.skip(!line, "no projection lines seeded for this period");

    const res = await request.patch(`/api/v1/projections/${line.id}`, {
      headers: auth(token),
      data: { status: "TotallyMadeUp" },
    });
    expect(res.status()).toBe(400);
  });

  test("a negative achieved quantity is refused", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const list = await request.get(`/api/v1/projections?limit=1&period=${await seededMonth(request, token)}`, {
      headers: auth(token),
    });
    const body = await list.json();
    const line = (body.items ?? body.lines ?? body.data ?? [])[0];
    test.skip(!line, "no projection lines seeded for this period");

    const res = await request.patch(`/api/v1/projections/${line.id}`, {
      headers: auth(token),
      data: { achievedQty: -50 },
    });
    expect(res.status(), "negative achieved quantity must not be stored").toBeGreaterThanOrEqual(
      400,
    );
  });
});

test.describe("User governance", () => {
  test("the three tabs render and the users directory lists the seeded accounts", async ({
    page,
  }) => {
    const watch = watchErrors(page);
    await loginAs(page, "admin");
    await page.goto(featureUrl("users"));

    await expect(page.getByRole("tab", { name: "Users" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("admin@greatsales.local").first()).toBeVisible();

    for (const tab of ["Roles", "Teams"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    }
    watch.assertClean();
  });

  test("a created user can sign in, and is gone after deletion", async ({ request }) => {
    const token = await apiToken(request, "admin");
    const username = `qa${Date.now().toString(36)}`;
    const email = `${username}@greatsales.local`;
    const password = "QaPassw0rd!2026";

    const roles = await request.get("/api/v1/roles", { headers: auth(token) });
    const roleBody = await roles.json();
    const roleList = roleBody.items ?? roleBody.data ?? roleBody;
    const salesRole = roleList.find((r: { name: string }) => r.name === "sales") ?? roleList[0];

    const created = await request.post("/api/v1/users", {
      headers: auth(token),
      data: { name: unique("QA User"), email, username, password, roleId: salesRole.id },
    });
    expect(created.status(), await created.text()).toBe(201);
    const user = await created.json();

    // The new account authenticates with exactly the credentials it was given.
    const login = await request.post("/api/v1/auth/login", {
      data: { tenantId: "tenant_promech", email, password },
    });
    expect(login.status(), "a created user must be able to log in").toBe(201);

    // …and not with a wrong one.
    const bad = await request.post("/api/v1/auth/login", {
      data: { tenantId: "tenant_promech", email, password: password + "x" },
    });
    expect(bad.status()).toBeGreaterThanOrEqual(400);

    const removed = await request.delete(`/api/v1/users/${user.id}`, { headers: auth(token) });
    expect([200, 204]).toContain(removed.status());

    const afterDelete = await request.post("/api/v1/auth/login", {
      data: { tenantId: "tenant_promech", email, password },
    });
    expect(
      afterDelete.status(),
      "a deleted user must not be able to log in",
    ).toBeGreaterThanOrEqual(400);
  });

  test("a duplicate username is rejected rather than shadowing the existing account", async ({
    request,
  }) => {
    const token = await apiToken(request, "admin");
    const roles = await request.get("/api/v1/roles", { headers: auth(token) });
    const roleBody = await roles.json();
    const roleList = roleBody.items ?? roleBody.data ?? roleBody;
    const salesRole = roleList.find((r: { name: string }) => r.name === "sales") ?? roleList[0];

    const res = await request.post("/api/v1/users", {
      headers: auth(token),
      data: {
        name: "Duplicate Admin",
        email: "admin@greatsales.local",
        username: "admin",
        password: "QaPassw0rd!2026",
        roleId: salesRole.id,
      },
    });
    expect(res.status(), "duplicate email/username must be refused").toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});
