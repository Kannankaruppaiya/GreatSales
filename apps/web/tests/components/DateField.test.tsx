import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateField, DateTimeField } from "@/components/DateField";

/**
 * The day / month / year control that replaced `<input type="date">`.
 *
 * Three behaviours here look obviously right in the source and are the ones
 * that break silently.
 *
 * A part-filled date has no `YYYY-MM-DD`, so `value` is `""` until all three
 * are chosen — which means the selects CANNOT be derived from `value`, or
 * clearing any one of them empties the whole control. That is not a
 * hypothetical: the first version did exactly that, and clearing the day to
 * change it threw away the month and year the user had already picked.
 *
 * The day list has to follow the month, including February in a leap year, and
 * a day already chosen has to survive a move to a shorter month rather than
 * disappearing.
 *
 * And the contract has to stay `YYYY-MM-DD`, because eight forms were changed
 * to use this and none of them were taught a new shape.
 */

/** A controlled host, so the tests exercise the real value round-trip. */
function Host({
  initial = "",
  onValue,
}: {
  initial?: string;
  onValue?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField
        id="test-date"
        label="Due date"
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

const day = () => screen.getByLabelText("Due date — day");
const month = () => screen.getByLabelText("Due date — month");
const year = () => screen.getByLabelText("Due date — year");
const value = () => screen.getByTestId("value").textContent;

/** Option labels, minus the "Day"/"Month"/"Year" placeholder. */
const optionsOf = (el: HTMLElement) =>
  [...(el as HTMLSelectElement).options].slice(1).map((o) => o.value);

describe("DateField", () => {
  it("shows an existing date across the three dropdowns", () => {
    render(<Host initial="2026-03-09" />);
    expect((day() as HTMLSelectElement).value).toBe("9");
    expect((month() as HTMLSelectElement).value).toBe("3");
    expect((year() as HTMLSelectElement).value).toBe("2026");
  });

  it("reports nothing until all three are chosen, then the ISO date", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Host onValue={onValue} />);

    await user.selectOptions(day(), "15");
    expect(value()).toBe("");
    await user.selectOptions(month(), "6");
    expect(value()).toBe("");

    await user.selectOptions(year(), "2026");
    // The same shape `<input type="date">` produced, so the eight forms that
    // now use this did not have to learn anything new.
    expect(value()).toBe("2026-06-15");
  });

  it("keeps the month and year when the day is cleared", async () => {
    const user = userEvent.setup();
    render(<Host initial="2026-06-15" />);

    await user.selectOptions(day(), "");

    // The date is incomplete so there is no value — but the two selections the
    // user did not touch are still on screen. Deriving the selects from `value`
    // wiped both, and the user had to pick all three again to change one.
    expect(value()).toBe("");
    expect((month() as HTMLSelectElement).value).toBe("6");
    expect((year() as HTMLSelectElement).value).toBe("2026");
  });

  it("offers the right number of days for the month, leap year included", async () => {
    const user = userEvent.setup();
    render(<Host initial="2024-01-31" />);
    expect(optionsOf(day())).toHaveLength(31);

    await user.selectOptions(month(), "2"); // February 2024 — a leap year
    expect(optionsOf(day())).toHaveLength(29);

    await user.selectOptions(month(), "4"); // April
    expect(optionsOf(day())).toHaveLength(30);
  });

  it("clamps a day the new month does not have, rather than clearing it", async () => {
    const user = userEvent.setup();
    render(<Host initial="2024-01-31" />);

    await user.selectOptions(month(), "2");
    // The 31st of January meant the end of the month; the end of February is
    // the honest reading. Clearing it would silently discard a real choice.
    expect(value()).toBe("2024-02-29");

    await user.selectOptions(year(), "2025"); // no longer a leap year
    expect(value()).toBe("2025-02-28");
  });

  it("offers 31 days before a month is known", () => {
    // People fill these left to right, so the 29th, 30th and 31st have to be
    // reachable before the month narrows the list.
    render(<Host />);
    expect(optionsOf(day())).toHaveLength(31);
  });

  it("keeps a stored year that falls outside the selectable window", () => {
    // An invoice from long ago must not read as blank and be saved back as
    // something else the next time somebody edits the record.
    render(<Host initial="1999-05-04" />);
    expect((year() as HTMLSelectElement).value).toBe("1999");
    expect(optionsOf(year())).toContain("1999");
  });

  it("spans years either side of today, computed from the clock", () => {
    render(<Host />);
    const years = optionsOf(year()).map(Number);
    const now = new Date().getFullYear();
    // Not a written-down list: a hardcoded range runs out, and the field can
    // then no longer record next year at all.
    expect(years).toContain(now);
    expect(years).toContain(now + 1);
    expect(Math.max(...years)).toBeGreaterThan(now);
    expect(Math.min(...years)).toBeLessThan(now);
  });

  it("takes a new date handed in from outside", () => {
    // A different record loaded into the same modal has to replace what is on
    // screen — the draft state must not outlive the record it belonged to.
    const { rerender } = render(
      <DateField label="Due date" value="2026-01-02" onChange={() => {}} />,
    );
    expect((day() as HTMLSelectElement).value).toBe("2");

    rerender(
      <DateField label="Due date" value="2026-07-21" onChange={() => {}} />,
    );
    expect((day() as HTMLSelectElement).value).toBe("21");
    expect((month() as HTMLSelectElement).value).toBe("7");
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

  it("reports nothing until both halves are set, then the ISO datetime", async () => {
    const user = userEvent.setup();
    render(<TimeHost />);

    await user.selectOptions(screen.getByLabelText("Expected delivery — day"), "4");
    await user.selectOptions(screen.getByLabelText("Expected delivery — month"), "8");
    await user.selectOptions(screen.getByLabelText("Expected delivery — year"), "2026");
    // A date with no time is not a moment, and the input this replaced said
    // the same thing by staying empty.
    expect(value()).toBe("");

    await user.selectOptions(screen.getByLabelText("Expected delivery — time"), "14:30");
    expect(value()).toBe("2026-08-04T14:30");
  });

  it("writes the time in words, so neither clock convention can be misread", () => {
    render(<TimeHost />);
    const times = [
      ...(screen.getByLabelText("Expected delivery — time") as HTMLSelectElement)
        .options,
    ].map((o) => o.text);
    expect(times).toContain("7:30 AM");
    expect(times).toContain("2:30 PM");
    expect(times).toContain("12:00 AM");
    expect(times).toContain("12:00 PM");
  });
});
