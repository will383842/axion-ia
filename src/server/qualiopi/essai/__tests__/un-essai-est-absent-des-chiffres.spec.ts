// @vitest-environment node
/**
 * 🔴 QNC L02 — UNE SESSION D'ESSAI N'EXISTE DANS AUCUN CHIFFRE.
 *
 * La preuve est une INVARIANCE : on calcule chaque statistique sur une base
 * réelle, puis sur la même base augmentée d'une session d'essai complète
 * (inscrit, émargement, évaluation finale, questionnaire, convocation, montant
 * élevé). Le résultat doit être IDENTIQUE.
 *
 * Le témoin positif fait la même chose avec la session marquée RÉELLE : le
 * chiffre doit alors bouger. Sans lui, un calcul aveugle à la session ajoutée
 * (filtre de date, statut…) passerait l'invariance pour une mauvaise raison.
 *
 * Couvre : BPF, getPilotage, voyants de conformité (`evaluerConformite`),
 * indicateurs publiés (`getIndicateurs`) et résultats publics d'une formation.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ligne, Tables } from "./_base-en-memoire";

const etat = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, unknown>[]> }));

vi.mock("@/lib/prisma", async () => {
  const { fauxPrisma: faux } = await import("./_base-en-memoire");
  return { prisma: faux(new Proxy({}, { get: (_c, k: string) => etat.tables[k] })) };
});
vi.mock("@/lib/redis", () => ({
  redis: {
    get: async () => null,
    set: async () => "OK",
    keys: async () => [],
    del: async () => 0,
  },
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: async (cle: string) => (cle === "seuil_presence_pct" ? 80 : ""),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({
    raisonSociale: "Axion-IA SAS",
    nda: "84000000000",
    qualiopi: "",
    siret: "12345678900012",
    adresseSiege: "1 rue de Lyon, 69001 Lyon",
    adresseExercice: "",
    email: "",
    telephone: "",
    site: "",
  }),
}));

import { computeBpf } from "@/server/qualiopi/bpf/service";
import { getIndicateurs } from "@/server/qualiopi/indicateurs/service";
import { getResultatsPublicsFormation } from "@/server/qualiopi/indicateurs/resultats-publics-service";
import { getPilotage } from "@/server/qualiopi/conformite/pilotage-service";
import { evaluerConformite } from "@/server/qualiopi/conformite/conformite-service";

// ─────────────────────────────────────────────────────────────────────────────
// Le jeu : une formation publiée, une session réelle tenue, et — en option —
// une session d'essai tenue, plus « parfaite » que la réelle.
// ─────────────────────────────────────────────────────────────────────────────

const DEBUT = new Date("2026-03-02T08:00:00.000Z");
const FIN = new Date("2026-03-02T16:00:00.000Z");

function session(id: string, estTestInterne: boolean, montantHtCents: number): Ligne {
  return {
    id,
    numero: estTestInterne ? "AXI-SESS-ESSAI-2026-0A0B0C" : "AXI-SESS-2026-001",
    titreSession: "IA générative",
    estTestInterne,
    statut: "realisee",
    dateDebut: DEBUT,
    dateFin: FIN,
    formationId: "f0000000-0000-4000-8000-000000000001",
    dureeReelleHeures: 7,
    nbParticipantsReels: null,
    montantHtCents,
    financementType: "direct",
    interEntreprises: false,
    formateurPrincipalId: null,
    formation: { typesActionQualiopi: ["action_formation"] },
    enrollments: [] as Ligne[],
    documents: [] as Ligne[],
  };
}

function inscription(id: string, s: Ligne, traineeId: string, presence: number): Ligne {
  const e: Ligne = {
    id,
    sessionId: s["id"],
    traineeId,
    statut: "termine",
    estTestInterne: s["estTestInterne"],
    tauxPresencePct: presence,
    createdAt: new Date("2026-02-01T08:00:00.000Z"),
    emargementSigneAt: null,
    adaptationsRealisees: null,
    sortieMotif: null,
    session: s,
    evaluations: [] as Ligne[],
    trainee: { situationHandicap: false },
  };
  (s["enrollments"] as Ligne[]).push(e);
  return e;
}

function base(essai: "aucun" | "essai" | "marque_reel"): Tables {
  const reelle = session("5e000000-0000-4000-8000-000000000001", false, 100_000);
  const eReel = inscription("e0000000-0000-4000-8000-000000000001", reelle, "t1", 60);

  const tables: Tables = {
    trainingSession: [reelle],
    enrollment: [eReel],
    questionnaire: [
      {
        id: "q1",
        type: "satisfaction_chaud",
        reponduAt: FIN,
        noteGlobale: 6,
        enrollmentId: eReel["id"],
        enrollment: eReel,
      },
    ],
    evaluationAcquis: [],
    documentGenere: [],
    formation: [],
  };

  if (essai !== "aucun") {
    const s = session("5e000000-0000-4000-8000-0000000000e1", essai === "essai", 900_000);
    const e = inscription("e0000000-0000-4000-8000-0000000000e1", s, "t2", 100);
    e["emargementSigneAt"] = FIN;
    const evaluation: Ligne = {
      id: "ev1",
      type: "finale",
      niveauGlobal: "acquis",
      dateEvaluation: FIN,
      enrollmentId: e["id"],
      enrollment: e,
    };
    (e["evaluations"] as Ligne[]).push(evaluation);
    const convocation: Ligne = {
      id: "d1",
      type: "convocation",
      numero: "AXI-DOC-ESSAI-2026-0D0D0D",
      annuleeAt: null,
      createdAt: DEBUT,
      sessionId: s["id"],
      session: s,
    };
    (s["documents"] as Ligne[]).push(convocation);
    tables["trainingSession"]!.push(s);
    tables["enrollment"]!.push(e);
    tables["evaluationAcquis"]!.push(evaluation);
    tables["documentGenere"]!.push(convocation);
    tables["questionnaire"]!.push({
      id: "q2",
      type: "satisfaction_chaud",
      reponduAt: FIN,
      noteGlobale: 10,
      enrollmentId: e["id"],
      enrollment: e,
    });
  }

  const formation: Ligne = {
    id: "f0000000-0000-4000-8000-000000000001",
    slug: "ia-generative",
    statut: "actif",
    statutGeneration: "publie",
    indicateursPubliesAt: new Date("2026-01-01T00:00:00.000Z"),
    sessions: tables["trainingSession"],
  };
  tables["formation"] = [formation];
  return tables;
}

/** Retire ce qui dépend de l'horloge. */
function sansHorodatage(v: unknown): unknown {
  return JSON.parse(
    JSON.stringify(v, (cle, val) => (cle === "calculeAt" || cle === "calculeLe" ? undefined : val)),
  );
}

