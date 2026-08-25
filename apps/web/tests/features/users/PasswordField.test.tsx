import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  PASSWORD_MIN,
  PasswordField,
  advisoryPasswordProblem,
  generatePassword,
  passwordStrength,
} from "@/features/users/PasswordField";

/**
 * The password entry control.
 *
 * The generator matters most. Whatever it produces becomes a real credential
 * the moment an administrator hands it over, so it must come from the platform
 * CSPRNG and must satisfy the same policy the server applies — a generator
 * that emits values the server then rejects is worse than no generator.
 */
function Harness({ identity = {} }: { identity?: Record<string, string> }) {
  const [value, setValue] = useState("");
  return (
    <PasswordField value={value} onChange={setValue} identity={identity} required />
  );
}

describe("generatePassword", () => {
  it("uses the platform CSPRNG, never Math.random", () => {
    const crypto_ = vi.spyOn(globalThis.crypto, "getRandomValues");
    const math = vi.spyOn(Math, "random");

    generatePassword();

    expect(crypto_).toHaveBeenCalled();
    expect(math).not.toHaveBeenCalled();
    crypto_.mockRestore();
    math.mockRestore();
  });

  it("produces a value that passes the policy, every time", () => {
    // Run repeatedly: a generator that is usually fine is not fine.
    for (let i = 0; i < 50; i++) {
      const generated = generatePassword();
      expect(generated.length).toBeGreaterThanOrEqual(PASSWORD_MIN);
      expect(advisoryPasswordProblem(generated, {})).toBeNull();
    }
  });

  it("produces a different value each time", () => {
    const seen = new Set(Array.from({ length: 20 }, () => generatePassword()));
    expect(seen.size).toBe(20);
  });

  it("honours the requested length exactly", () => {
    expect(generatePassword(32)).toHaveLength(32);
  });
});

describe("advisoryPasswordProblem", () => {
  it("says nothing about an empty field", () => {
    expect(advisoryPasswordProblem("", {})).toBeNull();
  });

  it("flags a password below the minimum", () => {
    expect(advisoryPasswordProblem("short", {})).toMatch(/at least 12/i);
  });

  it("flags a password containing the username", () => {
    expect(
      advisoryPasswordProblem("xx-rameshkumar-xx", { username: "rameshkumar" }),
    ).toMatch(/must not contain/i);
  });

  it("flags a password containing a name word", () => {
    expect(
      advisoryPasswordProblem("xxRameshxxxxxxxx", { name: "Ramesh Kumar" }),
    ).toMatch(/must not contain/i);
  });

  it("ignores identity fragments too short to be meaningful", () => {
    expect(
      advisoryPasswordProblem("anders-and-more-x", { name: "An Do" }),
    ).toBeNull();
  });

  it("measures length in bytes, matching the server", () => {
    expect(advisoryPasswordProblem("é".repeat(65), {})).toMatch(/at most 128 bytes/i);
  });

  it("accepts a long, unrelated passphrase", () => {
    expect(
      advisoryPasswordProblem("correct-horse-battery-staple", {
        name: "Ramesh Kumar",
      }),
    ).toBeNull();
  });
});

describe("passwordStrength", () => {
  it("scores an empty password zero", () => {
    expect(passwordStrength("")).toBe(0);
  });

  it("rises with length and character variety", () => {
    expect(passwordStrength("Tr0ubador-and-Sextant!")).toBeGreaterThan(
      passwordStrength("aaaaaaaaaaaa"),
    );
  });
});

describe("the control", () => {
  it("labels the input and ties its hint to it", async () => {
    render(<Harness />);
    const input = screen.getByLabelText(/^Password/);
    expect(input).toHaveAttribute("aria-describedby");
  });

  it("hides the value by default and reveals it on request", async () => {
    render(<Harness />);
    const input = screen.getByLabelText(/^Password/);
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("type", "text");
  });

  it("announces a policy problem as an alert", async () => {
    render(<Harness identity={{ username: "rameshkumar" }} />);
    await userEvent.type(screen.getByLabelText(/^Password/), "xx-rameshkumar-xx");
    expect(await screen.findByRole("alert")).toHaveTextContent(/must not contain/i);
  });

  it("generating reveals the value, so it can actually be handed over", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /generate/i }));

    const input = screen.getByLabelText(/^Password/) as HTMLInputElement;
    expect(input).toHaveAttribute("type", "text");
    expect(input.value.length).toBeGreaterThanOrEqual(PASSWORD_MIN);
  });

  it("shows the server's message in place of the advisory one", () => {
    render(
      <PasswordField
        value="correct-horse-battery-staple"
        onChange={() => undefined}
        identity={{}}
        serverError="That password is too common. Choose something less predictable."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/too common/i);
  });
});
