// Tests booking-cta-path — Sprint X.18.

import { describe, it, expect } from "vitest";
import { getBookingCtaPath } from "./booking-cta-path";

describe("getBookingCtaPath", () => {
  it("essentielle → /reserver (prix fixe, calendrier)", () => {
    const p = getBookingCtaPath({ intervention: "essentielle" });
    expect(p).toBe("/reserver?intervention=essentielle");
  });

  it("conference → /demande-devis (Sur devis catalogue)", () => {
    const p = getBookingCtaPath({ intervention: "conference" });
    expect(p).toBe("/demande-devis?intervention=conference");
  });

  it("essentielle > 5k€ → /demande-devis (seuil price)", () => {
    const p = getBookingCtaPath({
      intervention: "essentielle",
      basePriceHtCents: 600_000,
    });
    expect(p).toBe("/demande-devis?intervention=essentielle");
  });

  it("essentielle < 5k€ → /reserver", () => {
    const p = getBookingCtaPath({
      intervention: "essentielle",
      basePriceHtCents: 100_000,
    });
    expect(p).toBe("/reserver?intervention=essentielle");
  });

  it("sans intervention → /reserver nu", () => {
    const p = getBookingCtaPath({});
    expect(p).toBe("/reserver");
  });

  it("EN locale → /book ou /request-quote", () => {
    expect(getBookingCtaPath({ intervention: "essentielle", locale: "en" })).toBe(
      "/book?intervention=essentielle",
    );
    expect(getBookingCtaPath({ intervention: "conference", locale: "en" })).toBe(
      "/request-quote?intervention=conference",
    );
  });

  it("préfill city + UTM forwarded", () => {
    const p = getBookingCtaPath({
      intervention: "essentielle",
      city: "Lyon",
      utm: { utm_source: "google", utm_medium: "cpc" },
    });
    expect(p).toContain("intervention=essentielle");
    expect(p).toContain("city=Lyon");
    expect(p).toContain("utm_source=google");
    expect(p).toContain("utm_medium=cpc");
  });

  it("snake_case enum → kebab-case dans URL", () => {
    const p = getBookingCtaPath({ intervention: "gagner_du_temps" });
    expect(p).toBe("/reserver?intervention=gagner-du-temps");
  });
});
