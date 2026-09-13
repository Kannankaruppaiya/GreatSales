import { test, expect } from "@playwright/test";

/**
 * The auth throttler, checked LAST and alone in its file for a reason.
 *
 * Proving the limiter is armed means exhausting it, and the auth budget is
 * per-IP with a 60s window, so for the next minute every `/auth/login` in the
 * process gets a 429 too. Sitting in `05-api-contract`, it took the three files
 * that sort after it down with it — sign-in failing in `06`, `07` and `08` and
 * reading as broken pages, broken write paths and a broken dashboard. Nothing
 * runs after this file, so the crater is harmless here.
 */
test.describe("Auth throttling", () => {
  test("the throttler is armed — a burst of logouts is cut off with 429", async ({ request }) => {
    const codes: number[] = [];
    for (let i = 0; i < 26; i++) {
      const res = await request.post("/api/v1/auth/logout", { data: {} });
      codes.push(res.status());
    }
    expect(codes, `saw ${codes.join(",")}`).toContain(429);
  });
});
