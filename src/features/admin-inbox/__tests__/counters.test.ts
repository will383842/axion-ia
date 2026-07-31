// Compteurs des badges « à traiter » (2026-07-29).
//
// LE RISQUE QUE CES TESTS COUVRENT, et un seul :
//
// Les badges sont calculés en SQL (`counters.ts`, quatre `count()`), tandis que
// la liste applique ses critères en TypeScript (`queries.ts`, `needsAction`).
// Deux implémentations pour une seule règle métier — donc deux vérités qui
// peuvent diverger sans que rien ne le signale. Un badge annonçant 3 devant une
// liste qui en montre 5 est pire que pas de badge : il apprend à se méfier du
// chiffre, et le compteur devient décoratif.
//
// Le premier jet divergeait déjà : le compteur Messages réutilisait
// `needsAttention: true` (critère du badge « contacts sans réponse »
// préexistant) alors que la liste retient `replyCount === 0 && status ∉
// {processed, archived}`. Proche, mais pas identique — un message dont on avait
// levé l'attention sans y répondre comptait d'un côté et pas de l'autre.

import { describe, it, expect, vi, beforeEach } from "vitest";

const countMocks = {
  submission: vi.fn(),
  calendlyEvent: vi.fn(),
  jobApplication: vi.fn(),
  podcastRequest: vi.fn(),
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { count: (...a: unknown[]) => countMocks.submission(...a) },
    calendlyEvent: { count: (...a: unknown[]) => countMocks.calendlyEvent(...a) },
    jobApplication: { count: (...a: unknown[]) => countMocks.jobApplication(...a) },
    podcastRequest: { count: (...a: unknown[]) => countMocks.podcastRequest(...a) },
  },
}));
// `unstable_cache` est transparent en test : on veut mesurer le calcul, pas Next.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

import { getInboxActionCounts, INBOX_COUNTS_TAG, EMPTY_INBOX_COUNTS } from "../counters";

beforeEach(() => {
  vi.clearAllMocks();
  countMocks.submission.mockResolvedValue(2);
  countMocks.calendlyEvent.mockResolvedValue(3);
  countMocks.jobApplication.mockResolvedValue(1);
  countMocks.podcastRequest.mockResolvedValue(0);
});

describe("getInboxActionCounts", () => {
  it("renvoie un compteur par canal", async () => {
    expect(await getInboxActionCounts()).toEqual({
      message: 2,
      appel: 3,
      candidature: 1,
      podcast: 0,
    });
  });

  // ── Alignement avec `queries.ts` — le cœur de ce fichier ────────────────
  it("Messages : miroir de `replyCount === 0 && status ∉ {processed, archived}`", async () => {
    await getInboxActionCounts();
    const where = (countMocks.submission.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where["replyCount"]).toBe(0);
    expect(where["status"]).toEqual({ notIn: ["processed", "archived"] });
    // Périmètre de la liste par défaut : ni archivé, ni corbeille.
    expect(where["archivedAt"]).toBeNull();
    expect(where["deletedAt"]).toBeNull();
    // Le critère divergent du premier jet ne doit pas revenir.
    expect(where).not.toHaveProperty("needsAttention");
  });

  it("Appels : miroir de « programmé ET contact inconnu »", async () => {
    await getInboxActionCounts();
    const where = (
      countMocks.calendlyEvent.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    ).where;
    expect(where["status"]).toBe("scheduled");
    expect(where["OR"]).toEqual([{ inviteeName: null }, { inviteeEmail: null }]);
  });

  it("Candidatures : miroir de `needsAttention`", async () => {
    await getInboxActionCounts();
    const where = (
      countMocks.jobApplication.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    ).where;
    expect(where).toEqual({ needsAttention: true });
  });

  it('Podcast : miroir de `status === "new"`', async () => {
    await getInboxActionCounts();
    const where = (
      countMocks.podcastRequest.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    ).where;
    expect(where).toEqual({ status: "new" });
  });

  // ── Robustesse ───────────────────────────────────────────────────────────
  it("un canal en panne ne met pas la console par terre", async () => {
    countMocks.calendlyEvent.mockRejectedValueOnce(new Error("db down"));
    const counts = await getInboxActionCounts();
    expect(counts.appel).toBe(0);
    // Les autres restent justes : pas de badge vaut mieux qu'une page blanche.
    expect(counts.message).toBe(2);
  });

  it("les 4 compteurs partent en parallèle, pas en cascade", async () => {
    await getInboxActionCounts();
    for (const m of Object.values(countMocks)) expect(m).toHaveBeenCalledOnce();
  });

  it("expose un tag d'invalidation stable", () => {
    expect(INBOX_COUNTS_TAG).toBe("admin:inbox-counts");
    expect(EMPTY_INBOX_COUNTS).toEqual({ appel: 0, message: 0, candidature: 0, podcast: 0 });
  });
});
