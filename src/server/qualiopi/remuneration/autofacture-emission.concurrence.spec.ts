/**
 * 🔴 DEUX ÉMETTEURS, UN SEUL NUMÉRO — la course qui fabrique un doublon légal.
 *
 * Trois chemins émettent une autofacture : le bouton, le déclenchement à la
 * validation du relevé, et le cron horaire de rattrapage. Un relevé validé à
 * hh:49:59 est lu par le cron de hh:50 alors que l'émission lancée à la
 * validation rend encore son PDF : `autofactureAt` est toujours nul, les deux
 * passent l'éligibilité, lisent le même maximum de la série (la colonne
 * `numeroFacture` n'est pas unique) et produisent deux PDF et deux e-mails
 * portant le même numéro AXI-AUTOF.
 *
 * La même course existe entre DEUX relevés différents : deux émissions
 * simultanées lisent le même maximum et s'attribuent le même numéro.
 *
 * La base est simulée avec son état (lectures, écritures, verrou consultatif
 * transactionnel) : c'est l'entrelacement réel des `await` qui est éprouvé, pas
 * un ordre d'appel mocké.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type Releve = Record<string, unknown> & { id: string; numeroFacture: string | null };

const etat = vi.hoisted(() => ({
  releves: new Map<string, Record<string, unknown>>(),
  verrous: new Set<string>(),
}));

vi.mock("@/lib/prisma", () => {
  const copie = <T>(v: T): T => structuredClone(v);
  const prisma = {
    trainerStatement: {
      findUnique: vi.fn(async (a: { where: { id: string } }) => {
        await Promise.resolve();
        const r = etat.releves.get(a.where.id);
        if (r === undefined) return null;
        const c = copie(r);
        // `heures` est un Decimal Prisma : on lui rend sa méthode.
        (c["feeLines"] as Array<Record<string, unknown>>).forEach((l) => {
          const h = l["heures"] as number;
          l["heures"] = { toNumber: () => h };
        });
        return c;
      }),
      findMany: vi.fn(async (a: { where: { numeroFacture: { startsWith: string } } }) => {
        await Promise.resolve();
        return [...etat.releves.values()]
          .filter((r) =>
            String(r["numeroFacture"] ?? "").startsWith(a.where.numeroFacture.startsWith),
          )
          .map((r) => ({ numeroFacture: r["numeroFacture"] }));
      }),
      update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => {
        await Promise.resolve();
        const r = etat.releves.get(a.where.id) as Record<string, unknown>;
        Object.assign(r, a.data);
        return r;
      }),
    },
    documentGenere: {
      findUnique: vi.fn(async () => ({
        type: "autofacture_honoraires",
        numero: "AXI-DOC-2026-001",
        createdAt: new Date("2026-09-15T00:00:00.000Z"),
      })),
      findMany: vi.fn(async () => []),
    },
    activityLog: { create: vi.fn(async () => ({})) },
    // Verrou consultatif TRANSACTIONNEL : tenu jusqu'à la fin du rappel, relâché
    // qu'il réussisse ou lève — comme `pg_try_advisory_xact_lock`.
    $transaction: vi.fn(async (travail: (tx: unknown) => Promise<unknown>) => {
      const tenus: string[] = [];
      const tx = {
        $queryRaw: async (_sql: TemplateStringsArray, ...valeurs: unknown[]) => {
          await Promise.resolve();
          const cle = String(valeurs[0]);
          if (etat.verrous.has(cle)) return [{ acquis: false }];
          etat.verrous.add(cle);
          tenus.push(cle);
          return [{ acquis: true }];
        },
      };
      try {
        return await travail(tx);
      } finally {
        for (const cle of tenus) etat.verrous.delete(cle);
      }
    }),
  };
  return { prisma };
});

vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => ({
    raisonSociale: "Axion-IA SAS",
    nda: "84380000000",
    qualiopi: "Q-1",
    siret: "93800000000011",
    adresseSiege: "1 place Victor Hugo, 38000 Grenoble",
    adresseExercice: "1 place Victor Hugo",
    email: "contact@axion-ia.test",
    telephone: "0400000000",
    site: "https://axion-ia.test",
    tvaIntracom: "FR11938000000",
  })),
}));

import { enqueueEmail } from "@/server/queue/queues";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { emettreAutofacture, type JournalAutofacture } from "./autofacture-emission";

const mockEnqueue = enqueueEmail as unknown as ReturnType<typeof vi.fn>;
const mockGenerate = generateDocument as unknown as ReturnType<typeof vi.fn>;

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "33333333-3333-4333-8333-333333333333";

function releve(id: string): Releve {
  return {
    id,
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
    periodeMonth: 8,
    trainerId: "22222222-2222-4222-8222-222222222222",
    trainer: {
      nom: "Roux",
      prenom: "Camille",
      email: "camille@example.test",
      siret: "93812345600017",
      numeroTvaIntracom: "FR55938123456",
      adresseProfessionnelle: "12 rue des Alpes, 38000 Grenoble",
      mandatAutofacturationSigneAt: new Date("2026-08-01T00:00:00.000Z"),
      mandatAutofacturationRevoqueAt: null,
    },
    feeLines: [{ prestationType: "formation_collective", heures: 14, montantHtCents: 120_000 }],
  };
}

const journal: JournalAutofacture = async () => {};
let pieces = 0;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  etat.releves.clear();
  etat.verrous.clear();
  pieces = 0;
  // Le rendu d'un PDF prend du temps : c'est cette fenêtre que l'autre émetteur
  // traverse.
  mockGenerate.mockImplementation(async () => {
    await new Promise((r) => setTimeout(r, 40));
    pieces += 1;
    return {
      id: `doc-${pieces}`,
      numero: `AXI-DOC-2026-00${pieces}`,
      pdfUrl: null,
      hashSha256: "a".repeat(64),
    };
  });
  mockEnqueue.mockResolvedValue({ enqueued: true });
});

describe("🔴 deux émissions simultanées", () => {
  it("sur le MÊME relevé : une seule pièce, un seul numéro, un seul e-mail", async () => {
    etat.releves.set(ID_A, releve(ID_A));

    const [r1, r2] = await Promise.all([
      emettreAutofacture(ID_A, journal),
      emettreAutofacture(ID_A, journal),
    ]);

    expect(mockGenerate, "deux PDF produits pour le même relevé").toHaveBeenCalledTimes(1);
    expect(mockEnqueue, "deux e-mails envoyés pour le même relevé").toHaveBeenCalledTimes(1);
    const emises = [r1, r2].filter((r) => "data" in r);
    expect(emises).toHaveLength(1);
    const refus = [r1, r2].find((r) => "error" in r);
    expect(refus !== undefined && "error" in refus && refus.error).toMatch(/déjà/i);
  });

  it("sur DEUX relevés : deux numéros DISTINCTS et consécutifs", async () => {
    etat.releves.set(ID_A, releve(ID_A));
    etat.releves.set(ID_B, releve(ID_B));

    await Promise.all([emettreAutofacture(ID_A, journal), emettreAutofacture(ID_B, journal)]);

    const numeros = [ID_A, ID_B].map((id) => etat.releves.get(id)?.["numeroFacture"]).sort();
    expect(numeros[0]).toMatch(/^AXI-AUTOF-\d{4}-001$/);
    expect(numeros[1], "le même numéro a été attribué à deux relevés").toMatch(
      /^AXI-AUTOF-\d{4}-002$/,
    );
  });

  it("🔑 le verrou se relâche quand l'émission échoue : l'essai suivant émet", async () => {
    etat.releves.set(ID_A, releve(ID_A));
    mockGenerate.mockRejectedValueOnce(new Error("rendu indisponible (test)"));

    const echec = await emettreAutofacture(ID_A, journal);
    expect("error" in echec).toBe(true);
    expect(etat.verrous.size).toBe(0);

    const reprise = await emettreAutofacture(ID_A, journal);
    expect("data" in reprise).toBe(true);
  });
});
