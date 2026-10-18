import { describe, it, expect } from "vitest";
import { videosSiteActives, raisonExtinction, secretsStudio } from "../config";

describe("videosSiteActives — éteint par défaut", () => {
  const avec = (v: string | undefined) => {
    const avant = process.env.VIDEOS_SITE_ENABLED;
    if (v === undefined) delete process.env.VIDEOS_SITE_ENABLED;
    else process.env.VIDEOS_SITE_ENABLED = v;
    try {
      return videosSiteActives();
    } finally {
      if (avant === undefined) delete process.env.VIDEOS_SITE_ENABLED;
      else process.env.VIDEOS_SITE_ENABLED = avant;
    }
  };

  it.each([undefined, "false", "1", "yes", "TRUE", "True", " true", ""])("%j → false", (v) => {
    expect(avec(v)).toBe(false);
  });

  it('seul "true" allume', () => {
    expect(avec("true")).toBe(true);
  });
});

describe("raisonExtinction — secret du studio", () => {
  it("drapeau éteint → raison", () => {
    expect(raisonExtinction({ VIDEOS_STUDIO_HMAC_SECRET: "x".repeat(40) })).toMatch(
      /interrupteur/i,
    );
  });
  it("secret absent → raison", () => {
    expect(raisonExtinction({ VIDEOS_SITE_ENABLED: "true" })).toMatch(/secret/i);
  });
  it("secret < 32 caractères → raison", () => {
    expect(
      raisonExtinction({ VIDEOS_SITE_ENABLED: "true", VIDEOS_STUDIO_HMAC_SECRET: "x".repeat(31) }),
    ).toMatch(/secret/i);
  });
  it("secret de 32 caractères + drapeau → null", () => {
    expect(
      raisonExtinction({ VIDEOS_SITE_ENABLED: "true", VIDEOS_STUDIO_HMAC_SECRET: "x".repeat(32) }),
    ).toBeNull();
  });
});

describe("secretsStudio — courant puis précédent", () => {
  it("renvoie le courant seul si pas de précédent", () => {
    expect(secretsStudio({ VIDEOS_STUDIO_HMAC_SECRET: "a".repeat(32) })).toEqual({
      courant: "a".repeat(32),
      precedent: null,
    });
  });
  it("ignore un précédent trop court", () => {
    expect(
      secretsStudio({
        VIDEOS_STUDIO_HMAC_SECRET: "a".repeat(32),
        VIDEOS_STUDIO_HMAC_SECRET_PRECEDENT: "b".repeat(10),
      })?.precedent,
    ).toBeNull();
  });
  it("accepte un précédent de 32 caractères", () => {
    expect(
      secretsStudio({
        VIDEOS_STUDIO_HMAC_SECRET: "a".repeat(32),
        VIDEOS_STUDIO_HMAC_SECRET_PRECEDENT: "b".repeat(32),
      })?.precedent,
    ).toBe("b".repeat(32));
  });
  it("secret courant absent → null", () => {
    expect(secretsStudio({})).toBeNull();
  });
});
