import { expect, type APIRequestContext, type Page, type Response } from "@playwright/test";

export const TENANT = "tenant_promech";
export const MGMT = "greatsales-industrial-corp";

/** Seeded Promech logins, one per role the app distinguishes. */
export const CREDENTIALS = {
  admin: { email: "admin@greatsales.local", password: "admin", portal: "admin" },
  mgmt: { email: "manager@greatsales.local", password: "1234", portal: "management" },
  sales: { email: "megala@greatsales.local", password: "1234", portal: "sales" },
} as const;

export type TestRole = keyof typeof CREDENTIALS;

export const featureUrl = (key: string) => `/managements/${MGMT}/${key}`;

/** A name no other run can collide with, so a created row is unambiguous. */
export const unique = (prefix: string) =>
  `${prefix} QA-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;

/** Log in through the real form so the token, cookie and store all get set. */
export async function loginAs(page: Page, role: TestRole) {
  const c = CREDENTIALS[role];
  await page.goto(`/${c.portal}/login`);
  await page.locator("#login-tenant").fill(TENANT);
  await page.locator("#login-email").fill(c.email);
  await page.locator("#login-password").fill(c.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/managements/, { timeout: 20000 });
  await expect(page.locator("aside")).toBeVisible({ timeout: 15000 });
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
