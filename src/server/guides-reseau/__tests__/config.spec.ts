// @vitest-environment node
//
// Garde du report acté : GUIDES_RESEAU_ENABLED ne s'allume pas avant le lot « demande
// d'effacement reçue en message privé ». Ce test fige le défaut sûr : éteint.
import { describe, it, expect, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { pageGuideReseauActive } from "../config";
import { lireSecretLien } from "../secret-lien";
import {
  EMPREINTE_CASE_PAGE_GUIDE,
  EMPREINTE_CASE_PAGE_GUIDE_INFOS,
  TEXTE_CASE_PAGE_GUIDE,
  TEXTE_CASE_PAGE_GUIDE_INFOS,
} from "@/content/guides-reseau";
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
    expect(TEXTE_CASE_PAGE_GUIDE).toBe("J'accepte de recevoir le guide à cette adresse");
    expect(TEXTE_CASE_PAGE_GUIDE).not.toMatch(/informations|Axion-IA/i);
    expect(createHash("sha256").update(TEXTE_CASE_PAGE_GUIDE, "utf8").digest("hex")).toBe(
      EMPREINTE_CASE_PAGE_GUIDE,
    );
    expect(createHash("sha256").update(TEXTE_CASE_PAGE_GUIDE_INFOS, "utf8").digest("hex")).toBe(
      EMPREINTE_CASE_PAGE_GUIDE_INFOS,
    );
  });
});

// P4 — preuve de l'accord : l'écart ne peut pas précéder le dernier envoi possible du guide.
describe("preuve de l'accord : N jours et interrupteur", () => {
  it("JOURS_AVANT_ECART_PREUVE vaut 14 et dépasse l'horizon du rattrapage", async () => {
    const { JOURS_AVANT_ECART_PREUVE } = await import("../config");
    const { HORIZON_RATTRAPAGE_MS } = await import("@/server/guide-ia/config");
    expect(JOURS_AVANT_ECART_PREUVE).toBe(14);
    expect(JOURS_AVANT_ECART_PREUVE).toBeGreaterThan(HORIZON_RATTRAPAGE_MS / (24 * 3_600_000));
  });

  it("PREUVE_PAGE_GUIDE_ECART_ENABLED : éteint par défaut, exactement « true » pour allumer", async () => {
    const { preuveEcartActif } = await import("../config");
    const avant = process.env.PREUVE_PAGE_GUIDE_ECART_ENABLED;
    try {
      delete process.env.PREUVE_PAGE_GUIDE_ECART_ENABLED;
      expect(preuveEcartActif()).toBe(false);
      for (const v of ["1", "TRUE", "yes", " true"]) {
        process.env.PREUVE_PAGE_GUIDE_ECART_ENABLED = v;
        expect(preuveEcartActif()).toBe(false);
      }
      process.env.PREUVE_PAGE_GUIDE_ECART_ENABLED = "true";
      expect(preuveEcartActif()).toBe(true);
    } finally {
      if (avant === undefined) delete process.env.PREUVE_PAGE_GUIDE_ECART_ENABLED;
      else process.env.PREUVE_PAGE_GUIDE_ECART_ENABLED = avant;
    }
  });
});
