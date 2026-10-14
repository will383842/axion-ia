/**
 * Étape 3 (C4) — aux PORTES : la garde de mission lit le montant de la mission en jeu
 * (calcul de la lettre) et l'ajoute au cumul ; la lettre ne part pas sans attestation
 * quand le montant qu'elle annonce fait atteindre le seuil.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const etat = {
    settings: new Map<string, unknown>(),
    trainer: null as Record<string, unknown> | null,
    releves: [] as unknown[],
    session: null as Record<string, unknown> | null,
    missions: [] as unknown[],
    choix: null as Record<string, unknown> | null,
  };
  const prisma = {
    setting: {
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
        etat.settings.has(where.key) ? { value: etat.settings.get(where.key) } : null,
      ),
    },
    trainer: { findUnique: vi.fn(async () => etat.trainer) },
    documentGenere: {
      findFirst: vi.fn(async () => ({
        metadata: { renderData: { gabaritVersion: 3 } },
        signatures: [{ signeAt: new Date("2026-09-01T10:00:00Z") }],
      })),
    },
    trainerStatement: { findMany: vi.fn(async () => etat.releves) },
    trainingSession: { findUnique: vi.fn(async () => etat.session) },
    missionFormateur: { findMany: vi.fn(async () => etat.missions) },
    choixFormateurSession: { findUnique: vi.fn(async () => etat.choix) },
  };
  return { etat, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));

import { MANQUES_MISSION } from "../garde-mission";
import { controlerGardeMission, controlerVigilanceLettre } from "../garde-mission-portes";

const MAINTENANT = new Date("2026-10-14T10:00:00Z");
const releve = (totalHtCents: number) => ({
  trainerId: "t-1",
  statut: "paye",
  totalHtCents,
  avoirDe: null,
  feeLines: [],
});
const jour = (date: string) => ({
  date: new Date(`${date}T00:00:00.000Z`),
  heureDebut: "09:00",
  heureFin: "17:00",
  trainerId: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.settings.clear();
  h.etat.settings.set("formateurs.garde_mission_portes", { actif: true });
  h.etat.trainer = {
    statut: "sous_traitant",
    actif: true,
    sousTraitantVerifieAt: new Date("2026-10-01T10:00:00Z"),
    sousTraitantNda: "84380000000",
    sousTraitantContratSigneAt: new Date("2026-09-01T10:00:00Z"),
    finCollaborationAt: null,
    activationValideeSource: "controle",
    tarifJourneeHtCents: 35_000,
    documents: [],
  };
  // 4 000 € HT déjà payés : sous le seuil, à l'approche.
  h.etat.releves = [releve(400_000)];
  h.etat.session = {
    lieuType: "distanciel",
    dateDebut: new Date("2026-11-02T08:00:00Z"),
    dateFin: new Date("2026-11-05T16:00:00Z"),
    jours: [jour("2026-11-02"), jour("2026-11-03"), jour("2026-11-04"), jour("2026-11-05")],
    sessionFormateurs: [],
  };
  h.etat.missions = [];
  h.etat.choix = null;
});

describe("controlerGardeMission avec la mission en jeu", () => {
  it("sans mission en jeu : le cumul seul (4 000 €), rien n'est exigé — comme avant", async () => {
    const r = await controlerGardeMission("t-1", MAINTENANT);
    expect(r.refus).toEqual([]);
    expect(h.prisma.trainingSession.findUnique).not.toHaveBeenCalled();
  });

  it("4 000 € + 4 journées à 350 € (1 400 €) : refusée AVANT la mission", async () => {
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });

  it("conditions figées sur la mission désignée : elles priment (2 × 300 € → 4 600 €, passe)", async () => {
    h.etat.session = { ...h.etat.session!, jours: [jour("2026-11-02"), jour("2026-11-03")] };
    h.etat.missions = [{ tarifHtCents: 30_000, forfaitDeplacementParJourHtCents: null }];
    const r = await controlerGardeMission("t-1", MAINTENANT, {
      sessionId: "s-1",
      missionId: "m-1",
    });
    expect(r.refus).toEqual([]);
  });

  it("session pas encore créée : la période, sur-estimée (4 jours × 350 €)", async () => {
    const r = await controlerGardeMission("t-1", MAINTENANT, {
      nouvelleSession: {
        debut: new Date("2026-11-02T08:00:00Z"),
        fin: new Date("2026-11-05T16:00:00Z"),
        distanciel: true,
      },
    });
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });

  it("session illisible : refusée (garde fermée)", async () => {
    h.etat.session = null;
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });

  it("portes coupées : rien n'est lu, rien n'est refusé", async () => {
    h.etat.settings.clear();
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    expect(r).toEqual({ mode: "coupee", refus: [], avertissements: [] });
  });
});

describe("controlerVigilanceLettre — à l'émission de la lettre", () => {
  it("4 000 € + une lettre de 1 400 € sans attestation : refusée", async () => {
    const r = await controlerVigilanceLettre("t-1", 140_000, MAINTENANT);
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });

  it("4 000 € + 700 € : la lettre part", async () => {
    expect((await controlerVigilanceLettre("t-1", 70_000, MAINTENANT)).refus).toEqual([]);
  });

  it("avec une attestation valable : la lettre part", async () => {
    h.etat.trainer = {
      ...h.etat.trainer!,
      documents: [
        {
          type: "attestation_vigilance_urssaf",
          statutValidation: "valide",
          fichierUrl: "r2://a",
          dateEmission: new Date("2026-09-01T00:00:00Z"),
          dateExpiration: null,
        },
      ],
    };
    expect((await controlerVigilanceLettre("t-1", 140_000, MAINTENANT)).refus).toEqual([]);
  });

  it("ancien stock en « avertir » : averti, jamais bloqué", async () => {
    h.etat.settings.set("formateurs.garde_mission", { valeur: "avertir" });
    h.etat.trainer = { ...h.etat.trainer!, activationValideeSource: "anterieure_au_controle" };
    const r = await controlerVigilanceLettre("t-1", 140_000, MAINTENANT);
    expect(r).toMatchObject({ mode: "avertir", refus: [] });
    expect(r.avertissements).toEqual([MANQUES_MISSION.vigilanceMission]);
  });
});

describe("les portes passent la mission en jeu", () => {
  it("affectation, proposition, acceptation, accord, choix, moteur, report, lettre", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
    const attendus: Array<[string, RegExp]> = [
      [
        "src/server/actions/qualiopi/sessions.ts",
        /controlerGardeMission\(v\.trainerId, new Date\(\), \{\s*nouvelleSession/,
      ],
      [
        "src/server/actions/qualiopi/trainers.ts",
        /controlerGardeMission\(trainerId, new Date\(\), \{ sessionId \}\)/,
      ],
      [
        "src/server/actions/qualiopi/mission-formateur.ts",
        /controlerGardeMission\(trainerId, new Date\(\), \{ sessionId \}\)/,
      ],
      [
        "src/server/qualiopi/formateurs-independants/choix-formateur-service.ts",
        /controlerGardeMission\(c\.trainerId, maintenant, \{ sessionId \}\)/,
      ],
      ["src/server/qualiopi/formateurs-independants/moteur-mission.ts", /missionId: m\.id/],
      [
        "src/server/qualiopi/formateurs-independants/evaluer-affectation.ts",
        /sessionId: session\.id/,
      ],
      [
        "src/server/qualiopi/documents/lettre-mission-v2-generation.ts",
        /controlerVigilanceLettre\(/,
      ],
    ];
    for (const [f, motif] of attendus) expect(lire(f), f).toMatch(motif);
    const service = lire("src/server/qualiopi/trainers/mission-formateur.ts");
    expect(
      service.match(/controlerGardeMission\([\w.]+, (?:now|new Date\(\)), \{\s*sessionId/g)?.length,
    ).toBe(3);
    const report = lire("src/server/actions/qualiopi/sessions-recurrentes.ts");
    expect(report.match(/sessionId: ancienne\.id/g)?.length).toBe(2);
  });
});
