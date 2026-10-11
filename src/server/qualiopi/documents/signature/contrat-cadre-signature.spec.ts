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
  SOURCE_REGISTRE: "registre_entreprises+liste_of",
  controlerRegistreFormateur: (...a: unknown[]) => controler(...a),
}));

import {
  codeRequis,
  entrepriseActiveConfirmee,
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
const SIRET = "98765432100017";
/** Preuve canonique d'un registre qui a CONFIRMÉ l'entreprise active. */
const PREUVE_ACTIVE = {
  entreprise: {
    siren: "987654321",
    etatAdministratif: "A",
    naf: "85.59A",
    etablissement: { siret: SIRET, ouvert: true },
  },
  listeOF: null,
  motifs: [],
};

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
  findUnique.mockResolvedValue({ trainerId: "t-1", trainer: { siret: SIRET } });
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
  const ligne = (
    verdict: string,
    joursAvant: number,
    o: { source?: string; motif?: string | null; siret?: string; preuve?: unknown } = {},
  ) => {
    const at = new Date(MAINTENANT.getTime() - joursAvant * 86_400_000);
    return {
      verdict,
      source: o.source ?? "registre_entreprises+liste_of",
      verifieAt: at,
      createdAt: at,
      motif: o.motif ?? null,
      siret: o.siret ?? SIRET,
      reponseSource: o.preuve ?? PREUVE_ACTIVE,
    };
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
    expect(r?.message).toMatch(/ne confirme pas/);
    expect(controler).not.toHaveBeenCalled();
  });

  it("signature : un rouge sur un ANCIEN SIRET (fiche corrigée depuis) → registre relu", async () => {
    findMany.mockResolvedValue([ligne("rouge", 2, { siret: "11111111100011" })]);
    controler.mockResolvedValue({ ok: true, verdict: "vert", motifs: [] });
    expect(
      await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" }),
    ).toBeNull();
    expect(controler).toHaveBeenCalledTimes(1);
  });

  it("signature : contrôle trop ancien → nouveau contrôle (sans auteur) ; rouge = refus", async () => {
    findMany.mockResolvedValue([ligne("vert", 40)]);
    controler.mockResolvedValue({ ok: true, verdict: "rouge", motifs: ["etablissement_ferme"] });
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(r?.message).toMatch(/ne confirme pas/);
    expect(controler.mock.calls[0]?.[2]).toEqual({
      trainerId: "t-1",
      verifieParId: null,
      maintenant: MAINTENANT,
    });
  });

  it("🔴 signature : registre muet = REFUS « réessayez », jamais une signature", async () => {
    controler.mockResolvedValue({ ok: true, verdict: "orange", motifs: ["registre_muet"] });
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(r?.message).toMatch(/Réessayez/);
  });

  it("🔴 signature : établissement INTROUVABLE (orange) = refus qui oriente vers le SIRET", async () => {
    controler.mockResolvedValue({
      ok: true,
      verdict: "orange",
      motifs: ["registre_muet", "etablissement_introuvable", "activite_a_controler"],
    });
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(r?.message).toMatch(/ne confirme pas/);
    expect(r?.message).toMatch(/Vérifiez ce numéro/);
  });

  it("🔴 signature : SIRET absent de la fiche = refus", async () => {
    controler.mockResolvedValue({ ok: true, verdict: "orange", motifs: ["siret_absent"] });
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(r?.message).toMatch(/ne confirme pas/);
  });

  it("🔴 signature : contrôle impossible à inscrire (exception) = refus, jamais un passage", async () => {
    controler.mockRejectedValue(new Error("base indisponible"));
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(r).not.toBeNull();
  });

  it("🔴 signature : un orange VALIDÉ par un administrateur ne vaut pas un SIREN actif", async () => {
    const controle = ligne("orange", 2, {
      motif: "etablissement_introuvable",
      preuve: { entreprise: { siren: "987654321", etatAdministratif: null, etablissement: null } },
    });
    const validation = {
      ...ligne("orange", 2, { source: "validation_administrateur" }),
      createdAt: new Date(MAINTENANT.getTime() - 86_400_000),
    };
    findMany.mockResolvedValue([validation, controle]);
    controler.mockResolvedValue({
      ok: true,
      verdict: "orange",
      motifs: ["etablissement_introuvable"],
    });
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(controler).toHaveBeenCalledTimes(1);
    expect(r?.message).toMatch(/ne confirme pas/);
  });

  it("signature : un contrôle récent sur un AUTRE SIRET que la fiche ne compte pas → relu", async () => {
    findMany.mockResolvedValue([ligne("vert", 3, { siret: "11111111100011" })]);
    controler.mockResolvedValue({ ok: true, verdict: "vert", motifs: [] });
    expect(
      await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" }),
    ).toBeNull();
    expect(controler).toHaveBeenCalledTimes(1);
  });

  it("signature : un « vert » dont la preuve ne dit pas l'entreprise active ne compte pas", async () => {
    findMany.mockResolvedValue([ligne("vert", 3, { preuve: { entreprise: null } })]);
    controler.mockResolvedValue({ ok: true, verdict: "orange", motifs: ["registre_muet"] });
    const r = await objectionContratCadre({ ...base, metadata: V3, partie: "sous_traitant" });
    expect(controler).toHaveBeenCalledTimes(1);
    expect(r).not.toBeNull();
  });

  it("signature : numéro de déclaration en cours (orange) avec entreprise active = passe (article 19)", async () => {
    controler.mockResolvedValue({ ok: true, verdict: "orange", motifs: ["nda_en_cours"] });
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

  it.each([
    [["registre_muet", "etablissement_introuvable"]],
    [["siret_absent"]],
    [["registre_muet", "etablissement_ferme"]],
  ])("🔴 contresignature : %j = refus", async (motifs) => {
    controler.mockResolvedValue({ ok: true, verdict: "orange", motifs });
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
  const siret = SIRET;
  const lireAvec = (lecteur: Parameters<typeof sourceRegistreAnnuaire>[0]) =>
    sourceRegistreAnnuaire(lecteur).lireEntreprise(siret);
  const juger = async (lecteur: Parameters<typeof sourceRegistreAnnuaire>[0]) => {
    const { jugerControleRegistre } =
      await import("@/server/qualiopi/formateurs-independants/controle-regles");
    return jugerControleRegistre({
      siret,
      nda: "en cours",
      entreprise: await lireAvec(lecteur),
      listeOF: null,
    });
  };

  it("🔴 n'écrit jamais un SIREN « actif » que le registre n'a pas confirmé", async () => {
    expect((await lireAvec(introuvable))?.etatAdministratif).toBeNull();
    expect((await lireAvec(ferme))?.etatAdministratif).toBeNull();
    expect(await lireAvec(muet)).toBeNull();
    expect(await lireAvec(actif)).toMatchObject({
      etatAdministratif: "A",
      etablissement: { siret, ouvert: true },
    });
  });

  it("🔴 introuvable, fermé, en panne, état « non dit » : un seul cas signe — l'actif", async () => {
    const nonDit = vi.fn(async () => ({
      ok: true as const,
      entreprise: {
        ...(await actif("x")).entreprise,
        active: null as unknown as boolean,
      },
    }));
    const cas = { introuvable, ferme, muet, nonDit, actif } as const;
    const signables: string[] = [];
    for (const [nom, lecteur] of Object.entries(cas)) {
      const v = await juger(lecteur);
      if (entrepriseActiveConfirmee(v.verdict, v.motifs)) signables.push(nom);
    }
    expect(signables).toEqual(["actif"]);
    expect((await juger(ferme)).verdict).toBe("rouge");
    expect((await juger(muet)).verdict).toBe("orange");
    expect((await juger(introuvable)).motifs).toContain("etablissement_introuvable");
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
