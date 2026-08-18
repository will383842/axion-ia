// Sondage de rattrapage des réservations Calendly.
//
// Ce module n'avait aucun test. Il en a besoin depuis le 2026-08-18, parce que
// c'est LUI qui décide de ce que l'automatisation peut voir : une absence
// déclarée hors de sa fenêtre n'est jamais lue, quelle que soit la qualité de
// `enrich.ts`. Le raisonnement d'origine — « au-delà de 2 h, le rendez-vous a eu
// lieu (ou non) et ce n'est plus l'API qui le dira » — était faux pour la moitié
// qui compte : l'invitee Calendly porte `no_show`, et l'hôte le coche APRÈS.

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { calendlyEvent: { findMany: (...a: unknown[]) => findManyMock(...a) } },
}));

const enrichMock = vi.fn();
vi.mock("../enrich", () => ({
  enrichCalendlyEvent: (...a: unknown[]) => enrichMock(...a),
}));

vi.mock("../api", () => ({
  isCalendlyApiConfigured: () => Boolean(process.env.CALENDLY_API_TOKEN?.trim()),
}));

import { refreshUpcomingCalendlyEvents, MAX_PER_RUN } from "../refresh";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CALENDLY_API_TOKEN = "pat_test";
  enrichMock.mockResolvedValue({ ok: true, updatedFields: [], answersText: null });
});

/** Borne basse de la fenêtre, telle qu'elle part réellement en base. */
function bornePassee(): Date {
  const where = (findManyMock.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
  const clauses = where["OR"] as Array<{ startTime?: { gte?: Date } | null }>;
  const avecBorne = clauses.find((c) => c.startTime?.gte instanceof Date);
  if (!avecBorne?.startTime?.gte) throw new Error("aucune borne de fenêtre trouvée");
  return avecBorne.startTime.gte;
}

describe("refreshUpcomingCalendlyEvents", () => {
  it("sans jeton, ne lit même pas la base", async () => {
    delete process.env.CALENDLY_API_TOKEN;
    const res = await refreshUpcomingCalendlyEvents();
    expect(res).toMatchObject({ ok: true, examined: 0, reason: "not_configured" });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("la fenêtre couvre une absence cochée LE LENDEMAIN du rendez-vous", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await refreshUpcomingCalendlyEvents();

    const heuresDeRecul = (Date.now() - bornePassee().getTime()) / 3_600_000;
    // Un hôte qui fait le point le lendemain matin coche l'absence 12 à 24 h
    // après le créneau. Une fenêtre plus courte ne la voit JAMAIS : la ligne
    // reste « planifié » pour toujours et il faut ressaisir en console.
    expect(heuresDeRecul).toBeGreaterThanOrEqual(24);
  });

  it("ne rappelle Calendly que sur ce qui peut encore changer", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await refreshUpcomingCalendlyEvents();
    const where = (findManyMock.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    // Un rendez-vous annulé, honoré ou déjà constaté absent est figé ; sans URI
    // d'invitee il n'y a rien à demander.
    expect(where["status"]).toBe("scheduled");
    expect(where["inviteeUri"]).toEqual({ not: null });
  });

  it("un dépassement du plafond est SIGNALÉ, jamais tronqué en silence", async () => {
    const trop = Array.from({ length: MAX_PER_RUN + 1 }, (_, i) => ({ id: `evt_${i}` }));
    findManyMock.mockResolvedValueOnce(trop);
    const res = await refreshUpcomingCalendlyEvents();
    expect(res.overflow).toBe(true);
    expect(res.examined).toBe(MAX_PER_RUN);
    expect(enrichMock).toHaveBeenCalledTimes(MAX_PER_RUN);
  });

  it("compte séparément les lignes changées, inchangées et en échec", async () => {
    findManyMock.mockResolvedValueOnce([{ id: "a" }, { id: "b" }, { id: "c" }]);
    enrichMock
      .mockResolvedValueOnce({ ok: true, updatedFields: ["status"], answersText: null })
      .mockResolvedValueOnce({ ok: true, updatedFields: [], answersText: null })
      .mockResolvedValueOnce({ ok: false, reason: "forbidden" });
    const res = await refreshUpcomingCalendlyEvents();
    expect(res).toMatchObject({ ok: true, updated: 1, unchanged: 1, failures: { forbidden: 1 } });
  });
});
