import { describe, it, expect } from "vitest";
import {
  ingestAnnuaireSante,
  type AnnuaireSanteSource,
  type AnnuaireSanteDb,
  type AnnuaireSanteRow,
} from "./annuaire-sante-ingestor";

function source(rows: AnnuaireSanteRow[]): AnnuaireSanteSource {
  return {
    async *iteratePractitioners() {
      yield* rows;
    },
  };
}

function makeDb() {
  const practitioners = new Map<string, unknown>();
  const companies = new Map<string, { id: string }>([["380000001", { id: "co-1" }]]);
  const db = {
    prospectionHealthPractitioner: {
      async upsert(a: { where: { rpps: string }; create: unknown }) {
        practitioners.set(a.where.rpps, a.create);
        return {};
      },
    },
    prospectionCompany: {
      async findUnique(a: { where: { siren: string } }) {
        return companies.get(a.where.siren) ?? null;
      },
    },
  } as unknown as AnnuaireSanteDb;
  return { db, practitioners };
}

const ROWS: AnnuaireSanteRow[] = [
  {
    rpps: "10001234567",
    nom: "MARTIN",
    prenom: "Claire",
    profession: "Médecin",
    savoirFaire: "Cardiologie et maladies vasculaires",
    siret: "38000000100011",
    codePostal: "38000",
    commune: "GRENOBLE",
  },
  {
    rpps: "10007654321",
    nom: "DURAND",
    prenom: "Paul",
    profession: "Médecin",
    savoirFaire: "Ophtalmologie",
    siret: "99999999900011", // société inconnue → non reliée
    codePostal: "38100",
  },
  { rpps: "", nom: "SANS RPPS", savoirFaire: "Dermatologie" }, // sans RPPS → sauté
];

describe("ingestAnnuaireSante (V2 fixtures)", () => {
  it("normalise la spécialité, relie au SIREN, upsert par RPPS, renseigne retentionUntil", async () => {
    const { db, practitioners } = makeDb();
    const now = new Date("2026-07-04T00:00:00Z");
    const s = await ingestAnnuaireSante(source(ROWS), db, { now: () => now, retentionYears: 3 });

    expect(s.seen).toBe(3);
    expect(s.upserted).toBe(2);
    expect(s.skippedNoRpps).toBe(1);
    expect(s.linkedToCompany).toBe(1); // seul le SIRET 380000001... matche co-1

    const cardio = practitioners.get("10001234567") as {
      specialite: string;
      departement: string;
      company?: unknown;
      retentionUntil: Date;
    };
    expect(cardio.specialite).toBe("cardiologie");
    expect(cardio.departement).toBe("38");
    expect(cardio.company).toBeDefined(); // relié
    expect(cardio.retentionUntil.getUTCFullYear()).toBe(2029);

    const ophta = practitioners.get("10007654321") as { specialite: string; company?: unknown };
    expect(ophta.specialite).toBe("ophtalmologie");
    expect(ophta.company).toBeUndefined(); // SIREN inconnu → non relié
  });

  it("ré-ingérer = idempotent (dédup par RPPS, aucun doublon)", async () => {
    const { db, practitioners } = makeDb();
    await ingestAnnuaireSante(source(ROWS), db);
    await ingestAnnuaireSante(source(ROWS), db);
    expect(practitioners.size).toBe(2);
  });
});
