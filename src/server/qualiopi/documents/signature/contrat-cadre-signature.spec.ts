/**
 * Lot L7c — ce que la signature d'un contrat-cadre v3 exige en plus :
 * un code pour la partie `sous_traitant`, et la lecture du registre public.
 *
 * 🔑 Une pièce v2 (ou tout autre type) ne lit rien et n'objecte rien : c'est ce
 * qui garde le lot ÉTEINT tant qu'aucune v3 n'est émise.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => findUnique(...a) },
    verificationRegistreSousTraitance: { findFirst: (...a: unknown[]) => findFirst(...a) },
  },
}));

import {
  codeRequis,
  estContratCadre,
  masquerAdresse,
  memeAdresse,
  objectionContratCadre,
} from "./contrat-cadre-signature";

const V3 = { renderData: { gabaritVersion: 3 } };
const V2 = { renderData: { gabaritVersion: 2 } };
const DOC = "11111111-1111-4111-8111-111111111111";
const MAINTENANT = new Date("2026-10-12T09:00:00Z");

const actif = vi.fn(async () => ({
  ok: true as const,
  entreprise: {
    siren: "987654321",
    denomination: "X",
    adresse: null,
    naf: null,
    active: true,
    francaise: true,
    statutSuggere: null,
    diffusionPartielle: false,
  },
}));
const ferme = vi.fn(async () => ({
  ok: true as const,
  entreprise: { ...(await actif()).entreprise, active: false },
}));
const muet = vi.fn(async () => ({ ok: false as const, raison: "indisponible" as const }));
const introuvable = vi.fn(async () => ({ ok: false as const, raison: "introuvable" as const }));

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({
    trainerId: "t-1",
    trainer: { siret: "98765432100017" },
    sousTraitant: null,
  });
  findFirst.mockResolvedValue(null);
});

describe("code requis", () => {
  it("seulement pour le contrat-cadre v3 et la partie sous_traitant", () => {
    expect(codeRequis("contrat_sous_traitance", V3, "sous_traitant")).toBe(true);
    expect(codeRequis("contrat_sous_traitance", V3, "axionia")).toBe(false);
    expect(codeRequis("contrat_sous_traitance", V2, "sous_traitant")).toBe(false);
    expect(codeRequis("contrat_sous_traitance", null, "sous_traitant")).toBe(false);
    expect(codeRequis("convention", V3, "client")).toBe(false);
    expect(estContratCadre("contrat_sous_traitance", { renderData: { gabaritVersion: 4 } })).toBe(
      true,
    );
  });
});

describe("adresses", () => {
  it("masque l'adresse sans la rendre lisible", () => {
    expect(masquerAdresse("jeanne.martin@exemple.fr")).toBe("j***@e***.fr");
    expect(masquerAdresse("a@b")).toBe("a***@b***");
  });
  it("compare sans casse ni espaces, jamais deux vides", () => {
    expect(memeAdresse(" Jeanne@Exemple.fr", "jeanne@exemple.fr")).toBe(true);
    expect(memeAdresse("autre@exemple.fr", "jeanne@exemple.fr")).toBe(false);
    expect(memeAdresse(null, "")).toBe(false);
  });
});

describe("objection — registre public", () => {
  const base = { documentGenereId: DOC, type: "contrat_sous_traitance", maintenant: MAINTENANT };

  it("🔑 éteint : une v2 ne lit rien et n'objecte rien", async () => {
    const r = await objectionContratCadre({
      ...base,
      metadata: V2,
      partie: "sous_traitant",
      lecteur: ferme,
    });
    expect(r).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(ferme).not.toHaveBeenCalled();
  });

  it("signature : un contrôle récent vert suffit, sans lecture en direct", async () => {
    findFirst.mockResolvedValue({ verdict: "vert" });
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "sous_traitant",
      lecteur: ferme,
    });
    expect(r).toBeNull();
    expect(ferme).not.toHaveBeenCalled();
  });

  it("signature : un contrôle récent ROUGE refuse", async () => {
    findFirst.mockResolvedValue({ verdict: "rouge" });
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "sous_traitant",
      lecteur: actif,
    });
    expect(r?.message).toMatch(/pas active/);
  });

  it("signature : sans contrôle récent, lecture en direct ; entreprise fermée = refus", async () => {
    expect(
      await objectionContratCadre({
        ...base,
        metadata: V3,
        partie: "sous_traitant",
        lecteur: actif,
      }),
    ).toBeNull();
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "sous_traitant",
      lecteur: ferme,
    });
    expect(r?.message).toMatch(/pas active/);
    const i = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "sous_traitant",
      lecteur: introuvable,
    });
    expect(i?.message).toMatch(/introuvable/);
  });

  it("signature : registre muet = la signature passe (la contresignature relira)", async () => {
    expect(
      await objectionContratCadre({
        ...base,
        metadata: V3,
        partie: "sous_traitant",
        lecteur: muet,
      }),
    ).toBeNull();
  });

  it("🔴 contresignature : lecture en direct EXIGÉE, même avec un contrôle récent vert", async () => {
    findFirst.mockResolvedValue({ verdict: "vert" });
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "axionia",
      lecteur: ferme,
    });
    expect(r?.message).toMatch(/Contresignature impossible/);
    expect(ferme).toHaveBeenCalledWith("98765432100017");
  });

  it("🔴 contresignature : registre muet = refus « réessayez »", async () => {
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "axionia",
      lecteur: muet,
    });
    expect(r?.message).toMatch(/Réessayez/);
  });

  it("contresignature : registre qui lève = muet = refus", async () => {
    const leve = vi.fn(async () => {
      throw new Error("réseau");
    });
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "axionia",
      lecteur: leve,
    });
    expect(r?.message).toMatch(/Réessayez/);
  });

  it("contresignature : entreprise active = rien à objecter", async () => {
    expect(
      await objectionContratCadre({ ...base, metadata: V3, partie: "axionia", lecteur: actif }),
    ).toBeNull();
  });

  it("sans SIRET : refus des deux côtés", async () => {
    findUnique.mockResolvedValue({
      trainerId: "t-1",
      trainer: { siret: null },
      sousTraitant: null,
    });
    expect(
      (
        await objectionContratCadre({
          ...base,
          metadata: V3,
          partie: "sous_traitant",
          lecteur: actif,
        })
      )?.message,
    ).toMatch(/SIRET/);
    expect(
      (await objectionContratCadre({ ...base, metadata: V3, partie: "axionia", lecteur: actif }))
        ?.message,
    ).toMatch(/SIRET/);
  });
});

describe("consentement « code » — versionné à part", async () => {
  const m = await import("./mentions-document");
  it("le consentement ordinaire est inchangé ; la variante « code » le dit", () => {
    expect(m.CONSENTEMENT_VERSION_DOCUMENT).toBe("doc-consent-v1");
    expect(m.CONSENTEMENT_VERSION_DOCUMENT_CODE).toBe("doc-consent-code-v1");
    expect(m.CONSENTEMENT_VERSION_DOCUMENT_CODE.length).toBeLessThanOrEqual(20);
    const p = { pieceLibelle: "contrat", pieceNumero: "N", organisme: "Axion-IA SAS" };
    const sans = m.mentionCompleteDocument("sous_traitant", p, true);
    const avec = m.mentionCompleteDocument("sous_traitant", p, true, true);
    expect(sans).toEqual(m.mentionCompleteDocument("sous_traitant", p, true, false));
    expect(avec.join(" ")).toContain("code à usage unique reçu à mon adresse électronique");
    expect(sans.join(" ")).not.toContain("code à usage unique");
  });
});
