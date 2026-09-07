import { describe, expect, it } from "vitest";
import {
  CustomerCreateSchema,
  CustomerUpdateSchema,
  mapsUrl,
} from "./customer";

/**
 * The pin is the one field on a customer that a person outside this system
 * acts on: a driver receives the link and drives to it. A wrong link is not a
 * cosmetic bug, so the rules that keep one from being built are tested here.
 */
describe("mapsUrl", () => {
  it("builds a link any maps app opens", () => {
    expect(mapsUrl(13.0827, 80.2707)).toBe(
      "https://www.google.com/maps?q=13.0827,80.2707",
    );
  });

  it("keeps southern and western hemispheres negative", () => {
    expect(mapsUrl(-33.8688, -70.6693)).toBe(
      "https://www.google.com/maps?q=-33.8688,-70.6693",
    );
  });

  it("refuses a half pin rather than pointing at the Gulf of Guinea", () => {
    expect(mapsUrl(13.0827, null)).toBeNull();
    expect(mapsUrl(null, 80.2707)).toBeNull();
    expect(mapsUrl(null, null)).toBeNull();
    expect(mapsUrl(undefined, undefined)).toBeNull();
  });

  it("treats 0,0 as a real place, because it is one", () => {
    expect(mapsUrl(0, 0)).toBe("https://www.google.com/maps?q=0,0");
  });

  it("rejects values that are not numbers on the wire", () => {
    expect(mapsUrl(Number.NaN, 80.2707)).toBeNull();
    expect(mapsUrl(13.0827, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("does not round a pin into a different building", () => {
    // 7dp is ~1cm; the link must carry the precision the GPS gave us.
    expect(mapsUrl(13.0827123, 80.2707456)).toBe(
      "https://www.google.com/maps?q=13.0827123,80.2707456",
    );
  });
});

const base = { name: "Acme Bearings", salespersonId: "user_1" };

describe("CustomerCreateSchema location", () => {
  it("accepts a customer with no pin at all", () => {
    expect(CustomerCreateSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a complete pin", () => {
    const r = CustomerCreateSchema.safeParse({
      ...base,
      latitude: 13.0827,
      longitude: 80.2707,
      locationAccuracyM: 8,
    });
    expect(r.success).toBe(true);
  });

  it("rejects one coordinate without the other", () => {
    expect(
      CustomerCreateSchema.safeParse({ ...base, latitude: 13.0827 }).success,
    ).toBe(false);
    expect(
      CustomerCreateSchema.safeParse({ ...base, longitude: 80.2707 }).success,
    ).toBe(false);
  });

  it("rejects coordinates that are not on Earth", () => {
    expect(
      CustomerCreateSchema.safeParse({ ...base, latitude: 91, longitude: 0 })
        .success,
    ).toBe(false);
    expect(
      CustomerCreateSchema.safeParse({ ...base, latitude: 0, longitude: 181 })
        .success,
    ).toBe(false);
  });

  it("rejects a negative accuracy, which would mean nothing", () => {
    expect(
      CustomerCreateSchema.safeParse({
        ...base,
        latitude: 13.0827,
        longitude: 80.2707,
        locationAccuracyM: -5,
      }).success,
    ).toBe(false);
  });
});

describe("CustomerUpdateSchema location", () => {
  it("allows clearing a pin by sending both as null", () => {
    const r = CustomerUpdateSchema.safeParse({
      latitude: null,
      longitude: null,
    });
    expect(r.success).toBe(true);
  });

  it("treats a lone null as clearing the whole pin, not half of one", () => {
    // Either coordinate sent as null means "remove the pin"; the service
    // clears both, so there is no way to end up with one saved without the
    // other.
    expect(CustomerUpdateSchema.safeParse({ latitude: null }).success).toBe(
      true,
    );
    expect(CustomerUpdateSchema.safeParse({ longitude: null }).success).toBe(
      true,
    );
  });

  it("still rejects a coordinate VALUE sent without its pair", () => {
    expect(CustomerUpdateSchema.safeParse({ latitude: 13.0827 }).success).toBe(
      false,
    );
    expect(CustomerUpdateSchema.safeParse({ longitude: 80.2707 }).success).toBe(
      false,
    );
  });

  it("leaves an unrelated edit alone", () => {
    expect(CustomerUpdateSchema.safeParse({ name: "Renamed" }).success).toBe(
      true,
    );
  });

  it("still requires at least one field", () => {
    expect(CustomerUpdateSchema.safeParse({}).success).toBe(false);
  });
});
