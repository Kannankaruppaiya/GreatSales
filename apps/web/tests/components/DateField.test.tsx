import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateField, DateTimeField } from "@/components/DateField";

/**
 * The calendar that replaced `<input type="date">` — and, before this, the
 * three dropdowns that had replaced it first.
 *
 * Two things have to survive the move from dropdowns to a grid, and both look
 * obviously fine in the source while breaking silently.
 *
 * The AMBIGUITY guarantee, which is why the native input was dropped in the
 * first place: this product is used in India, day-first, on browsers very often
 * set to en-US, month-first. A closed date field therefore has to spell the
 * month in words. `09 Mar 2026` cannot be read as the 3rd of September; any
 * arrangement of digits can.
 *
 * And the CONTRACT, `YYYY-MM-DD` in and out, because eight forms were changed
 * to use this control and none of them were taught a new shape either time it
 * was rebuilt.
 *
 * The rest is the things a grid has that a dropdown did not have to think
 * about: clearing an optional date now that there is no blank option, reaching
 * a year that is nowhere near this one, and moving without a mouse.
 */

/** A controlled host, so the tests exercise the real value round-trip. */
function Host({
  initial = "",
  required,
  onValue,
}: {
  initial?: string;
  required?: boolean;
  onValue?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField
        id="test-date"
        label="Due date"
        required={required}
        value={value}
        onChange={(v) => {
          setValue(v);
          onValue?.(v);
        }}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const trigger = () => screen.getByRole("button", { name: /^Due date/ });
const value = () => screen.getByTestId("value").textContent;
const calendar = () => screen.getByRole("dialog", { name: "Choose due date" });
const openCalendar = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(trigger());
  return calendar();
};

describe("DateField", () => {
  it("shows an existing date with the month in words", () => {
    render(<Host initial="2026-03-09" />);
    // Not 09/03 or 03/09. The whole reason the native input was dropped is
    // that those two read as different days to different users.
    expect(trigger()).toHaveTextContent("09 Mar 2026");
  });

  it("prompts when there is no date", () => {
    render(<Host />);
    expect(trigger()).toHaveTextContent("Select date");
    expect(value()).toBe("");
  });

  it("reports the ISO date when a day is picked, and closes", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Host initial="2026-06-01" onValue={onValue} />);

    const panel = await openCalendar(user);
    await user.click(panel.querySelector('[data-day="2026-06-15"]')!);

    // The same shape `<input type="date">` produced, so the forms that use
    // this did not have to learn anything new.
    expect(value()).toBe("2026-06-15");
    expect(onValue).toHaveBeenCalledWith("2026-06-15");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent("15 Jun 2026");
  });

  it("opens on the month the date is in, not on today", async () => {
    const user = userEvent.setup();
    render(<Host initial="2024-02-10" />);
    const panel = await openCalendar(user);
    expect(panel).toHaveTextContent("Feb 2024");
  });

  it("pages months without changing the value until a day is clicked", async () => {
    const user = userEvent.setup();
    render(<Host initial="2026-06-15" />);

    const panel = await openCalendar(user);
    await user.click(screen.getByRole("button", { name: "Next month" }));

    expect(panel).toHaveTextContent("Jul 2026");
    // Looking at July is not choosing July.
    expect(value()).toBe("2026-06-15");
  });

  it("shows February's real length, leap year included", async () => {
    const user = userEvent.setup();
    render(<Host initial="2024-02-01" />);
    const panel = await openCalendar(user);

    expect(panel.querySelector('[data-day="2024-02-29"]')).toBeTruthy();
    expect(panel.querySelector('[data-day="2024-02-30"]')).toBeNull();
  });

  it("reaches a distant year through the header, not a list", async () => {
    const user = userEvent.setup();
    render(<Host initial="2026-06-15" />);
    await openCalendar(user);

    // A dropdown had to guess how far either way anyone would ever go, and
    // then could not reach past its own guess. Two clicks up the header
    // instead: days → months → years.
    await user.click(screen.getByRole("button", { name: /choose a month/ }));
    await user.click(screen.getByRole("button", { name: /choose a year/ }));
    await user.click(screen.getByRole("button", { name: "Previous years" }));
    await user.click(screen.getByRole("button", { name: "2013" }));
    await user.click(screen.getByRole("button", { name: "March 2013" }));
    await user.click(calendar().querySelector('[data-day="2013-03-04"]')!);

    expect(value()).toBe("2013-03-04");
  });

  it("clears an optional date, which a grid has no blank cell for", async () => {
    const user = userEvent.setup();
    render(<Host initial="2026-06-15" />);

    await openCalendar(user);
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(value()).toBe("");
    expect(trigger()).toHaveTextContent("Select date");
  });

  it("offers no Clear on a required date", async () => {
    const user = userEvent.setup();
    render(<Host initial="2026-06-15" required />);

    await openCalendar(user);
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  });

  it("jumps to today from wherever it has wandered to", async () => {
    const user = userEvent.setup();
    render(<Host initial="2019-01-01" />);

    await openCalendar(user);
    await user.click(screen.getByRole("button", { name: "Today" }));

    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    expect(value()).toBe(iso);
  });

  it("moves by arrow key, including off the edge of the month", async () => {
    const user = userEvent.setup();
    render(<Host initial="2026-06-30" />);

    const panel = await openCalendar(user);
    // The grid is 42 buttons; without roving focus the only way through it is
    // 42 presses of Tab.
    (panel.querySelector('[data-day="2026-06-30"]') as HTMLElement).focus();
    await user.keyboard("{ArrowRight}");
    expect(calendar()).toHaveTextContent("Jul 2026");
    await user.keyboard("{Enter}");

    expect(value()).toBe("2026-07-01");
  });

  it("closes on Escape without choosing anything", async () => {
    const user = userEvent.setup();
    render(<Host initial="2026-06-15" />);

    await openCalendar(user);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(value()).toBe("2026-06-15");
  });

  it("takes a new date handed in from outside", async () => {
    // A different record loaded into the same modal has to replace what is on
    // screen — nothing this control holds may outlive the record it belonged
    // to.
    const { rerender } = render(
      <DateField label="Due date" value="2026-01-02" onChange={() => {}} />,
    );
    expect(trigger()).toHaveTextContent("02 Jan 2026");

    rerender(<DateField label="Due date" value="2026-07-21" onChange={() => {}} />);
    expect(trigger()).toHaveTextContent("21 Jul 2026");

    const user = userEvent.setup();
    const panel = await openCalendar(user);
    expect(panel).toHaveTextContent("Jul 2026");
  });

  it("keeps a stored date far outside any sensible window", () => {
    // An invoice from long ago must not read as blank and be saved back as
    // something else the next time somebody edits the record.
    render(<Host initial="1999-05-04" />);
    expect(trigger()).toHaveTextContent("04 May 1999");
  });

  it("names the field it belongs to, so two dates on one form are tellable apart", () => {
    render(<Host initial="2026-03-09" />);
    expect(trigger()).toHaveAccessibleName("Due date: 09 Mar 2026");
  });
});

