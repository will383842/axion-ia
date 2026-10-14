// @vitest-environment node

/**
 * Décision du dirigeant (14/10/2026), « comme les apporteurs » : l'autofacture d'un mois
 * de mission n'est établie que quand tout est complet (feuilles contresignées et, pour le
 * dernier mois, bilan de fin de formation remis), et le virement part AU PLUS TARD 30 JOURS
 * APRÈS LA DATE DE CETTE AUTOFACTURE — jamais « dernière journée + 30 ».
 *
 * Contre-calcul en dates (jours civils de Paris) :
 *   - dernière journée 30/10/2026 → ancienne échéance 29/11/2026 ;
 *   - bilan remis tard, autofacture émise le 20/11/2026 → échéance 20/11 + 30 = 20/12/2026.
 * Et en centimes : la pièce porte le total du relevé, ni plus ni moins (144 000 c TTC).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ releves: new Map<string, Record<string, unknown>>() }));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    trainerStatement: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => {
        const r = etat.releves.get(a.where.id);
        if (r === undefined) return null;
        const c = structuredClone(r);
        (c["feeLines"] as Array<Record<string, unknown>>).forEach((l) => {
          const h = l["heures"] as number | null;
          l["heures"] = h === null ? null : { toNumber: () => h };
        });
        return c;
      }),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(
        async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const r = etat.releves.get(String(a.where["id"]));
          if (r === undefined) return { count: 0 };
          if (!Object.entries(a.where).every(([k, v]) => r[k] === v)) return { count: 0 };
          Object.assign(r, a.data);
          return { count: 1 };
        },
      ),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        const r = etat.releves.get(a.where.id) as Record<string, unknown>;
        Object.assign(r, a.data);
        return r;
      }),
    },
    documentGenere: {
      findUnique: vi.fn(async () => ({
        type: "autofacture_honoraires",
        numero: "AXI-DOC-2026-001",
        createdAt: new Date("2026-11-20T00:00:00.000Z"),
      })),
      findMany: vi.fn(async () => []),
    },
    activityLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (travail: (tx: unknown) => Promise<unknown>) =>
      travail({ $queryRaw: async () => [{ acquis: true }] }),
    ),
  };
  return { prisma };
});

vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn(async () => ({ enqueued: true })) }));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn(async () => ({
    id: "doc-1",
    numero: "AXI-DOC-2026-001",
    pdfUrl: null,
    hashSha256: "a".repeat(64),
  })),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({
    raisonSociale: "Axion-IA SAS",
    nda: "84380000000",
    qualiopi: "Q-1",
    siret: "93800000000011",
    adresseSiege: "1 place de la République, 75003 Paris",
    adresseExercice: "1 place de la République",
    email: "contact@axion-ia.test",
    telephone: "0100000000",
    site: "https://axion-ia.test",
    tvaIntracom: "FR11938000000",
  })),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/facture-rectifiee-envoi", () => ({
  envoyerFactureRectifiee: vi.fn(async () => {}),
}));

import { emettreAutofacture, type JournalAutofacture } from "./autofacture-emission";

const ID = "11111111-1111-4111-8111-111111111111";
const journal: JournalAutofacture = async () => {};

function releveMission(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    statut: "valide",
    tvaRegime: "assujetti_20",
    totalTtcCents: 144_000,
    numeroFacture: null,
    autofactureAt: null,
    autofactureDocumentId: null,
    autofactureTransmiseAt: null,
    contestationAvantAt: null,
    contesteeAt: null,
    dateFacture: null,
    periodeYear: 2026,
    periodeMonth: 10,
    trainerId: "22222222-2222-4222-8222-222222222222",
    origine: "passage_mission",
    // Ancienne règle : dernière journée (30/10) + 30 jours.
    echeanceAt: new Date("2026-11-29T12:00:00Z"),
    remplaceId: null,
    session: {
      titreSession: "IA générative",
      dateDebut: new Date("2026-10-29"),
      dateFin: new Date("2026-10-30"),
    },
    trainer: {
      nom: "Roux",
      prenom: "Camille",
      email: "camille@example.test",
      siret: "93812345600017",
      numeroTvaIntracom: "FR55938123456",
      adresseProfessionnelle: "12 rue des Alpes, 69001 Lyon",
      mandatAutofacturationSigneAt: new Date("2026-08-01T00:00:00.000Z"),
      mandatAutofacturationRevoqueAt: null,
    },
    feeLines: [
      {
        prestationType: "formation_collective",
        heures: null,
        montantHtCents: 120_000,
        objet: "animation",
      },
    ],
    ...over,
  };
}

function jourEcrit(): string {
  const d = etat.releves.get(ID)?.["echeanceAt"];
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
}

beforeEach(() => {
  etat.releves.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] });
  // Émise le 20/11/2026 à 11 h, heure de Paris.
  vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("échéance d'une autofacture de mission : 30 jours après SA date", () => {
  it("bilan remis tard → autofacture du 20/11 → virement au plus tard le 20/12 (et non le 29/11)", async () => {
    etat.releves.set(ID, releveMission());
    const r = await emettreAutofacture(ID, journal);
    expect("data" in r).toBe(true);
    expect(jourEcrit()).toBe("2026-12-20");
    // Centimes : la pièce porte le total du relevé (120 000 HT + 24 000 TVA = 144 000).
    expect(etat.releves.get(ID)?.["montantFactureTtcCents"]).toBe(144_000);
  });

  it("toujours la date de la facture + 30, même si l'échéance provisoire du relevé était plus tardive", async () => {
    etat.releves.set(ID, releveMission({ echeanceAt: new Date("2027-01-15T12:00:00Z") }));
    await emettreAutofacture(ID, journal);
    expect(jourEcrit()).toBe("2026-12-20");
  });

  it("facture rectifiée (remplace une pièce annulée par avoir) : garde la date limite d'origine", async () => {
    etat.releves.set(
      ID,
      releveMission({
        remplaceId: "33333333-3333-4333-8333-333333333333",
        echeanceAt: new Date("2026-12-05T12:00:00Z"),
      }),
    );
    await emettreAutofacture(ID, journal);
    expect(jourEcrit()).toBe("2026-12-05");
  });

  it("indemnité d'annulation (art. 11.3, 30 jours après l'annulation) : sa date plus proche est gardée", async () => {
    etat.releves.set(
      ID,
      releveMission({
        echeanceAt: new Date("2026-12-09T12:00:00Z"),
        feeLines: [
          {
            prestationType: "formation_collective",
            heures: null,
            montantHtCents: 120_000,
            objet: "indemnite_annulation",
          },
        ],
      }),
    );
    await emettreAutofacture(ID, journal);
    expect(jourEcrit()).toBe("2026-12-09");
  });

  it("relevé mensuel : la règle d'avant, inchangée (émission + 30 jours)", async () => {
    etat.releves.set(ID, releveMission({ origine: "releve_mensuel", echeanceAt: null }));
    await emettreAutofacture(ID, journal);
    expect(jourEcrit()).toBe("2026-12-20");
  });
});
