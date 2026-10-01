/**
 * Lot L4 (2026-09-30) — la liste des sessions par phase.
 *
 * Le faux Prisma rend de VRAIES lignes de session (inscriptions, attestations,
 * jetons) : c'est `chargerEtatsVerrou` — la règle unique de l'ADR 0060 — qui
 * décide de l'état, pas le test. Un mock qui rendrait directement « clos »
 * prouverait seulement qu'on sait recopier une constante.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    trainingSession: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    sessionDossierEvenement: { findMany: vi.fn() },
    enrollment: { groupBy: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  LIBELLE_PHASE,
  ONGLETS_PHASE,
  parsePhaseParam,
  phasesDesLignes,
  restrictionDeLaPhase,
  statutsDeLaPhase,
} from "../sessions-par-phase";
import { listSessionsForAdmin } from "@/server/qualiopi/presence/queries";

const MAINTENANT = new Date("2026-09-30T10:00:00.000Z");
const HIER = new Date("2026-09-29T10:00:00.000Z");
const IL_Y_A_UN_MOIS = new Date("2026-08-30T10:00:00.000Z");

type Genre = "clos" | "a_recueillir" | "rouvert";

/** Une session `realisee` dont l'état se DÉDUIT de ses pièces. */
function ligne(id: string, genre: Genre) {
  return {
    id,
    statut: "realisee",
    transitions: [{ createdAt: IL_Y_A_UN_MOIS }],
    enrollments: [
      {
        id: `${id}-e1`,
        statut: "presente",
        sortieAt: null,
        trainee: { prenom: "Ada", nom: "Lovelace" },
        // a_recueillir : l'attestation manque.
        attestationDocument:
          genre === "a_recueillir"
            ? null
            : { type: "attestation", annuleeAt: null, createdAt: IL_Y_A_UN_MOIS },
        emargementTokens: [{ expiresAt: IL_Y_A_UN_MOIS, revokedAt: null }],
        emargementSignatures: [],
      },
    ],
  };
}

function installer(genres: Record<string, Genre>) {
  const lignes = Object.entries(genres).map(([id, g]) => ligne(id, g));
  prismaMock.trainingSession.findMany.mockImplementation(
    async (args: { select?: Record<string, unknown> }) => {
      // Préfiltre SQL (liste des identifiants) ou lecture des états du verrou.
      if (args.select && Object.keys(args.select).length === 1) {
        return lignes.map((l) => ({ id: l.id }));
      }
      return lignes;
    },
  );
  prismaMock.sessionDossierEvenement.findMany.mockResolvedValue(
    Object.entries(genres)
      .filter(([, g]) => g === "rouvert")
      .map(([id]) => ({
        sessionId: id,
        type: "reouverture",
        createdAt: HIER,
        auteurNom: "Williams Jullin",
        motif: "Attestation à rectifier (nom mal orthographié)",
      })),
  );
}

function appelsPrisma(): number {
  return (
    prismaMock.trainingSession.findMany.mock.calls.length +
    prismaMock.sessionDossierEvenement.findMany.mock.calls.length
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parsePhaseParam / statutsDeLaPhase", () => {
  it("lit les cinq onglets et ignore le reste (« toutes »)", () => {
    expect(parsePhaseParam("cloturee")).toBe("cloturee");
    expect(parsePhaseParam("hors_parcours")).toBe("hors_parcours");
    expect(parsePhaseParam("n_importe_quoi")).toBeNull();
    expect(parsePhaseParam(["apres", "cloturee"])).toBeNull();
    expect(parsePhaseParam(undefined)).toBeNull();
  });

  it("préfiltre SQL exact : seul `realisee` se partage entre Après et Clôturées", () => {
    expect(statutsDeLaPhase("preparer")).toEqual(["planifiee"]);
    expect(statutsDeLaPhase("jour_j")).toEqual(["en_cours"]);
    expect(statutsDeLaPhase("apres")).toEqual(["realisee"]);
    expect(statutsDeLaPhase("cloturee")).toEqual(["realisee"]);
    expect(statutsDeLaPhase("hors_parcours")).toEqual(["annulee", "reportee"]);
  });
});

describe("libellé de l'onglet hors parcours (revue L4)", () => {
  it("l'onglet dit « Annulées ou reportées », comme la ligne : il liste les deux statuts", () => {
    const onglet = ONGLETS_PHASE.find((o) => o.phase === "hors_parcours");
    expect(onglet?.libelle).toBe("Annulées ou reportées");
    expect(statutsDeLaPhase("hors_parcours")).toContain("reportee");
    expect(LIBELLE_PHASE.hors_parcours).toBe("Annulée ou reportée");
  });
});