describe("DateTimeField", () => {
  function TimeHost() {
    const [value, setValue] = useState("");
    return (
      <>
        <DateTimeField label="Expected delivery" value={value} onChange={setValue} />
        <output data-testid="value">{value}</output>
      </>
    );
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-01T09:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("reports nothing until both halves are set, then the ISO datetime", async () => {
    const user = userEvent.setup();
    render(<TimeHost />);

    await user.click(screen.getByRole("button", { name: /^Expected delivery/ }));
    await user.click(
      screen
        .getByRole("dialog", { name: "Choose expected delivery" })
        .querySelector('[data-day="2026-08-04"]')!,
    );
    // A date with no time is not a moment, and the input this replaced said
    // the same thing by staying empty.
    expect(value()).toBe("");

    await user.selectOptions(screen.getByLabelText("Expected delivery — time"), "14:30");
    expect(value()).toBe("2026-08-04T14:30");
  });

  it("writes the time in words, so neither clock convention can be misread", () => {
    render(<TimeHost />);
    const times = [
      ...(screen.getByLabelText("Expected delivery — time") as HTMLSelectElement).options,
    ].map((o) => o.text);
    expect(times).toContain("7:30 AM");
    expect(times).toContain("2:30 PM");
    expect(times).toContain("12:00 AM");
    expect(times).toContain("12:00 PM");
  });
});
