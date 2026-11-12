// Vague 3, chantier 2 (11/11/2026) — « bombe » du 22/04/2027.
//
// `publishedAt` d'une fiche de faits vaut `verifiedAt`, une date ÉCRITE DANS LE CODE
// (`prisma/seeds/content-gen/seed-kb-facts.ts`). Le fait le plus récent porte
// `verifiedAt: "2026-10-24"` : 180 jours plus tard, le 22/04/2027, le garde-fou
// « dernière publication < 180 j » aurait coupé TOUT le content-gen, sans qu'aucune
// fiche ait changé. Le garde-fou se lit désormais aussi sur `updatedAt`, posé par
// l'horloge de la base à chaque écriture de fiche.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { countMock, findFirstMock } = vi.hoisted(() => ({
  countMock: vi.fn<(args: { where: Record<string, unknown> }) => Promise<number>>(),
  findFirstMock:
    vi.fn<
      (args: {
        orderBy: Record<string, string>;
      }) => Promise<{ publishedAt?: Date | null; updatedAt?: Date } | null>
    >(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { knowledgeEntry: { count: countMock, findFirst: findFirstMock } },
}));

import { getKbHealth } from "../kb-health";

const JOUR = 86_400_000;
const VERIFIE_LE = new Date("2026-10-24T00:00:00Z");

function brancher(derniereEcriture: Date): void {
  countMock.mockImplementation(async ({ where }) => ("reviewDueAt" in where ? 0 : 200));
  findFirstMock.mockImplementation(async ({ orderBy }) =>
    "updatedAt" in orderBy ? { updatedAt: derniereEcriture } : { publishedAt: VERIFIE_LE },
  );
}

describe("getKbHealth — le garde-fou de fraîcheur suit l'horloge", () => {
  beforeEach(() => {
    countMock.mockReset();
    findFirstMock.mockReset();
    delete process.env["KB_BYPASS"];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("le 23/04/2027, une base réécrite la veille reste saine malgré un verifiedAt de 180 j", async () => {
    const maintenant = new Date("2027-04-23T12:00:00Z");
    vi.setSystemTime(maintenant);
    brancher(new Date(maintenant.getTime() - JOUR));
    const h = await getKbHealth();
    expect(h.healthy).toBe(true);
    expect(h.reason).toBeUndefined();
  });

  it("une base que personne n'a écrite depuis 181 jours reste bloquée", async () => {
    const maintenant = new Date("2027-04-23T12:00:00Z");
    vi.setSystemTime(maintenant);
    brancher(VERIFIE_LE);
    const h = await getKbHealth();
    expect(h.healthy).toBe(false);
    expect(h.reason).toMatch(/180j/);
  });

  it("le même verdict, quelle que soit la date du jour (aucune date absolue)", async () => {
    for (const decalageJours of [0, 365, 3650]) {
      const maintenant = new Date(Date.UTC(2027, 3, 23) + decalageJours * JOUR);
      vi.setSystemTime(maintenant);
      brancher(new Date(maintenant.getTime() - 10 * JOUR));
      expect((await getKbHealth()).healthy).toBe(true);
    }
  });
});
