// @vitest-environment node
//
// Garde du report acté : GUIDES_RESEAU_ENABLED ne s'allume pas avant le lot « demande
// d'effacement reçue en message privé ». Ce test fige le défaut sûr : éteint.
import { describe, it, expect, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { pageGuideReseauActive } from "../config";
import { lireSecretLien } from "../secret-lien";
import { EMPREINTE_CASE_PAGE_GUIDE, TEXTE_CASE_PAGE_GUIDE } from "@/content/guides-reseau";
import {
  CORPS_MAX_OPPOSITIONS,
  ORIGINE_OPPOSITION_RESEAU_STOP,
  PREFIXE_DEBIT_OPPOSITIONS,
  guidesReseauActifs,
  oppositionsReseauActives,
  secretsOppositionsReseau,
} from "../config";

const AVANT = process.env.GUIDES_RESEAU_ENABLED;
afterEach(() => {
  if (AVANT === undefined) delete process.env.GUIDES_RESEAU_ENABLED;
  else process.env.GUIDES_RESEAU_ENABLED = AVANT;
});

describe("GUIDES_RESEAU_ENABLED", () => {
  it("éteint par défaut (variable absente)", () => {
    delete process.env.GUIDES_RESEAU_ENABLED;
    expect(guidesReseauActifs()).toBe(false);
  });

  it.each(["", "1", "TRUE", "yes", "false"])("« %s » n'allume rien", (v) => {
    process.env.GUIDES_RESEAU_ENABLED = v;
    expect(guidesReseauActifs()).toBe(false);
  });

  it("seul « true » exact allume", () => {
    process.env.GUIDES_RESEAU_ENABLED = "true";
    expect(guidesReseauActifs()).toBe(true);
  });
});

describe("OPPOSITIONS_RESEAU_ENABLED", () => {
  const AVANT_OPP = process.env.OPPOSITIONS_RESEAU_ENABLED;
  afterEach(() => {
    if (AVANT_OPP === undefined) delete process.env.OPPOSITIONS_RESEAU_ENABLED;
    else process.env.OPPOSITIONS_RESEAU_ENABLED = AVANT_OPP;
  });

  it("éteint par défaut", () => {
    delete process.env.OPPOSITIONS_RESEAU_ENABLED;
    expect(oppositionsReseauActives()).toBe(false);
  });
  it.each(["", "1", "TRUE", "yes", "false"])("« %s » n'allume rien", (v) => {
    process.env.OPPOSITIONS_RESEAU_ENABLED = v;
    expect(oppositionsReseauActives()).toBe(false);
  });
  it("seul « true » exact allume", () => {
    process.env.OPPOSITIONS_RESEAU_ENABLED = "true";
    expect(oppositionsReseauActives()).toBe(true);
  });
});

describe("secretsOppositionsReseau", () => {
  const S = "s".repeat(32);
  it("absent, court ou seulement le secret des vidéos → null", () => {
    expect(secretsOppositionsReseau({})).toBeNull();
    expect(secretsOppositionsReseau({ GUIDES_RESEAU_HMAC_SECRET: "s".repeat(31) })).toBeNull();
    expect(secretsOppositionsReseau({ VIDEOS_STUDIO_HMAC_SECRET: S })).toBeNull();
  });
  it("courant + précédent", () => {
    expect(
      secretsOppositionsReseau({
        GUIDES_RESEAU_HMAC_SECRET: S,
        GUIDES_RESEAU_HMAC_SECRET_PRECEDENT: "p".repeat(32),
      }),
    ).toEqual({ courant: S, precedent: "p".repeat(32) });
    expect(secretsOppositionsReseau({ GUIDES_RESEAU_HMAC_SECRET: S })).toEqual({
      courant: S,
      precedent: null,
    });
  });
});

describe("constantes des oppositions", () => {
  it("valeurs figées", () => {
    expect(PREFIXE_DEBIT_OPPOSITIONS).toBe("internal:oppositions-reseau");
    expect(CORPS_MAX_OPPOSITIONS).toBe(4096);
    expect(ORIGINE_OPPOSITION_RESEAU_STOP).toBe("reseau-stop");
    expect(ORIGINE_OPPOSITION_RESEAU_STOP.length).toBeLessThanOrEqual(40);
  });
});

describe("lot S2 — interrupteur de la page et secret du lien", () => {
  afterEach(() => {
    delete process.env.PAGE_GUIDE_RESEAU_ENABLED;
  });

  it("PAGE_GUIDE_RESEAU_ENABLED : éteint par défaut, allumé seulement par « true » exact", () => {
    delete process.env.PAGE_GUIDE_RESEAU_ENABLED;
    expect(pageGuideReseauActive()).toBe(false);
    for (const v of ["1", "TRUE", "yes", " true", ""]) {
      process.env.PAGE_GUIDE_RESEAU_ENABLED = v;
      expect(pageGuideReseauActive()).toBe(false);
    }
    process.env.PAGE_GUIDE_RESEAU_ENABLED = "true";
    expect(pageGuideReseauActive()).toBe(true);
  });

  it("lireSecretLien : absent, court ou égal au secret des appels → null ; distincts → la valeur", () => {
    const appels = "A".repeat(40);
    const lien = "L".repeat(40);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(lireSecretLien({ GUIDES_RESEAU_HMAC_SECRET: appels })).toBeNull();
    expect(
      lireSecretLien({ GUIDES_RESEAU_LIEN_SECRET: "court", GUIDES_RESEAU_HMAC_SECRET: appels }),
    ).toBeNull();
    expect(lireSecretLien({ GUIDES_RESEAU_LIEN_SECRET: lien })).toBeNull();
    expect(
      lireSecretLien({ GUIDES_RESEAU_LIEN_SECRET: appels, GUIDES_RESEAU_HMAC_SECRET: appels }),
    ).toBeNull();
    expect(
      lireSecretLien({ GUIDES_RESEAU_LIEN_SECRET: lien, GUIDES_RESEAU_HMAC_SECRET: appels }),
    ).toBe(lien);
  });

  it("l'empreinte de la case est bien le sha256 du texte exact (texte changé = version à changer)", () => {
    expect(TEXTE_CASE_PAGE_GUIDE).toBe(
      "J'accepte de recevoir le guide et des informations d'Axion-IA, désinscription à tout moment",
    );
    expect(createHash("sha256").update(TEXTE_CASE_PAGE_GUIDE, "utf8").digest("hex")).toBe(
      EMPREINTE_CASE_PAGE_GUIDE,
    );
  });
});