async function mesurer(essai: "aucun" | "essai" | "marque_reel") {
  etat.tables = base(essai);
  return sansHorodatage({
    bpf: await computeBpf(2026),
    indicateurs: await getIndicateurs(2026),
    resultatsPublics: await getResultatsPublicsFormation("ia-generative", FIN),
    pilotage: await getPilotage(2026),
    voyants: (await evaluerConformite()).indicateurs,
  }) as Record<string, unknown>;
}

describe("🔴 QNC L02 — une session d'essai n'existe dans aucun chiffre", () => {
  let reference: Record<string, unknown>;
  let avecEssai: Record<string, unknown>;
  let temoin: Record<string, unknown>;

  beforeEach(async () => {
    process.env["DATABASE_URL"] = "postgresql://essai@localhost:5432/essai";
    reference = await mesurer("aucun");
    avecEssai = await mesurer("essai");
    temoin = await mesurer("marque_reel");
  });

  for (const lecture of ["bpf", "indicateurs", "resultatsPublics", "pilotage", "voyants"]) {
    it(`${lecture} : ajouter une session d'essai ne change RIEN`, () => {
      expect(avecEssai[lecture]).toEqual(reference[lecture]);
    });

    it(`${lecture} : témoin — la même session marquée réelle fait bouger le chiffre`, () => {
      expect(temoin[lecture]).not.toEqual(reference[lecture]);
    });
  }

  it("BPF : ni le chiffre d'affaires ni les stagiaires de l'essai ne sont déclarés", () => {
    const bpf = avecEssai["bpf"] as { nbSessions: number; nbStagiairesDistincts: number };
    expect(bpf.nbSessions).toBe(1);
    expect(bpf.nbStagiairesDistincts).toBe(1);
  });
});
