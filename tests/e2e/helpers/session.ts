import { expect, type APIRequestContext, type Page, type Response } from "@playwright/test";

export const TENANT = "tenant_promech";

/**
 * The workspace every signed-in URL is scoped by, asked of the API once.
 *
 * It was the literal "greatsales-industrial-corp" — the console's
 * `DEFAULT_MANAGEMENT_ID`, which no seed has ever created. An unknown workspace
 * is bounced to the real one's dashboard, so every page test navigated, landed
 * on the dashboard, and waited for a heading that would never render:
 * `dashboard` passed and the other ten pages failed, for one stale string.
 *
 * Scraping it back out of the UI is not the fix either, and was tried: the
 * address bar AND the sidebar are both built from that same default for the
 * first moment after sign-in, before `ManagementProvider` corrects them, so
 * whether a test read the right id came down to timing — which is why a
 * different three pages failed on every run. The API has no such moment.
 */
let workspaceId: string | null = null;

async function resolveWorkspaceId(page: Page): Promise<string> {
  if (workspaceId) return workspaceId;
  const c = CREDENTIALS.admin;
  const login = await page.request.post("/api/v1/auth/login", {
    data: { tenantId: TENANT, email: c.email, password: c.password },
  });
  expect(login.status(), "resolving the workspace id").toBe(201);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const res = await page.request.get("/api/v1/managements", { headers: auth(accessToken) });
  expect(res.status(), "resolving the workspace id").toBe(200);
  const body = (await res.json()) as { id: string }[] | { items: { id: string }[] };
  const list = Array.isArray(body) ? body : body.items;
  expect(list.length, "no workspace exists — re-run db:seed:promech").toBeGreaterThan(0);
  workspaceId = list[0].id;
  // `page.request` shares the context's cookie jar, so that login left a
  // refresh cookie behind. The console bootstraps from one, and a half-session
  // it never asked for kept the page busy enough that `networkidle` never
  // arrived. Hand the UI back the clean slate it expects.
  await page.context().clearCookies();
  return workspaceId;
}

export const mgmtId = () => workspaceId ?? TENANT;

/** Seeded Promech logins, one per role the app distinguishes. */
export const CREDENTIALS = {
  admin: { email: "admin@greatsales.local", password: "admin", portal: "admin" },
  mgmt: { email: "manager@greatsales.local", password: "1234", portal: "management" },
  sales: { email: "megala@greatsales.local", password: "1234", portal: "sales" },
} as const;

export type TestRole = keyof typeof CREDENTIALS;

/**
 * The address the app itself uses for a feature: portal segment, workspace, key.
 *
 * The un-prefixed `/managements/:id/:key` still works, but only by redirecting,
 * and a test that asserts straight after `goto` can then read the page it is
 * leaving. Going where the sidebar goes removes the hop.
 */
let portalPath = CREDENTIALS.admin.portal as string;
export const featureUrl = (key: string) => `/${portalPath}/managements/${mgmtId()}/${key}`;

/** A name no other run can collide with, so a created row is unambiguous. */
export const unique = (prefix: string) =>
  `${prefix} QA-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/** Log in through the real form so the token, cookie and store all get set. */
export async function loginAs(page: Page, role: TestRole) {
  const c = CREDENTIALS[role];
  await resolveWorkspaceId(page);
  portalPath = c.portal;
  await page.goto(`/${c.portal}/login`);
  await page.locator("#login-tenant").fill(TENANT);
  await page.locator("#login-email").fill(c.email);
  await page.locator("#login-password").fill(c.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/managements/, { timeout: 20000 });
  await expect(page.locator("aside")).toBeVisible({ timeout: 15000 });
  // Read it off the sidebar rather than off the address bar. Sign-in lands on
  // whatever `DEFAULT_MANAGEMENT_ID` says — a workspace no seed creates — and
  // only then does ManagementProvider bounce to the real one, so the URL at
  // this moment is still the dead id. The nav links are rendered from the
  // settled workspace and are right the first time.
}

/** Bearer token for direct API assertions and for cleaning up created rows. */
export async function apiToken(request: APIRequestContext, role: TestRole): Promise<string> {
  const c = CREDENTIALS[role];
  const res = await request.post("/api/v1/auth/login", {
    data: { tenantId: TENANT, email: c.email, password: c.password },
  });
  expect(res.status(), `login as ${role}`).toBe(201);
  return (await res.json()).accessToken as string;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * A pre-login refresh probe that 401s is by design (see apps/web auth store);
 * everything else on this list is browser noise, not an app defect.
 */
const IGNORED = [/\/auth\/refresh/, /favicon\.ico/, /@vite\/client/, /\.map$/];
const ignored = (url: string) => IGNORED.some((re) => re.test(url));

export type PageWatch = {
  consoleErrors: string[];
  pageErrors: string[];
  badResponses: string[];
  assertClean: () => void;
};

/** Records console errors, uncaught exceptions and >=400 responses for a page. */
export function watchErrors(page: Page): PageWatch {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const badResponses: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (ignored(text) || /Failed to load resource/.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("response", (res: Response) => {
    const url = res.url();
    if (res.status() < 400 || ignored(url)) return;
    badResponses.push(`${res.status()} ${res.request().method()} ${url}`);
  });

  return {
    consoleErrors,
    pageErrors,
    badResponses,
    assertClean() {
      expect(pageErrors, "uncaught exceptions").toEqual([]);
      expect(consoleErrors, "console errors").toEqual([]);
      expect(badResponses, "failed network responses").toEqual([]);
    },
  };
}
