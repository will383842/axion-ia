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
    generate: vi.fn(async (..._a: unknown[]) => ({ id: "doc-neuf", numero: "AXI-DOC-2026-0100" })),
  };
  const prisma = {
    trainingSession: { findUnique: (...a: unknown[]) => m.session(...a) },
    trainer: { findUnique: (...a: unknown[]) => m.trainer(...a) },
    sessionFormateur: { findUnique: (...a: unknown[]) => m.affectation(...a) },
    missionFormateur: {
      findFirst: (...a: unknown[]) => m.mission(...a),
      update: (...a: unknown[]) => m.missionUpdate(...a),
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
    tarifHtCents: null,
    forfaitDeplacementParJourHtCents: null,
    regimeTvaFige: null,
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
    jours: [{ date: new Date("2026-11-04T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" }],
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
  it("datée v2, liée à la mission, jamais un duplicata", async () => {
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toMatchObject({ ok: true, documentId: "doc-neuf", lettreAnnuleeId: null });
    const entree = h.m.generate.mock.calls[0]?.[0] as unknown as {
      gabaritVersion: number;
      estCopie: boolean;
    };
    expect(entree.gabaritVersion).toBe(2);
    expect(entree.estCopie).toBe(false);
    expect(h.m.missionUpdate).toHaveBeenCalledWith({
      where: { id: "mi-1" },
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

  it("tarif : celui figé à l'affectation quand la mission n'en porte pas", async () => {
    h.m.affectation.mockResolvedValue({ tarifHtCents: 40_000 });
    await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    const entree = h.m.generate.mock.calls[0]?.[0] as unknown as {
      buildElement: (n: string) => { props: { data: { totalHtCents: number } } };
    };
    expect(entree.buildElement("N").props.data.totalHtCents).toBe(40_000);
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

  it("la v1 reste la version émise par défaut ; la v2 est une version arrêtée", () => {
    expect(GABARIT_VERSIONS.lettre_mission).toBe(1);
    expect(composantGabarit("lettre_mission", 1)).toBe(LettreMissionPdf);
    expect(composantGabarit("lettre_mission", 2)).toBe(LettreMissionV2Pdf);
  });
});
