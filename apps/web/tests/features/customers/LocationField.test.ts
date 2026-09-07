import { describe, it, expect, vi, afterEach } from "vitest";
import { mapsUrl, shareLocationUrl } from "../../../src/features/customers/LocationField";

/**
 * The link this builds is handed to a driver outside the company, and the
 * share path is the one place a browser can refuse us without saying so. Both
 * are tested because a wrong link sends someone to the wrong address, and a
 * silent share failure looks to the user like a working button.
 */
describe("mapsUrl (web copy)", () => {
  it("matches the format the API and mobile use", () => {
    expect(mapsUrl(13.0827, 80.2707)).toBe(
      "https://www.google.com/maps?q=13.0827,80.2707",
    );
  });

  it("returns null unless both coordinates are present", () => {
    expect(mapsUrl(13.0827, null)).toBeNull();
    expect(mapsUrl(null, 80.2707)).toBeNull();
    expect(mapsUrl(undefined, undefined)).toBeNull();
  });

  it("keeps 0,0 — it is a real coordinate, not a missing one", () => {
    expect(mapsUrl(0, 0)).toBe("https://www.google.com/maps?q=0,0");
  });
});

const URL_ = "https://www.google.com/maps?q=13.0827,80.2707";

describe("shareLocationUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stub = (share: unknown, clipboard: unknown) => {
    vi.stubGlobal("navigator", { share, clipboard });
  };

  it("uses the OS share sheet when the device has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stub(share, { writeText });
    await expect(shareLocationUrl(URL_, "Acme — location")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      text: `Acme — location\n${URL_}`,
      url: URL_,
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies instead on a desktop with no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub(undefined, { writeText });
    await expect(shareLocationUrl(URL_, "Acme")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(URL_);
  });

  it("falls back to copying when the user cancels the share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub(vi.fn().mockRejectedValue(new Error("AbortError")), { writeText });
    await expect(shareLocationUrl(URL_, "Acme")).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(URL_);
  });

  it("reports failure rather than throwing when the clipboard is blocked", async () => {
    stub(undefined, {
      writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
    });
    // The unhandled rejection this replaces left the button looking like it
    // had worked.
    await expect(shareLocationUrl(URL_, "Acme")).resolves.toBe("failed");
  });
});
