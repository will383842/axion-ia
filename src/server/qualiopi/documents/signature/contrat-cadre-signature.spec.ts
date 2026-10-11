/**
 * Lot L7c — ce que la signature d'un contrat-cadre v3 exige en plus :
 * un code pour la partie `sous_traitant`, et la lecture du registre public.
 *
 * 🔑 Une pièce v2 (ou tout autre type) ne lit rien et n'objecte rien : c'est ce
 * qui garde le lot ÉTEINT tant qu'aucune v3 n'est émise.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
const controler = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: (...a: unknown[]) => findUnique(...a) },
    verificationRegistreSousTraitance: { findMany: (...a: unknown[]) => findMany(...a) },
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({
  controlerRegistreFormateur: (...a: unknown[]) => controler(...a),
}));

import {
  codeRequis,
  estContratCadre,
  masquerAdresse,
  memeAdresse,
  objectionContratCadre,
  sourceRegistreAnnuaire,
} from "./contrat-cadre-signature";

const V3 = { renderData: { gabaritVersion: 3 } };
const V2 = { renderData: { gabaritVersion: 2 } };
const DOC = "11111111-1111-4111-8111-111111111111";
const MAINTENANT = new Date("2026-10-12T09:00:00Z");

const actif = vi.fn(async (_: string) => ({
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
  entreprise: { ...(await actif("x")).entreprise, active: false },
}));
const muet = vi.fn(async () => ({ ok: false as const, raison: "indisponible" as const }));
const introuvable = vi.fn(async () => ({ ok: false as const, raison: "introuvable" as const }));

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ trainerId: "t-1" });
  findMany.mockResolvedValue([]);
  controler.mockResolvedValue({ ok: true, verdict: "vert", motifs: [] });
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

describe("objection — registre public, par le contrôle L4", () => {
  const base = { documentGenereId: DOC, type: "contrat_sous_traitance", maintenant: MAINTENANT };
  const ligne = (verdict: string, joursAvant: number, source = "registre_entreprises+liste_of") => {
    const at = new Date(MAINTENANT.getTime() - joursAvant * 86_400_000);
    return { verdict, source, verifieAt: at, createdAt: at };
  };

  it("🔑 éteint : une v2 ne lit rien et ne contrôle rien", async () => {
    const r = await objectionContratCadre({ ...base, metadata: V2, partie: "sous_traitant" });
    expect(r).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(controler).not.toHaveBeenCalled();
  });

  it("signature : un contrôle vert de moins de 30 jours suffit, sans nouveau contrôle", async () => {
    findMany.mockResolvedValue([ligne("vert", 3)]);
    expect(
      await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" }),
    ).toBeNull();
    expect(controler).not.toHaveBeenCalled();
  });

  it("signature : un dernier contrôle ROUGE refuse sans relire", async () => {
    findMany.mockResolvedValue([ligne("rouge", 2)]);
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(r?.message).toMatch(/pas active/);
    expect(controler).not.toHaveBeenCalled();
  });

  it("signature : contrôle trop ancien → nouveau contrôle (sans auteur) ; rouge = refus", async () => {
    findMany.mockResolvedValue([ligne("vert", 40)]);
    controler.mockResolvedValue({ ok: true, verdict: "rouge", motifs: ["etablissement_ferme"] });
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(r?.message).toMatch(/pas active/);
    expect(controler.mock.calls[0]?.[2]).toEqual({
      trainerId: "t-1",
      verifieParId: null,
      maintenant: MAINTENANT,
    });
  });

  it("signature : registre muet (orange) = la signature passe", async () => {
    controler.mockResolvedValue({ ok: true, verdict: "orange", motifs: ["registre_muet"] });
    expect(
      await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" }),
    ).toBeNull();
  });

  it("🔴 contresignature : contrôle TOUJOURS refait, même avec un vert récent, au nom de l'administrateur", async () => {
    findMany.mockResolvedValue([ligne("vert", 1)]);
    controler.mockResolvedValue({ ok: true, verdict: "vert", motifs: [] });
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "axionia",
      adminId: "admin-1",
    });
    expect(r).toBeNull();
    expect(controler.mock.calls[0]?.[2]).toMatchObject({ verifieParId: "admin-1" });
  });

  it("🔴 contresignature : rouge = refus", async () => {
    controler.mockResolvedValue({ ok: true, verdict: "rouge", motifs: ["siren_cesse"] });
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "axionia",
      adminId: "a",
    });
    expect(r?.message).toMatch(/Contresignature impossible/);
  });

  it("🔴 contresignature : registre muet = refus « réessayez »", async () => {
    controler.mockResolvedValue({ ok: true, verdict: "orange", motifs: ["registre_muet"] });
    const r = await objectionContratCadre({
      ...base,
      metadata: V3,
      partie: "axionia",
      adminId: "a",
    });
    expect(r?.message).toMatch(/Réessayez/);
  });

  it("contresignature : orange pour un numéro de déclaration en cours = ne bloque pas (article 19)", async () => {
    controler.mockResolvedValue({ ok: true, verdict: "orange", motifs: ["nda_en_cours"] });
    expect(
      await objectionContratCadre({ ...base, metadata: V3, partie: "axionia", adminId: "a" }),
    ).toBeNull();
  });

  it("fiche hors périmètre ou contrat d'organisme : refus", async () => {
    controler.mockResolvedValue({ ok: false, raison: "hors_perimetre" });
    expect(
      (await objectionContratCadre({ ...base, metadata: V3, partie: "axionia", adminId: "a" }))
        ?.message,
    ).toMatch(/Contresignature impossible/);
    findUnique.mockResolvedValue({ trainerId: null });
    expect(
      (await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" }))?.message,
    ).toMatch(/organisme/);
  });
});

describe("source du registre pour le contrôle L4", () => {
  it("établissement fermé → rouge ; registre muet → orange, jamais rouge", async () => {
    const { jugerControleRegistre } =
      await import("@/server/qualiopi/formateurs-independants/controle-regles");
    const siret = "98765432100017";
    const juger = async (lecteur: Parameters<typeof sourceRegistreAnnuaire>[0]) =>
      jugerControleRegistre({
        siret,
        nda: "en cours",
        entreprise: await sourceRegistreAnnuaire(lecteur).lireEntreprise(siret),
        listeOF: null,
      });
    expect((await juger(ferme)).verdict).toBe("rouge");
    expect((await juger(muet)).verdict).toBe("orange");
    expect((await juger(muet)).motifs).toContain("registre_muet");
    expect((await juger(introuvable)).motifs).toContain("etablissement_introuvable");
    expect((await juger(actif)).verdict).not.toBe("rouge");
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
