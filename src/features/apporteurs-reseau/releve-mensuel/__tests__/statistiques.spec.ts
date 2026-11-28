// @vitest-environment node

/** Lot 3e — logique PURE des statistiques et des anomalies (aucune base). */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  anomaliesDePeriode,
  conditionsCommissionQ4b,
  totauxTvaDeContenu,
  construireSerie,
  hauteursEnPourcent,
  periodesDouzeMois,
  type ReleveEcran,
  type TotauxPeriode,
} from "../statistiques";
import { bornesPeriode } from "../periode";

function releve(over: Partial<ReleveEcran> = {}): ReleveEcran {
  return {
    id: "r1",
    numero: "REL-2026-10-0001",
    apporteurId: "a1",
    apporteurNom: "Apporteur fictif",
    rang: 0,
    statut: "prepare",
    nbLignes: 1,
    facturesHtCents: 10_000,
    avoirsHtCents: 0,
    tvaCents: 0,
    ttcCents: 10_000,
    viresTtcCents: 0,
    enAttenteHtCents: 0,
    cumulAnneeHtCents: 10_000,
    empreinteCourte: "abcd1234",
    pdfDisponible: true,
    emailPresent: true,
    erreur: null,
    motifEcart: null,
    envoyeAt: null,
    ...over,
  };
}

function cible(apporteurId: string, nom = "Apporteur fictif") {
  return { apporteurId, nom };
}

describe("periodesDouzeMois", () => {
  it("rend 12 mois consécutifs, le plus ancien d'abord, finissant à la période donnée", () => {
    const p = periodesDouzeMois("2026-10");
    expect(p).toHaveLength(12);
    expect(p[0]).toBe("2025-11");
    expect(p[11]).toBe("2026-10");
  });
});

describe("construireSerie", () => {
  const totaux: TotauxPeriode = {
    nbReleves: 3,
    nbLignes: 5,
    facturesHtCents: 50_000,
    avoirsHtCents: 5_000,
    viresTtcCents: 20_000,
    enAttenteHtCents: 0,
    cumulAnneeHtCents: 0,
  };
  it("lit les colonnes dénormalisées d'un mois préparé, calcule en direct sinon", () => {
    const s = construireSerie(
      ["2026-08", "2026-09", "2026-10"],
      new Map([["2026-10", totaux]]),
      new Map([["2026-09", { facturesHtCents: 7_000, avoirsHtCents: 0 }]]),
    );
    expect(s[2]).toMatchObject({
      source: "releves",
      facturesHtCents: 50_000,
      viresTtcCents: 20_000,
    });
    expect(s[1]).toMatchObject({ source: "direct", facturesHtCents: 7_000, viresTtcCents: null });
    expect(s[0]).toMatchObject({ source: "aucune", facturesHtCents: 0 });
  });
});

describe("hauteursEnPourcent", () => {
  it("met la plus grande valeur à 100 et reste à 0 si tout est nul", () => {
    expect(hauteursEnPourcent([50, 100, 0])).toEqual([50, 100, 0]);
    expect(hauteursEnPourcent([0, 0])).toEqual([0, 0]);
  });
});

describe("anomaliesDePeriode", () => {
  it("aucune anomalie quand tout est complet", () => {
    expect(anomaliesDePeriode({ cibles: [cible("a1")], releves: [releve()] })).toEqual([]);
  });
  it("complétude : une anomalie par apporteur cible sans relevé (rang 0)", () => {
    const a = anomaliesDePeriode({
      cibles: [cible("a1"), cible("a2", "Deux"), cible("a3", "Trois")],
      releves: [releve()],
    });
    const c = a.filter((x) => x.code === "completude");
    expect(c).toHaveLength(2);
    expect(c.map((x) => x.detail).join("|")).toContain("Deux");
    expect(c.map((x) => x.detail).join("|")).toContain("Trois");
  });
  it("complétude par ENSEMBLES : un résilié préparé ne masque pas un signé manquant", () => {
    // 2 cibles (un signé a2, un résilié a9 de la règle Q4 b) ; seul le résilié a un relevé.
    const a = anomaliesDePeriode({
      cibles: [cible("a2", "Signé manquant"), cible("a9", "Résilié")],
      releves: [releve({ id: "r9", apporteurId: "a9" })],
    });
    const c = a.filter((x) => x.code === "completude");
    expect(c).toHaveLength(1);
    expect(c[0]!.detail).toContain("Signé manquant");
  });
  it("un relevé de rang > 0 (rectificatif) ne tient pas lieu de relevé d'origine", () => {
    const a = anomaliesDePeriode({
      cibles: [cible("a1")],
      releves: [releve({ rang: 1 })],
    });
    expect(a.map((x) => x.code)).toContain("completude");
  });
  it("e-mail absent, PDF absent, données modifiées, échec d'enfilage", () => {
    const a = anomaliesDePeriode({
      cibles: [cible("a1"), cible("a2"), cible("a3"), cible("a4")],
      releves: [
        releve({ id: "1", apporteurId: "a1", emailPresent: false }),
        releve({ id: "2", apporteurId: "a2", pdfDisponible: false }),
        releve({
          id: "3",
          apporteurId: "a3",
          erreur: "données du mois modifiées depuis la vérification",
        }),
        releve({ id: "4", apporteurId: "a4", statut: "echec", erreur: "envoi interrompu" }),
      ],
    });
    expect(a.map((x) => x.code).sort()).toEqual(
      ["donnees_modifiees", "echec_envoi", "email_absent", "pdf_absent"].sort(),
    );
  });
  it("un relevé écarté ne déclenche ni e-mail absent ni PDF absent", () => {
    const a = anomaliesDePeriode({
      cibles: [cible("a1")],
      releves: [releve({ statut: "ecarte", emailPresent: false, pdfDisponible: false })],
    });
    expect(a).toEqual([]);
  });
});

