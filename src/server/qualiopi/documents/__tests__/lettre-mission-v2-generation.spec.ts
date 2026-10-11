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
    count: vi.fn(async (..._a: unknown[]) => 0),
    docUpdateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
    missionUpdate: vi.fn(async (..._a: unknown[]) => ({})),
    generate: vi.fn(async (..._a: unknown[]) => ({ id: "doc-neuf", numero: "AXI-DOC-2026-0100" })),
  };
  const prisma = {
    trainingSession: { findUnique: (...a: unknown[]) => m.session(...a) },
    trainer: { findUnique: (...a: unknown[]) => m.trainer(...a) },
    missionFormateur: {
      findFirst: (...a: unknown[]) => m.mission(...a),
      update: (...a: unknown[]) => m.missionUpdate(...a),
    },
    documentGenere: {
      findFirst: (...a: unknown[]) => m.contrat(...a),
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

import { genererLettreMissionV2, MOTIF_LETTRE_REMPLACEE } from "../lettre-mission-v2-generation";
import { composantGabarit } from "../signature/exemplaire-signe";
import { gabaritArchive } from "../templates/archives";
import { GABARIT_VERSIONS } from "../templates/gabarit-versions";

const SESSION_ID = "a5a5a5a5-0000-4000-8000-00000000000a";
const TRAINER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function mission(lettre: unknown = null) {
  return {
    id: "mi-1",
    statut: "acceptee",
    reponduAt: new Date("2026-10-12T07:41:00Z"),
    accordHorsOutilAt: null,
    tarifHtCents: null,
    forfaitDeplacementParJourHtCents: null,
    regimeTvaFige: null,
    lettreMissionId: lettre === null ? null : "lettre-1",
    lettreMission: lettre,
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

  it("une seule lettre vivante : l'ancienne NON signée est annulée par le système", async () => {
    h.m.mission.mockResolvedValue(mission({ id: "lettre-1", annuleeAt: null, signatures: [] }));
    const r = await genererLettreMissionV2({ sessionId: SESSION_ID, trainerId: TRAINER_ID });
    expect(r).toMatchObject({ ok: true, lettreAnnuleeId: "lettre-1" });
    expect(h.m.docUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lettre-1", annuleeAt: null },
        data: expect.objectContaining({ annuleeMotif: MOTIF_LETTRE_REMPLACEE }),
      }),
    );
  });

  it("une lettre déjà SIGNÉE n'est jamais annulée en silence : motif exigé", async () => {
    h.m.mission.mockResolvedValue(
      mission({ id: "lettre-1", annuleeAt: null, signatures: [{ id: "sig-1" }] }),
    );
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

  it("une lettre datée v1 se rend avec la v1 archivée ; la courante est la v2", () => {
    expect(GABARIT_VERSIONS.lettre_mission).toBe(2);
    expect(composantGabarit("lettre_mission", 1)).toBe(gabaritArchive("lettre_mission", 1));
    expect(composantGabarit("lettre_mission", 1)).not.toBeNull();
  });

  it("la v1 archivée est mot pour mot l'ancien gabarit courant", () => {
    const lire = (f: string) =>
      readFileSync(join(process.cwd(), "src/server/qualiopi/documents/templates", f), "utf8");
    expect(lire("archives/lettre-mission.v1.tsx")).toBe(lire("lettre-mission.tsx"));
  });
});
