/**
 * Date du CV (décision de Will du 15/10) — au dépôt de son CV dans le dossier en ligne,
 * le formateur indique la DATE DE SON CV (mois et année). La règle « CV de moins de
 * 24 mois » (W-4, contresignature, activation) se calcule sur cette date, plus jamais
 * sur la date de dépôt : V1-A-6 datait le CV du jour de sa transmission, si bien qu'un
 * CV de cinq ans devenait « de moins de 24 mois ».
 *
 * Date absente, dans le futur ou de plus de 24 mois : la pièce reste « à vérifier »
 * (jamais d'acceptation automatique), et W-4 affiche la date déclarée à côté du CV.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ docCreate: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const client = {
    trainer: { updateMany: async () => ({ count: 1 }) },
    trainerDocument: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: (...a: unknown[]) => m.docCreate(...a),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
  };
  return { prisma: client };
});
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
vi.mock("@/server/pieces/depot-controle", () => ({
  alerteAntivirusLimitee: () => ({ alerter: vi.fn() }),
  controlerPiece: async () => ({ ok: true, typeMime: "application/pdf", taille: 4, sha256: "ab" }),
  chiffrerPieceAuRepos: (b: Uint8Array) => Buffer.from(b),
}));

import { deposerPiece } from "../dossier";
import { libelleDateDuCv, lireMoisDuCv, moisAnneeDuCv } from "../date-du-cv";
import { cvProbant } from "../garde-activation-complete";

type Vue = Parameters<typeof deposerPiece>[0];
type Donnees = { dateEmission: Date | null; dateCvDeclaree?: Date | null };

/** Le 1er du mois, `n` mois avant aujourd'hui (minuit UTC). */
function moisAvant(n: number): Date {
  const a = new Date();
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() - n, 1));
}

async function deposer(type: "cv" | "rib", dateEmission: Date | null): Promise<Donnees> {
  m.docCreate.mockResolvedValue({ id: "d1" });
  const r = await deposerPiece({ id: "t1", accesVersion: 1 } as Vue, {
    type,
    nomFichier: `${type}.pdf`,
    octets: new Uint8Array([1, 2, 3, 4]),
    dateEmission,
  });
  expect(r.ok).toBe(true);
  return (m.docCreate.mock.calls.at(-1)![0] as { data: Donnees }).data;
}

/** Le CV tel que la contresignataire le validerait : la règle ne dépend que de sa date. */
function probant(data: Donnees): boolean {
  return cvProbant(
    [
      {
        type: "cv",
        statutValidation: "valide",
        fichierUrl: null,
        contenu: { trainerDocumentId: "d1" },
        dateEmission: data.dateEmission,
        dateExpiration: null,
      },
    ],
    new Date(),
  );
}

beforeEach(() => vi.clearAllMocks());

describe("date du CV — la règle des 24 mois se calcule sur la date déclarée", () => {
  it("CV daté de 30 mois, déposé AUJOURD'HUI : à vérifier (la date de dépôt ne compte pas)", async () => {
    const declaree = moisAvant(30);
    const data = await deposer("cv", declaree);
    expect(data.dateEmission?.toISOString()).toBe(declaree.toISOString());
    expect(data.dateCvDeclaree?.toISOString()).toBe(declaree.toISOString());
    expect(probant(data)).toBe(false);
  });

  it("CV daté de 6 mois : la règle des 24 mois est respectée", async () => {
    const data = await deposer("cv", moisAvant(6));
    expect(data.dateCvDeclaree?.toISOString()).toBe(moisAvant(6).toISOString());
    expect(probant(data)).toBe(true);
  });

  it("date ABSENTE : le CV n'est plus daté du jour du dépôt, il reste à vérifier", async () => {
    const data = await deposer("cv", null);
    expect(data.dateEmission).toBeNull();
    expect(data.dateCvDeclaree ?? null).toBeNull();
    expect(probant(data)).toBe(false);
  });

  it("date dans le FUTUR : à vérifier", async () => {
    expect(probant(await deposer("cv", moisAvant(-1)))).toBe(false);
  });

  it("une autre pièce sans date reste sans date, sans date de CV (INCHANGÉ)", async () => {
    const data = await deposer("rib", null);
    expect(data.dateEmission).toBeNull();
    expect(data).not.toHaveProperty("dateCvDeclaree");
  });
});

describe("date du CV — la saisie « mois et année »", () => {
  it("« 2025-03 » → le 1er mars 2025 à minuit UTC", () => {
    expect(lireMoisDuCv("2025-03")?.toISOString()).toBe("2025-03-01T00:00:00.000Z");
  });

  it("vide ou illisible → aucune date", () => {
    for (const v of ["", "2025", "2025-13", "2025-00", "03/2025", "1899-01", "2025-3"]) {
      expect(lireMoisDuCv(v), v).toBeNull();
    }
  });

  it("le mois et l'année, en clair", () => {
    expect(moisAnneeDuCv(new Date("2025-03-01T00:00:00.000Z"))).toBe("mars 2025");
  });
});

describe("date du CV — ce que la console affiche à côté du CV (W-4)", () => {
  const maintenant = new Date("2026-10-15T09:00:00.000Z");

  it("date déclarée de moins de 24 mois", () => {
    expect(
      libelleDateDuCv(
        { dateCvDeclaree: new Date("2026-04-01T00:00:00.000Z"), dateEmission: null },
        maintenant,
      ),
    ).toBe("Date du CV déclarée par le formateur : avril 2026");
  });

  it("date déclarée de plus de 24 mois, ou dans le futur : signalée", () => {
    const vieux = new Date("2024-04-01T00:00:00.000Z");
    expect(libelleDateDuCv({ dateCvDeclaree: vieux, dateEmission: vieux }, maintenant)).toBe(
      "Date du CV déclarée par le formateur : avril 2024 (plus de 24 mois)",
    );
    const futur = new Date("2026-12-01T00:00:00.000Z");
    expect(libelleDateDuCv({ dateCvDeclaree: futur, dateEmission: futur }, maintenant)).toBe(
      "Date du CV déclarée par le formateur : décembre 2026 (dans le futur)",
    );
  });

  it("CV déjà déposé sans date déclarée : « non déclarée »", () => {
    expect(libelleDateDuCv({ dateCvDeclaree: null, dateEmission: null }, maintenant)).toBe(
      "Date du CV : non déclarée par le formateur",
    );
  });

  it("CV ajouté en console, daté par elle : sa date, sans « déclarée par le formateur »", () => {
    expect(
      libelleDateDuCv(
        { dateCvDeclaree: null, dateEmission: new Date("2026-01-10T00:00:00.000Z") },
        maintenant,
      ),
    ).toBe("Date du CV : janvier 2026");
  });
});