type W = Record<string, unknown>;
/** Mini-évaluateur du sous-ensemble de `where` Prisma utilisé par la règle Q4 b. */
function evalWhere(w: W, row: W): boolean {
  return Object.entries(w).every(([k, v]) => {
    if (k === "OR") return (v as W[]).some((x) => evalWhere(x, row));
    if (k === "AND") return (v as W[]).every((x) => evalWhere(x, row));
    const val = row[k] ?? null;
    if (v === null) return val === null;
    if (typeof v !== "object" || v instanceof Date) return val === v;
    const o = v as { not?: unknown; lt?: Date; gte?: Date };
    if ("not" in o) return val !== o.not && !(o.not === null && val === null);
    if (o.lt || o.gte) {
      if (val === null) return false;
      const d = val as Date;
      return (!o.lt || d < o.lt) && (!o.gte || d >= o.gte);
    }
    return val === v;
  });
}

describe("lireCiblesPeriode (définition des cibles)", () => {
  const { debut, coupure } = bornesPeriode("2026-10");
  const av = new Date("2026-09-20T10:00:00Z");
  const ap = new Date("2026-11-02T10:00:00Z");
  const dedans = new Date("2026-10-10T10:00:00Z");
  const com = (o: W): W => ({ statut: "payee", autofactureNumero: "AXI-APP-1", ...o });
  const cible = (o: W) =>
    evalWhere(conditionsCommissionQ4b(debut, coupure) as unknown as W, com(o));

  async function lire(signes: W[], resilies: W[], avoirs: W[] = [], repris?: string[]) {
    const appels: Array<{ where: W }> = [];
    const piecesAppels: Array<{ where: W }> = [];
    const prisma = (await import("@/lib/prisma")).prisma as unknown as Record<string, unknown>;
    prisma.pieceAutofactureApporteur = {
      findMany: async (arg: { where: W }) => {
        piecesAppels.push(arg);
        return avoirs;
      },
    };
    prisma.commissionApporteur = {
      findMany: async () =>
        (repris ?? avoirs.map((a) => a.numero as string)).map((n) => ({ avoirNumero: n })),
    };
    prisma.apporteurReseau = {
      findMany: async (arg: { where: W }) => {
        appels.push(arg);
        return arg.where.statut === "signe" ? signes : resilies;
      },
    };
    const { lireCiblesPeriode } = await import("../statistiques");
    return { appels, piecesAppels, cibles: await lireCiblesPeriode("2026-10", true) };
  }
  const ligne = (id: string, denomination: string | null = null) => ({
    id,
    prenom: "A",
    nom: "B",
    denomination,
  });

  it("le nom d'une cible est DÉCHIFFRÉ (prénom et nom chiffrés en base), jamais « enc:v1:… »", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "ab".repeat(32));
    const { encryptPii } = await import("@/lib/pii-crypto");
    const chiffre = {
      id: "c1",
      prenom: encryptPii("Camille"),
      nom: encryptPii("Test"),
      denomination: null,
    };
    expect(chiffre.prenom).toMatch(/^enc:/);
    const { cibles } = await lire([chiffre], []);
    expect(cibles[0]!.nom).toBe("Camille Test");
    vi.unstubAllEnvs();
  });

  it("signés + Q4 b, identité masquée sans nom réel", async () => {
    const { cibles } = await lire([ligne("s1")], [ligne("r1", "Société fictive")]);
    expect(cibles.map((c) => c.apporteurId).sort()).toEqual(["r1", "s1"]);
    const masque = await (await import("../statistiques")).lireCiblesPeriode("2026-10", false);
    expect(masque.every((c) => c.nom === "Apporteur (identité masquée)")).toBe(true);
  });

  it("la borne de signature est la coupure (valeur, pas seulement `lt`)", async () => {
    const { appels } = await lire([], []);
    const signes = appels.find((a) => a.where.statut === "signe")!;
    expect((signes.where.OR as W[])[1]).toEqual({ signeParSocieteAt: { lt: coupure } });
  });

  it("un signé APRÈS la coupure n'est pas une cible : la lecture le filtre par la coupure", async () => {
    // Le fournisseur applique le `where` réel de lireCiblesPeriode à deux signés.
    const base = [
      { ...ligne("avant"), statut: "signe", signeParSocieteAt: new Date(coupure.getTime() - 1) },
      { ...ligne("pile"), statut: "signe", signeParSocieteAt: coupure },
      { ...ligne("apres"), statut: "signe", signeParSocieteAt: ap },
      { ...ligne("sansDate"), statut: "signe", signeParSocieteAt: null },
    ];
    const prisma = (await import("@/lib/prisma")).prisma as unknown as Record<string, unknown>;
    prisma.pieceAutofactureApporteur = { findMany: async () => [] };
    prisma.apporteurReseau = {
      findMany: async (arg: { where: W }) =>
        arg.where.statut === "signe" ? base.filter((r) => evalWhere(arg.where, r)) : [],
    };
    const { lireCiblesPeriode } = await import("../statistiques");
    const ids = (await lireCiblesPeriode("2026-10", true)).map((c) => c.apporteurId).sort();
    expect(ids).toEqual(["avant", "sansDate"]);
  });

  it("Q4 b : autofacture émise avant la coupure et non versée = cible", () => {
    expect(cible({ autofactureEmiseAt: av, verseeAt: null })).toBe(true);
  });
  it("Q4 b : résilié payé DANS le mois (autofacture de septembre versée en octobre) = cible", () => {
    expect(cible({ autofactureEmiseAt: av, verseeAt: dedans })).toBe(true);
  });
  it("Q4 b : versée après la coupure mais émise avant = cible (argent en jeu à la coupure)", () => {
    expect(cible({ autofactureEmiseAt: av, verseeAt: ap })).toBe(true);
  });
  it("Q4 b : autofacture émise APRÈS la coupure, non versée = PAS cible (faux positif)", () => {
    expect(cible({ autofactureEmiseAt: ap, verseeAt: null })).toBe(false);
  });
  it("Q4 b : tout réglé avant le mois = pas cible", () => {
    expect(cible({ autofactureEmiseAt: av, verseeAt: new Date("2026-09-25T10:00:00Z") })).toBe(
      false,
    );
  });
  it("Q4 b : attente posée avant la coupure sans autofacture émise avant = cible", () => {
    const o = { autofactureNumero: null, autofactureAttenteDepuis: av };
    expect(cible({ ...o, autofactureEmiseAt: null })).toBe(true);
    expect(cible({ ...o, autofactureEmiseAt: ap })).toBe(true);
  });
  it("Q4 b : attente posée APRÈS la coupure = pas cible", () => {
    expect(
      cible({ autofactureNumero: null, autofactureAttenteDepuis: ap, autofactureEmiseAt: null }),
    ).toBe(false);
  });
  it("Q4 b : la borne exacte est la coupure (émise pile à la coupure = après)", () => {
    expect(cible({ autofactureEmiseAt: coupure, verseeAt: null })).toBe(false);
    expect(cible({ autofactureEmiseAt: new Date(coupure.getTime() - 1), verseeAt: null })).toBe(
      true,
    );
    expect(cible({ autofactureEmiseAt: av, verseeAt: coupure })).toBe(true);
    expect(cible({ autofactureEmiseAt: av, verseeAt: new Date(coupure.getTime() - 1) })).toBe(true);
    expect(cible({ autofactureEmiseAt: av, verseeAt: debut })).toBe(true);
    expect(cible({ autofactureEmiseAt: av, verseeAt: new Date(debut.getTime() - 1) })).toBe(false);
  });
  it("Q4 b (D1) : émission datée par majAt quand autofactureEmiseAt est nul", () => {
    const o = { autofactureEmiseAt: null, verseeAt: null };
    expect(cible({ ...o, majAt: av })).toBe(true);
    expect(cible({ ...o, majAt: ap })).toBe(false);
  });
  it("Q4 b : autofacture reprise par un avoir, non versée = PAS cible", () => {
    expect(cible({ autofactureEmiseAt: av, verseeAt: null, avoirNumero: "AXI-APP-AV-1" })).toBe(
      false,
    );
  });
  it("Q4 b : émise ou versée dans le mois mais reprise par un avoir = PAS cible", () => {
    expect(cible({ autofactureEmiseAt: dedans, verseeAt: null, avoirNumero: "AV" })).toBe(false);
    expect(cible({ autofactureEmiseAt: av, verseeAt: dedans, avoirNumero: "AV" })).toBe(false);
  });
  it("Q4 b : une commission annulée ne rend jamais cible", () => {
    expect(cible({ statut: "annulee", autofactureEmiseAt: av, verseeAt: null })).toBe(false);
  });
  it("Q4 b : un avoir du mois rend cible (apporteur lu sur la pièce, bornes du mois)", async () => {
    const { appels, piecesAppels } = await lire(
      [],
      [],
      [
        { numero: "AV1", apporteurId: "r7" },
        { numero: "AV2", apporteurId: "r7" },
      ],
    );
    const q = appels.find((a) => a.where.statut !== "signe")!;
    expect((q.where.OR as W[]).some((x) => JSON.stringify(x) === '{"id":{"in":["r7"]}}')).toBe(
      true,
    );
    expect(piecesAppels[0]?.where).toEqual({
      genre: "avoir",
      emiseAt: { gte: debut, lt: coupure },
    });
  });
  it("Q4 b : un avoir qu'aucune commission non annulée ne porte ne rend pas cible", async () => {
    const { appels } = await lire([], [], [{ numero: "AV1", apporteurId: "r8" }], []);
    const q = appels.find((a) => a.where.statut !== "signe")!;
    expect(JSON.stringify(q.where)).not.toContain("r8");
  });
});

