/**
 * Lot S5 — émission de la lettre v2, et ce que l'interrupteur coupé garantit.
 *
 *  - coupé : la console émet la v1, DATÉE v1 (son exemplaire signé se rend avec
 *    la v1 archivée, texte identique à l'ancien gabarit courant) ;
 *  - allumé : une seule lettre vivante par mission ; l'ancienne non signée est
 *    annulée par le système, une lettre signée exige un motif ; la lettre est
 *    liée à la mission et datée v2.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const m = {
    session: vi.fn(),
    trainer: vi.fn(),
    mission: vi.fn(),
    contrat: vi.fn(),
    vivantes: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
    affectation: vi.fn(async (..._a: unknown[]) => ({ tarifHtCents: null }) as unknown),
    count: vi.fn(async (..._a: unknown[]) => 0),
    docUpdateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
    missionUpdate: vi.fn(async (..._a: unknown[]) => ({})),
    missionUpdateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
    // Sans `missionId` : les missions dont l'accord est donné (une par défaut).
    missions: vi.fn(async (...a: unknown[]): Promise<unknown[]> => {
      const r = await m.mission(...a);
      return r ? [r] : [];
    }),
    generate: vi.fn(async (..._a: unknown[]) => ({ id: "doc-neuf", numero: "AXI-DOC-2026-0100" })),
  };
  const prisma = {
    trainingSession: { findUnique: (...a: unknown[]) => m.session(...a) },
    trainer: { findUnique: (...a: unknown[]) => m.trainer(...a) },
    sessionFormateur: { findUnique: (...a: unknown[]) => m.affectation(...a) },
    missionFormateur: {
      findFirst: (...a: unknown[]) => m.mission(...a),
      findMany: (...a: unknown[]) => m.missions(...a),
      update: (...a: unknown[]) => m.missionUpdate(...a),
      updateMany: (...a: unknown[]) => m.missionUpdateMany(...a),
    },
    documentGenere: {
      findFirst: (...a: unknown[]) => m.contrat(...a),
      findMany: (...a: unknown[]) => m.vivantes(...a),
      count: (...a: unknown[]) => m.count(...a),
      updateMany: (...a: unknown[]) => m.docUpdateMany(...a),
    },
  };
  return { m, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => h.m.generate(...a),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({
    raisonSociale: "Axion-IA SAS",
    siret: "00000000000000",
    nda: "84000000000",
  })),
}));

import {
  genererLettreMissionV2,
  MOTIF_CHANGEMENT_FORMATEUR,
  MOTIF_LETTRE_REMPLACEE,
} from "../lettre-mission-v2-generation";
import { composantGabarit } from "../signature/exemplaire-signe";
import { GABARIT_VERSIONS } from "../templates/gabarit-versions";
import { LettreMissionPdf } from "../templates/lettre-mission";
import { LettreMissionV2Pdf } from "../templates/lettre-mission-v2";

const SESSION_ID = "a5a5a5a5-0000-4000-8000-00000000000a";
const TRAINER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function mission() {
  return {
    id: "mi-1",
    statut: "acceptee",
    reponduAt: new Date("2026-10-12T07:41:00Z"),
    accordHorsOutilAt: null,
    // Étape 4 : sans conditions FIGÉES sur la mission, aucune lettre.
    tarifHtCents: 35_000,
    forfaitDeplacementParJourHtCents: null,
    regimeTvaFige: "franchise_293b",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.m.session.mockResolvedValue({
    numero: "AXI-SESS-2026-042",
    titreSession: "IA pour managers",
    nbParticipantsPrevus: 8,
    lieuType: "distanciel",
    lieuIntitule: null,
    lieuAdresse: null,
    lieuCodePostal: null,
    lieuVille: null,
    lieuSalle: null,
    lieuVisioUrl: null,
    client: { raisonSociale: "Client SAS" },
    sessionFormateurs: [{ trainerId: TRAINER_ID }],
    jours: [
      {
        date: new Date("2026-11-04T00:00:00Z"),
        heureDebut: "09:00",
        heureFin: "17:00",
        trainerId: null,
      },
    ],
  });
  h.m.trainer.mockResolvedValue({
    prenom: "Marie",
    nom: "Dupont",
    statut: "sous_traitant",
    siret: "12345678900012",
    sousTraitantNda: "84380000000",
    regimeTvaHonoraires: "franchise_293b",
    mandatAutofacturationSigneAt: new Date("2026-10-01T00:00:00Z"),
    mandatAutofacturationRevoqueAt: null,
    organismeSousTraitantId: null,
  });
  h.m.contrat.mockResolvedValue({
    metadata: { renderData: { gabaritVersion: 3 } },
    signatures: [{ signeAt: new Date("2026-10-02T10:00:00Z") }],
  });
  h.m.mission.mockResolvedValue(mission());
});

describe("allumé : la lettre v2", () => {
  it("datée v3 (étape 3 du C4), liée à la mission, jamais un duplicata", async () => {
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toMatchObject({ ok: true, documentId: "doc-neuf", lettreAnnuleeId: null });
    const entree = h.m.generate.mock.calls[0]?.[0] as unknown as {
      gabaritVersion: number;
      estCopie: boolean;
    };
    expect(entree.gabaritVersion).toBe(3);
    expect(entree.estCopie).toBe(false);
    // Lien CONDITIONNEL : la mission de CE couple, et elle seule.
    expect(h.m.missionUpdateMany).toHaveBeenCalledWith({
      where: { id: "mi-1", sessionId: SESSION_ID, trainerId: TRAINER_ID },
      data: { lettreMissionId: "doc-neuf" },
    });
  });

  it("refuse sans contrat-cadre v3 signé, sans rien émettre", async () => {
    h.m.contrat.mockResolvedValue({
      metadata: { renderData: { gabaritVersion: 2 } },
      signatures: [{ signeAt: new Date() }],
    });
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r.ok).toBe(false);
    expect(h.m.generate).not.toHaveBeenCalled();
  });

  it("une seule lettre vivante : l'ancienne NON signée (v1 comprise) est annulée APRÈS l'émission", async () => {
    h.m.vivantes.mockResolvedValue([{ id: "lettre-1", signatures: [] }]);
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toMatchObject({ ok: true, lettreAnnuleeId: "lettre-1" });
    expect(h.m.docUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["lettre-1"] }, annuleeAt: null },
        data: expect.objectContaining({ annuleeMotif: MOTIF_LETTRE_REMPLACEE }),
      }),
    );
    // Annulée après : un rendu en échec ne laisse pas la mission sans lettre.
    expect(h.m.generate.mock.invocationCallOrder[0]).toBeLessThan(
      h.m.docUpdateMany.mock.invocationCallOrder[0]!,
    );
    // La contrainte de la base exige un motif d'au moins 10 caractères.
    expect(MOTIF_LETTRE_REMPLACEE.trim().length).toBeGreaterThanOrEqual(10);
    expect(MOTIF_CHANGEMENT_FORMATEUR.trim().length).toBeGreaterThanOrEqual(10);
  });

  it("rendu en échec : aucune lettre n'est annulée", async () => {
    h.m.vivantes.mockResolvedValue([{ id: "lettre-1", signatures: [] }]);
    h.m.generate.mockRejectedValueOnce(new Error("rendu impossible"));
    await expect(
      genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID }),
    ).rejects.toThrow();
    expect(h.m.docUpdateMany).not.toHaveBeenCalled();
  });

  it("étape 4 — tarif non figé sur la mission : refus clair, jamais le tarif de l'affectation", async () => {
    h.m.affectation.mockResolvedValue({ tarifHtCents: 40_000 });
    h.m.mission.mockResolvedValue({ ...mission(), tarifHtCents: null });
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toEqual({ ok: false, erreur: expect.stringMatching(/tarif.*n'est pas figé/i) });
    expect(h.m.generate).not.toHaveBeenCalled();
  });

  it("étape 4 — l'annonce de la lettre est rangée avec elle, et rendue au moteur", async () => {
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    const entree = h.m.generate.mock.calls[0]?.[0] as unknown as {
      metadata: Record<string, unknown>;
    };
    // Une journée 09:00-17:00 à 35 000 c, à distance : 35 000 c HT en novembre.
    expect(entree.metadata).toEqual({
      annonceLettre: { totalHtCents: 35_000, parMois: { "2026-11": 35_000 } },
    });
    expect(r).toMatchObject({
      ok: true,
      annonce: { journees: 1, demiJournees: 0, totalHtCents: 35_000 },
    });
  });

  it("étape 4 — co-animation : seules les journées de CE formateur", async () => {
    const s = (await h.m.session()) as Record<string, unknown>;
    h.m.session.mockResolvedValue({
      ...s,
      sessionFormateurs: [{ trainerId: TRAINER_ID }, { trainerId: "autre" }],
      jours: [
        {
          date: new Date("2026-11-04T00:00:00Z"),
          heureDebut: "09:00",
          heureFin: "17:00",
          trainerId: null,
        },
        {
          date: new Date("2026-11-05T00:00:00Z"),
          heureDebut: "09:00",
          heureFin: "17:00",
          trainerId: "autre",
        },
      ],
    });
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toMatchObject({ ok: true, annonce: { journees: 1, totalHtCents: 35_000 } });
  });

  it("une lettre déjà SIGNÉE n'est jamais annulée en silence : motif exigé", async () => {
    h.m.vivantes.mockResolvedValue([{ id: "lettre-1", signatures: [{ id: "sig-1" }] }]);
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r.ok).toBe(false);
    expect(h.m.generate).not.toHaveBeenCalled();
    const avecMotif = await genererLettreMissionV2({
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
      rectificationMotif: "Dates déplacées par le client",
    });
    expect(avecMotif).toMatchObject({ ok: true, lettreAnnuleeId: null });
  });
});

describe("coupé : la lettre d'avant, à l'identique", () => {
  const ACTION = readFileSync(
    join(process.cwd(), "src/server/actions/qualiopi/documents.ts"),
    "utf8",
  );

  it("la v2 n'est atteinte que par l'interrupteur `lettre_v2`", () => {
    expect(ACTION).toContain('(await interrupteurAllume("lettre_v2"))');
    expect(ACTION.match(/genererLettreMissionV2\(/g)?.length).toBe(1);
  });

  it("les deux générateurs v1 (session et cadre) datent leur pièce v1", () => {
    expect(ACTION.match(/gabaritVersion: 1,/g)?.length).toBe(2);
  });

  it("la v1 reste la version émise par défaut ; les v2 (figée) et v3 sont arrêtées", () => {
    expect(GABARIT_VERSIONS.lettre_mission).toBe(1);
    expect(composantGabarit("lettre_mission", 1)).toBe(LettreMissionPdf);
    expect(composantGabarit("lettre_mission", 3)).toBe(LettreMissionV2Pdf);
    expect(composantGabarit("lettre_mission", 2)).not.toBe(LettreMissionV2Pdf);
    expect(composantGabarit("lettre_mission", 2)).not.toBeNull();
  });
});

describe("forfait de déplacement — seulement sur place (relecture argent #1501, 2e tour)", () => {
  async function deplacementImprime(lieu: { lieuType: string | null; modalite: string }) {
    const s = (await h.m.session()) as Record<string, unknown>;
    h.m.session.mockResolvedValue({ ...s, ...lieu });
    h.m.vivantes.mockResolvedValue([]);
    h.m.mission.mockResolvedValue({
      ...mission(),
      tarifHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 8_000,
      regimeTvaFige: "assujetti_20",
    });
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toMatchObject({ ok: true });
    const entree = h.m.generate.mock.calls[0]?.[0] as unknown as {
      buildElement: (n: string) => { props: { data: { deplacement: unknown } } };
    };
    return entree.buildElement("AXI-DOC-2026-0100").props.data.deplacement;
  }

  it("lieu non renseigné, modalité à distance : aucun forfait sur la lettre", async () => {
    expect(await deplacementImprime({ lieuType: null, modalite: "distanciel" })).toBeNull();
  });

  it("sur place : le forfait figé est imprimé", async () => {
    expect(await deplacementImprime({ lieuType: "sur_site", modalite: "presentiel" })).toEqual({
      forfaitParJourHtCents: 8_000,
      joursDeplacement: 1,
      totalHtCents: 8_000,
    });
  });
});

describe("rattachement de la lettre — appel console compris (relecture #1502, 2e tour)", () => {
  const AUTRE_SESSION = "a5a5a5a5-0000-4000-8000-00000000000b";
  const AUTRE_FORMATEUR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  type M = ReturnType<typeof mission> & {
    role?: string;
    sessionId: string;
    trainerId: string;
    solliciteAt: Date;
  };
  let base: M[] = [];

  /** Une base en mémoire : le `where` est réellement appliqué. */
  function correspond(x: M, where: Record<string, unknown>): boolean {
    if (where.sessionId !== undefined && x.sessionId !== where.sessionId) return false;
    if (where.trainerId !== undefined && x.trainerId !== where.trainerId) return false;
    if (where.id !== undefined && x.id !== where.id) return false;
    if (where.role !== undefined && x.role !== where.role) return false;
    const st = where.statut as { in?: string[] } | undefined;
    if (st?.in !== undefined && !st.in.includes(x.statut)) return false;
    return true;
  }
  function lire(a: unknown): M[] {
    const { where } = a as { where: Record<string, unknown> };
    return base
      .filter((x) => correspond(x, where))
      .sort((p, q) => q.solliciteAt.getTime() - p.solliciteAt.getTime());
  }

  beforeEach(() => {
    h.m.vivantes.mockResolvedValue([]);
    h.m.mission.mockImplementation(async (a: unknown) => lire(a)[0] ?? null);
    h.m.missions.mockImplementation(async (a: unknown) => lire(a));
    h.m.missionUpdateMany.mockImplementation(async (a: unknown) => ({ count: lire(a).length }));
    base = [
      {
        ...mission(),
        id: "mi-acceptee",
        role: "principal",
        sessionId: SESSION_ID,
        trainerId: TRAINER_ID,
        solliciteAt: new Date("2026-10-01T08:00:00Z"),
      },
    ];
  });

  it("missionId d'une AUTRE session : refusé, aucun numéro alloué", async () => {
    base.push({
      ...mission(),
      id: "mi-autre-session",
      sessionId: AUTRE_SESSION,
      trainerId: TRAINER_ID,
      solliciteAt: new Date("2026-10-02T08:00:00Z"),
    });
    const r = await genererLettreMissionV2({
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
      missionId: "mi-autre-session",
    });
    expect(r.ok).toBe(false);
    expect(h.m.generate).not.toHaveBeenCalled();
  });

  it("missionId d'un AUTRE formateur : refusé, aucun numéro alloué", async () => {
    base.push({
      ...mission(),
      id: "mi-autre-formateur",
      sessionId: SESSION_ID,
      trainerId: AUTRE_FORMATEUR,
      solliciteAt: new Date("2026-10-02T08:00:00Z"),
    });
    const r = await genererLettreMissionV2({
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
      missionId: "mi-autre-formateur",
    });
    expect(r.ok).toBe(false);
    expect(h.m.generate).not.toHaveBeenCalled();
  });

  it("console, sans missionId : une acceptée ancienne et une refusée plus récente → liée à l'ACCEPTÉE", async () => {
    base.push({
      ...mission(),
      id: "mi-refusee",
      role: "principal",
      statut: "refusee",
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
      solliciteAt: new Date("2026-10-05T08:00:00Z"),
    });
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toMatchObject({ ok: true });
    expect(h.m.missionUpdateMany).toHaveBeenCalledWith({
      where: { id: "mi-acceptee", sessionId: SESSION_ID, trainerId: TRAINER_ID },
      data: { lettreMissionId: "doc-neuf" },
    });
  });

  it("console, sans missionId : DEUX missions avec accord → refus, rien n'est émis", async () => {
    base.push({
      ...mission(),
      id: "mi-acceptee-2",
      role: "principal",
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
      solliciteAt: new Date("2026-10-05T08:00:00Z"),
    });
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r.ok).toBe(false);
    expect(h.m.generate).not.toHaveBeenCalled();
  });

  it("console, sans missionId : un accord de CO-FORMATEUR ne reçoit pas la lettre du principal", async () => {
    base[0]!.role = "co_formateur";
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r.ok).toBe(false);
    expect(h.m.generate).not.toHaveBeenCalled();
  });

  it("console, sans missionId : aucune mission avec accord → refus, rien n'est émis", async () => {
    base[0]!.statut = "refusee";
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r.ok).toBe(false);
    expect(h.m.generate).not.toHaveBeenCalled();
  });

  it("le lien ne s'écrit pas (count ≠ 1) : la lettre neuve est annulée, l'ancienne reste vivante", async () => {
    h.m.vivantes.mockResolvedValue([{ id: "doc-ancien", signatures: [] }]);
    h.m.missionUpdateMany.mockResolvedValueOnce({ count: 0 });
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r.ok).toBe(false);
    const annulations = h.m.docUpdateMany.mock.calls.map(
      (c) => (c[0] as { where: { id?: unknown } }).where.id,
    );
    expect(annulations).toContain("doc-neuf");
    expect(annulations).not.toContainEqual({ in: ["doc-ancien"] });
  });
});

describe("lettres d'écartés gardées par le moteur (relecture #1507)", () => {
  it("le générateur n'annule jamais une lettre que l'appelant garde", async () => {
    h.m.vivantes.mockResolvedValue([]);
    const r = await genererLettreMissionV2({
      sessionId: SESSION_ID,
      trainerId: TRAINER_ID,
      lettresAGarder: ["doc-ecarte-garde"],
    });
    expect(r).toMatchObject({ ok: true });
    const ecartes = h.m.docUpdateMany.mock.calls
      .map((c) => (c[0] as { where: Record<string, unknown> }).where)
      .find((w) => "trainerId" in w);
    expect(ecartes).toMatchObject({
      trainerId: { not: TRAINER_ID },
      id: { notIn: ["doc-ecarte-garde"] },
    });
  });
});
