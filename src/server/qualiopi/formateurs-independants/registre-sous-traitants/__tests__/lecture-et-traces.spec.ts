// @vitest-environment node

/**
 * Qualiopi ind. 27 — la lecture du registre, la trace d'un contrôle et l'export.
 *
 *   · la lecture calcule pièces, dernier contrôle et prochaine échéance ;
 *   · une pièce archivée ne compte pas ;
 *   · un contrôle tracé : auteur, date, résultat, motif — un code inconnu est refusé,
 *     un résultat non conforme exige un motif, le motif n'entre pas au journal ;
 *   · coupé, rien n'est tracé ;
 *   · l'export CSV porte toutes les colonnes et la date d'export en pied.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const T1 = "11111111-1111-4111-8111-111111111111";
const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "66666666-6666-4666-8666-666666666666";
const MAINTENANT = new Date("2026-10-16T10:00:00Z");

const m = vi.hoisted(() => ({
  allume: vi.fn(),
  journaliser: vi.fn(),
  cumuls: vi.fn(),
  db: {
    registreSousTraitantIndependant: { findMany: vi.fn(), findUnique: vi.fn() },
    controleSousTraitant: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.db }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: m.journaliser }));
vi.mock("../../interrupteur-allume", () => ({ interrupteurAllume: m.allume }));
vi.mock("../../vigilance-seuil-lecture", () => ({ lireCumulsHonorairesHtCents: m.cumuls }));

import { exportRegistreCsv } from "../export";
import { lireRegistre } from "../lecture";
import { tracerControle } from "../traces";

function ligneLue() {
  return {
    id: R1,
    trainerId: T1,
    sousTraitantId: S1,
    dateEntree: new Date("2026-09-01T00:00:00Z"),
    statut: "actif",
    statutDepuis: new Date("2026-09-01T00:00:00Z"),
    dateSortie: null,
    motifSortie: null,
    sousTraitant: {
      nom: "Anne Martin",
      siret: "12345678900011",
      nda: "84691234569",
      objetPrestation: "Animation de formations — habilité sur : Prompt engineering",
    },
    controles: [
      {
        code: "pieces_entree",
        faitAt: new Date("2026-09-02T00:00:00Z"),
        resultat: "conforme",
        motif: null,
        auteurId: ADMIN,
      },
    ],
    trainer: {
      documents: [
        {
          type: "kbis_avis_sirene",
          statutValidation: "valide",
          fichierUrl: null,
          dateEmission: new Date("2026-08-01T00:00:00Z"),
          dateExpiration: new Date("2026-10-01T00:00:00Z"),
          archiveAt: new Date("2026-09-15T00:00:00Z"),
        },
        {
          type: "kbis_avis_sirene",
          statutValidation: "valide",
          fichierUrl: null,
          dateEmission: new Date("2026-09-15T00:00:00Z"),
          dateExpiration: null,
          archiveAt: null,
        },
      ],
      verificationsRegistre: [
        {
          verdict: "vert",
          source: "registre_entreprises+liste_of",
          verifieAt: new Date("2026-10-10T00:00:00Z"),
          createdAt: new Date("2026-10-10T00:00:00Z"),
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.allume.mockResolvedValue(true);
  m.cumuls.mockResolvedValue(new Map([[T1, 0]]));
  m.db.registreSousTraitantIndependant.findMany.mockResolvedValue([ligneLue()]);
  m.db.registreSousTraitantIndependant.findUnique.mockResolvedValue({ id: R1 });
  m.db.controleSousTraitant.create.mockResolvedValue({ id: "c1" });
});

describe("lecture du registre", () => {
  it("identité, pièces (archivée écartée), dernier contrôle, prochaine échéance", async () => {
    const [l] = await lireRegistre(MAINTENANT);
    expect(l).toMatchObject({
      trainerId: T1,
      raisonSociale: "Anne Martin",
      siret: "12345678900011",
      nda: "84691234569",
      statut: "actif",
      dateEntree: new Date("2026-09-01T00:00:00Z"),
      dernierControleAt: new Date("2026-10-10T00:00:00Z"),
      prochaineEcheance: new Date("2026-11-09T00:00:00Z"),
    });
    expect(l?.pieces.find((p) => p.code === "kbis_sirene")?.etat).toBe("valide");
    expect(l?.pieces.find((p) => p.code === "urssaf")?.etat).toBe("non_exigee");
  });
});

describe("trace d'un contrôle", () => {
  const base = {
    trainerId: T1,
    code: "revue_annuelle",
    resultat: "conforme" as const,
    motif: null,
    faitAt: new Date("2026-10-15T00:00:00Z"),
    auteurId: ADMIN,
    maintenant: MAINTENANT,
  };

  it("trace auteur, date, résultat, motif ; journal sans le motif", async () => {
    const r = await tracerControle({
      ...base,
      resultat: "non_conforme",
      motif: "Assurance non fournie",
    });
    expect(r).toEqual({ ok: true });
    expect(m.db.controleSousTraitant.create).toHaveBeenCalledWith({
      data: {
        registreId: R1,
        code: "revue_annuelle",
        faitAt: new Date("2026-10-15T00:00:00Z"),
        auteurId: ADMIN,
        resultat: "non_conforme",
        motif: "Assurance non fournie",
      },
      select: { id: true },
    });
    const entree = m.journaliser.mock.calls[0]?.[1];
    expect(entree).toMatchObject({
      action: "qualiopi.registre_sous_traitants.controle_trace",
      targetType: "Trainer",
      targetId: T1,
      changes: { code: "revue_annuelle", resultat: "non_conforme" },
      session: { userId: ADMIN },
    });
    expect(JSON.stringify(entree)).not.toContain("Assurance");
  });

  it("un code hors de la configuration est refusé", async () => {
    const r = await tracerControle({ ...base, code: "inventé" });
    expect(r.ok).toBe(false);
    expect(m.db.controleSousTraitant.create).not.toHaveBeenCalled();
  });

  it("non conforme ou à revoir sans motif : refusé", async () => {
    expect((await tracerControle({ ...base, resultat: "a_revoir" })).ok).toBe(false);
    expect(m.db.controleSousTraitant.create).not.toHaveBeenCalled();
  });

  it("une date dans le futur est refusée", async () => {
    const r = await tracerControle({ ...base, faitAt: new Date("2026-10-20T00:00:00Z") });
    expect(r.ok).toBe(false);
  });

  it("formateur absent du registre : refusé", async () => {
    m.db.registreSousTraitantIndependant.findUnique.mockResolvedValue(null);
    expect((await tracerControle(base)).ok).toBe(false);
  });

  it("coupé : rien n'est tracé", async () => {
    m.allume.mockResolvedValue(false);
    expect((await tracerControle(base)).ok).toBe(false);
    expect(m.db.controleSousTraitant.create).not.toHaveBeenCalled();
  });
});

describe("export CSV", () => {
  it("toutes les colonnes demandées, et la date d'export en pied", async () => {
    const csv = await exportRegistreCsv(MAINTENANT);
    const lignes = csv.trim().split("\n");
    expect(lignes[0]).toContain("Raison sociale");
    for (const col of [
      "SIRET",
      "NDA",
      "Formations habilitées",
      "Date d'entrée",
      "Attestation de vigilance URSSAF",
      "Attestation RC pro",
      "KBIS ou avis SIRENE",
      "Dernier contrôle",
      "Prochaine échéance",
      "Statut",
      "Date de sortie",
      "Motif de sortie",
    ]) {
      expect(lignes[0]).toContain(col);
    }
    expect(lignes[1]).toContain("Anne Martin");
    expect(lignes[1]).toContain("12345678900011");
    expect(lignes.at(-1)).toMatch(/Exporté le 16\/10\/2026/);
  });

  it("une cellule qui commence par = est neutralisée (injection de formule)", async () => {
    const l = ligneLue();
    m.db.registreSousTraitantIndependant.findMany.mockResolvedValue([
      { ...l, sousTraitant: { ...l.sousTraitant, nom: "=HYPERLINK(1)" } },
    ]);
    const csv = await exportRegistreCsv(MAINTENANT);
    expect(csv).not.toMatch(/(^|;)"?=HYPERLINK/m);
  });
});

describe("trace d'un contrôle — le jour même", () => {
  it("un contrôle daté d'aujourd'hui (midi) est accepté même tracé le matin", async () => {
    const r = await tracerControle({
      trainerId: T1,
      code: "registre_public",
      resultat: "conforme",
      motif: null,
      faitAt: new Date("2026-10-16T12:00:00Z"),
      auteurId: ADMIN,
      maintenant: new Date("2026-10-16T07:00:00Z"),
    });
    expect(r).toEqual({ ok: true });
  });
});