describe("lireVuePeriode : cibles et TVA/TTC lus du contenu", () => {
  it("cibles vient de lireCiblesPeriode ; TVA et TTC viennent du contenu figé", async () => {
    const prisma = (await import("@/lib/prisma")).prisma as unknown as Record<string, unknown>;
    prisma.pieceAutofactureApporteur = { findMany: async () => [] };
    prisma.apporteurReseau = {
      findMany: async () => [{ id: "s1", prenom: "A", nom: "B", denomination: null }],
    };
    const ligne = {
      id: "r1",
      numero: "REL-1",
      apporteurId: "s1",
      rang: 0,
      statut: "prepare",
      nbLignes: 1,
      facturesHtCents: 100,
      avoirsHtCents: 0,
      contenu: { totaux: { tvaCents: 1_234, ttcCents: 5_678 } },
      viresTtcCents: 0,
      enAttenteHtCents: 0,
      cumulAnneeHtCents: 0,
      empreinteSha256: "abcdef0123456789",
      pdfR2Key: null,
      erreur: null,
      motifEcart: null,
      envoyeAt: null,
      apporteur: { prenom: "A", nom: "B", denomination: null, email: null },
    };
    prisma.releveMensuelApporteur = {
      findMany: async () => [ligne, { ...ligne, id: "r2", contenu: "illisible" }],
    };
    const { lireVuePeriode } = await import("../statistiques");
    const v = await lireVuePeriode("2026-10", true);
    expect(v.cibles.map((c) => c.apporteurId)).toEqual(["s1"]);
    expect(v.releves[0]).toMatchObject({ tvaCents: 1_234, ttcCents: 5_678 });
    expect(v.releves[1]).toMatchObject({ tvaCents: null, ttcCents: null });
  });
});

describe("totauxTvaDeContenu", () => {
  it("lit les entiers, sinon null (jamais 0)", () => {
    expect(totauxTvaDeContenu({ totaux: { tvaCents: 0, ttcCents: 10 } })).toEqual({
      tvaCents: 0,
      ttcCents: 10,
    });
    for (const c of [null, undefined, "x", {}, { totaux: {} }, { totaux: { tvaCents: 1.5 } }]) {
      const r = totauxTvaDeContenu(c);
      expect(r.tvaCents).toBeNull();
      expect(r.ttcCents).toBeNull();
    }
  });
});
