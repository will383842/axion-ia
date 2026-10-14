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
    /** Autres missions OUVERTES du formateur (`{ id, sessionId }`). */
    autres: [] as Array<{ id: string; sessionId: string }>,
    /** Sessions par id, quand une autre que `session` est lue. */
    sessions: new Map<string, Record<string, unknown>>(),
    /** Lignes déjà facturées (`{ sessionId, montantHtCents }`). */
    facture: [] as Array<{ sessionId: string; montantHtCents: number }>,
    dureeHeures: 21,
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
    trainingSession: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) => etat.sessions.get(where.id) ?? etat.session,
      ),
    },
    missionFormateur: {
      // Les conditions figées d'UNE session (sessionId donné) ; sinon, les autres
      // missions ouvertes du formateur.
      findMany: vi.fn(async ({ where }: { where: { sessionId?: unknown } }) =>
        typeof where.sessionId === "string" ? etat.missions : etat.autres,
      ),
    },
    trainerFeeLine: {
      findMany: vi.fn(async ({ where }: { where: { sessionId: { in: string[] } } }) =>
        etat.facture.filter((l) => where.sessionId.in.includes(l.sessionId)),
      ),
    },
    formation: { findUnique: vi.fn(async () => ({ dureeHeures: etat.dureeHeures })) },
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
  h.etat.autres = [];
  h.etat.sessions.clear();
  h.etat.facture = [];
  h.etat.dureeHeures = 21;
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
        formationId: null,
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

describe("relecture de l'étape 3 — l'engagement entier, jamais compté deux fois", () => {
  const autreSession = (jours: number) => ({
    lieuType: "distanciel",
    dateDebut: new Date("2026-12-01T08:00:00Z"),
    dateFin: new Date("2026-12-10T16:00:00Z"),
    jours: Array.from({ length: jours }, (_, i) => jour(`2026-12-0${i + 1}`)),
    sessionFormateurs: [{ trainerId: "t-1" }],
  });

  it("B2 — une autre mission acceptée non facturée s'ajoute : 4 000 + 700 + 700 = 5 400 € → refus", async () => {
    h.etat.session = { ...h.etat.session!, jours: [jour("2026-11-02"), jour("2026-11-03")] };
    h.etat.autres = [{ id: "m-autre", sessionId: "s-2" }];
    h.etat.sessions.set("s-2", autreSession(2));
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });

  it("une autre mission DÉJÀ facturée ne compte pas deux fois : 4 000 + 700 + (700 − 700) → passe", async () => {
    h.etat.session = { ...h.etat.session!, jours: [jour("2026-11-02"), jour("2026-11-03")] };
    h.etat.autres = [{ id: "m-autre", sessionId: "s-2" }];
    h.etat.sessions.set("s-2", autreSession(2));
    h.etat.facture = [{ sessionId: "s-2", montantHtCents: 70_000 }];
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    expect(r.refus).toEqual([]);
  });

  it("la mission en jeu, déjà facturée en partie, n'ajoute que le reste : 4 000 + (1 400 − 700) → passe", async () => {
    h.etat.facture = [{ sessionId: "s-1", montantHtCents: 70_000 }];
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    expect(r.refus).toEqual([]);
  });

  it("création : les journées tirées de la durée (21 h = 3 j) priment sur une période plus courte", async () => {
    h.etat.releves = [releve(380_000)];
    // Période d'un jour (350 €) → 4 150 € ; journées de la durée : 3 × 350 € → 4 850 €.
    // Avec 28 h (4 j) : 5 200 € → refus.
    h.etat.dureeHeures = 28;
    const r = await controlerGardeMission("t-1", MAINTENANT, {
      nouvelleSession: {
        formationId: "f-1",
        debut: new Date("2026-11-02T08:00:00Z"),
        fin: new Date("2026-11-02T16:00:00Z"),
        distanciel: true,
      },
    });
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });

  it("les missions restées ouvertes d'une session annulée ou reportée ne comptent pas", async () => {
    await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    const autres = h.prisma.missionFormateur.findMany.mock.calls
      .map(([a]) => a as { where: { sessionId?: unknown; session?: unknown } })
      .find((a) => typeof a.where.sessionId !== "string");
    expect(autres?.where.session).toMatchObject({
      statut: { notIn: ["annulee", "reportee"] },
    });
  });

  it("seuls les HONORAIRES de la mission se déduisent (ni indemnité, ni pénalité, ni présentation)", async () => {
    await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    const [arg] = h.prisma.trainerFeeLine.findMany.mock.calls[0] as unknown as [
      { where: Record<string, unknown> },
    ];
    expect(arg.where).toMatchObject({
      nature: "honoraire_du",
      OR: [{ objet: null }, { objet: { in: ["animation", "deplacement"] } }],
    });
    expect(arg.where).not.toHaveProperty("montantHtCents");
  });

  it("un avoir sur une autre mission se déduit du déjà-facturé : 4 000 + 700 + (700 − 0) → refus", async () => {
    h.etat.session = { ...h.etat.session!, jours: [jour("2026-11-02"), jour("2026-11-03")] };
    h.etat.autres = [{ id: "m-autre", sessionId: "s-2" }];
    h.etat.sessions.set("s-2", autreSession(2));
    h.etat.facture = [
      { sessionId: "s-2", montantHtCents: 70_000 },
      { sessionId: "s-2", montantHtCents: -70_000 },
    ];
    const r = await controlerGardeMission("t-1", MAINTENANT, { sessionId: "s-1" });
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });

  it("report : la mission de la session reportée n'est pas comptée en plus de celle du report", async () => {
    await controlerGardeMission("t-1", MAINTENANT, {
      nouvelleSession: {
        formationId: null,
        debut: new Date("2026-11-02T08:00:00Z"),
        fin: new Date("2026-11-02T16:00:00Z"),
        distanciel: true,
        remplaceSessionId: "s-ancienne",
      },
    });
    const autres = h.prisma.missionFormateur.findMany.mock.calls
      .map(([a]) => a as { where: { sessionId?: unknown } })
      .find((a) => typeof a.where.sessionId !== "string");
    expect(autres?.where.sessionId).toEqual({ not: "s-ancienne" });
  });

  it("une autre mission illisible : refus (garde fermée)", async () => {
    h.etat.autres = [{ id: "m-autre", sessionId: "s-2" }];
    h.etat.session = null;
    const r = await controlerGardeMission("t-1", MAINTENANT, {
      nouvelleSession: {
        formationId: null,
        debut: new Date("2026-11-02T08:00:00Z"),
        fin: new Date("2026-11-02T16:00:00Z"),
        distanciel: true,
      },
    });
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });
});