describe("restrictionDeLaPhase — ce que listent « Après » et « Clôturées »", () => {
  const genres: Record<string, Genre> = { a: "clos", b: "a_recueillir", c: "rouvert", d: "clos" };

  it("?phase=cloturee ne liste QUE les dossiers clos", async () => {
    installer(genres);
    const r = await restrictionDeLaPhase("cloturee", {}, MAINTENANT);
    expect(r.ids?.sort()).toEqual(["a", "d"]);
    expect(r.lectureEchouee).toBe(false);
  });

  it("?phase=apres ne liste QUE les dossiers à recueillir ou rouverts", async () => {
    installer(genres);
    const r = await restrictionDeLaPhase("apres", {}, MAINTENANT);
    expect(r.ids?.sort()).toEqual(["b", "c"]);
    expect(r.etats.get("c")?.etat.etat).toBe("rouvert");
    expect(r.etats.get("b")?.etat.etat).toBe("a_recueillir");
  });

  it("n'interroge pas le verrou pour une phase que le statut suffit à trancher", async () => {
    const r = await restrictionDeLaPhase("preparer", {}, MAINTENANT);
    expect(r.ids).toBeNull();
    expect(r.statuts).toEqual(["planifiee"]);
    expect(appelsPrisma()).toBe(0);
  });

  it("🔴 pas de N+1 : même nombre d'appels à Prisma pour 3 ou 60 sessions", async () => {
    installer({ a: "clos", b: "a_recueillir", c: "rouvert" });
    await restrictionDeLaPhase("cloturee", {}, MAINTENANT);
    const pour3 = appelsPrisma();

    vi.clearAllMocks();
    const beaucoup: Record<string, Genre> = {};
    for (let i = 0; i < 60; i++) beaucoup[`s${i}`] = i % 3 === 0 ? "clos" : "a_recueillir";
    installer(beaucoup);
    await restrictionDeLaPhase("cloturee", {}, MAINTENANT);
    const pour60 = appelsPrisma();

    expect(pour3).toBe(pour60);
    // Préfiltre des identifiants + lecture groupée des sessions + événements.
    expect(pour60).toBe(3);
  });

  it("fail-soft : une lecture en échec rend une liste VIDE, jamais un « clos » inventé", async () => {
    prismaMock.trainingSession.findMany.mockRejectedValue(new Error("base indisponible"));
    const r = await restrictionDeLaPhase("cloturee", {}, MAINTENANT);
    expect(r.ids).toEqual([]);
    expect(r.lectureEchouee).toBe(true);
  });
});

describe("phasesDesLignes — la phase de chaque ligne affichée", () => {
  it("réutilise les états déjà lus et ne relit QUE les lignes manquantes, en un appel", async () => {
    installer({ a: "clos", b: "a_recueillir" });
    const deja = (await restrictionDeLaPhase("cloturee", {}, MAINTENANT)).etats;
    vi.clearAllMocks();
    installer({ z: "rouvert" });
    const phases = await phasesDesLignes(["a", "b", "z"], deja, MAINTENANT);
    expect(phases.get("a")).toBe("cloturee");
    expect(phases.get("b")).toBe("apres");
    expect(phases.get("z")).toBe("apres");
    // Une lecture groupée (sessions + événements) pour la seule ligne manquante.
    expect(appelsPrisma()).toBe(2);
  });
});

describe("listSessionsForAdmin — restriction d'onglet", () => {
  it("restreint les lignes et le total, jamais les compteurs de la fenêtre", async () => {
    prismaMock.trainingSession.count.mockResolvedValue(1);
    prismaMock.trainingSession.groupBy.mockResolvedValue([
      { statut: "realisee", _count: { _all: 4 } },
      { statut: "planifiee", _count: { _all: 2 } },
    ]);
    prismaMock.trainingSession.findMany.mockResolvedValue([]);
    prismaMock.enrollment.groupBy.mockResolvedValue([]);

    const liste = await listSessionsForAdmin({
      maintenant: MAINTENANT,
      restriction: { statuts: ["realisee"], ids: ["a", "d"] },
    });

    const whereCount = prismaMock.trainingSession.count.mock.calls[0]?.[0]?.where;
    expect(whereCount.statut).toEqual({ in: ["realisee"] });
    expect(whereCount.id).toEqual({ in: ["a", "d"] });
    const whereLignes = prismaMock.trainingSession.findMany.mock.calls[0]?.[0]?.where;
    expect(whereLignes.id).toEqual({ in: ["a", "d"] });
    // Les compteurs « En cours / Planifiées / Réalisées » restent ceux de la fenêtre.
    const whereCompteurs = prismaMock.trainingSession.groupBy.mock.calls[0]?.[0]?.where;
    expect(whereCompteurs.id).toBeUndefined();
    expect(whereCompteurs.statut).toBeUndefined();
    expect(liste.totalFenetre).toBe(6);
    expect(liste.total).toBe(1);
  });
});
