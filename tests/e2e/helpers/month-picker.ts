import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Driving the month picker, which is a calendar and no longer a `<select>`.
 *
 * Every month control in the console used to be a dropdown, so a spec picked a
 * period with `selectOption("2026-09")` and read one back with
 * `toHaveValue()`. Both of those are gone: the control is now a button that
 * opens a grid of twelve months under a year you page through, and the chosen
 * period exists only as the button's own label and a highlighted cell.
 *
 * These helpers are the replacement, and they are here rather than copied into
 * four specs because that is exactly how the old ones drifted — one spec
 * reached for `page.locator("select").first()`, which silently started meaning
 * the salesperson filter the day a page grew a second dropdown.
 */

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** `"2026-09"` → `"September 2026"`, which is how a month cell is labelled. */
export const monthCellName = (period: string) =>
  `${MONTHS_LONG[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;

/** `"2026-09"` → `"Sep 2026"`, which is what the closed control reads. */
export const monthTriggerText = (period: string) =>
  `${MONTHS_LONG[Number(period.slice(5, 7)) - 1].slice(0, 3)} ${period.slice(0, 4)}`;

/**
 * The closed control, by the name it announces — "Worksheet month: Sep 2026".
 *
 * Matched on the prefix, because the selected month is part of that name and
 * a helper that had to know the month already would be no use for finding it.
 */
export const monthPicker = (page: Page, label = "Reporting month"): Locator =>
  page.getByRole("button", { name: new RegExp(`^${label}(:|$)`) });

/** The open calendar belonging to `label`. */
const monthPanel = (page: Page, label: string): Locator =>
  page.getByRole("dialog", { name: `Choose ${label.toLowerCase()}` });

/** Open it, and wait for the grid rather than for a timeout. */
export async function openMonthPicker(page: Page, label = "Reporting month") {
  const panel = monthPanel(page, label);
  if (!(await panel.isVisible())) await monthPicker(page, label).click();
  await expect(panel).toBeVisible({ timeout: 20000 });
  return panel;
}

/** The year the calendar is currently showing, read from its header. */
async function shownYear(panel: Locator): Promise<number> {
  const header = panel.getByRole("button", { name: /choose a year$/ });
  return Number(((await header.textContent()) ?? "").trim());
}

/**
 * Page the calendar to `year`.
 *
 * Bounded, because a header that never reaches the target — a control that
 * pages a decade at a time, say — would otherwise spin instead of failing.
 */
async function goToYear(panel: Locator, year: number) {
  for (let i = 0; i < 40; i++) {
    const shown = await shownYear(panel);
    if (shown === year) return;
    await panel
      .getByRole("button", { name: shown < year ? "Next year" : "Previous year" })
      .click();
  }
  throw new Error(`the month picker would not page to ${year}`);
}

/** Choose `period` (`YYYY-MM`), and wait for the calendar to close behind it. */
export async function pickMonth(page: Page, period: string, label = "Reporting month") {
  const panel = await openMonthPicker(page, label);
  await goToYear(panel, Number(period.slice(0, 4)));
  await panel.getByRole("button", { name: monthCellName(period) }).click();
  await expect(panel).toBeHidden();
  await expect(monthPicker(page, label)).toHaveText(new RegExp(monthTriggerText(period)));
}

/**
 * Every month the picker will actually accept, over `years`.
 *
 * The list a spec used to get from `locator("option")`. Months outside the
 * workspace's window are drawn but disabled, so "offered" means enabled — and
 * reading it from the grid keeps the assertion about what the UI really allows
 * rather than about a range recomputed in the test.
 */
export async function offeredMonths(
  page: Page,
  years: number[],
  label = "Reporting month",
): Promise<string[]> {
  const panel = await openMonthPicker(page, label);
  const periods: string[] = [];
  for (const year of years) {
    await goToYear(panel, year);
    for (let m = 1; m <= 12; m++) {
      const period = `${year}-${String(m).padStart(2, "0")}`;
      const cell = panel.getByRole("button", { name: monthCellName(period) });
      if (await cell.isEnabled()) periods.push(period);
    }
  }
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  return periods.sort();
}