describe("controlerVigilanceLettre — à l'émission de la lettre", () => {
  it("4 000 € + une lettre de 1 400 € sans attestation : refusée", async () => {
    const r = await controlerVigilanceLettre(
      "t-1",
      { sessionId: "s-1", montantHtCents: 140_000 },
      MAINTENANT,
    );
    expect(r.refus).toEqual([MANQUES_MISSION.vigilanceMission]);
  });

  it("4 000 € + 700 € : la lettre part", async () => {
    expect(
      (
        await controlerVigilanceLettre(
          "t-1",
          { sessionId: "s-1", montantHtCents: 70_000 },
          MAINTENANT,
        )
      ).refus,
    ).toEqual([]);
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
    expect(
      (
        await controlerVigilanceLettre(
          "t-1",
          { sessionId: "s-1", montantHtCents: 140_000 },
          MAINTENANT,
        )
      ).refus,
    ).toEqual([]);
  });

  it("ancien stock en « avertir » : averti, jamais bloqué", async () => {
    h.etat.settings.set("formateurs.garde_mission", { valeur: "avertir" });
    h.etat.trainer = { ...h.etat.trainer!, activationValideeSource: "anterieure_au_controle" };
    const r = await controlerVigilanceLettre(
      "t-1",
      { sessionId: "s-1", montantHtCents: 140_000 },
      MAINTENANT,
    );
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
    expect(report).toMatch(/const missionDuReport: MissionEnJeu = \{\s*nouvelleSession/);
    expect(report.match(/controlerGardeMission\([^\n]*(enJeu|missionDuReport)\)/g)?.length).toBe(2);
  });
});
