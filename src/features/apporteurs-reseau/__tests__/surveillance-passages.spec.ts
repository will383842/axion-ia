import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  store: new Map<string, string>(),
  alertes: [] as Array<{ jobId: string; niveau?: string }>,
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn(async (k: string, v: string) => void d.store.set(k, v)),
    get: vi.fn(async (k: string) => d.store.get(k) ?? null),
  },
}));
vi.mock("../alerte-interne", () => ({
  alerteInterne: vi.fn(async (a: { jobId: string; niveau?: string }) => {
    d.alertes.push(a);
    return true;
  }),
}));
vi.mock("@/server/notifications/routing", () => ({ resolveTelegramTarget: () => null }));
vi.mock("@/server/notifications/channels/telegram", () => ({ sendTelegramRaw: vi.fn() }));
vi.mock("@/server/notifications/dedup", () => ({
  isDuplicate: vi.fn(async () => false),
  libererDedup: vi.fn(),
}));

import {
  enRetard,
  noterPassageReussi,
  verifierPassages,
  SEUIL_HEURES,
} from "../surveillance-passages";

const H = 3_600_000;
const MAINT = new Date("2026-12-01T12:00:00Z");

beforeEach(() => {
  d.store.clear();
  d.alertes.length = 0;
  delete process.env.REDIS_URL;
});

describe("seuils", () => {
  it("26 h pour le quotidien, 3 h pour l'horaire", () => {
    expect(SEUIL_HEURES).toEqual({ "reseau-quotidien": 26, "reseau-facturation": 3 });
    expect(enRetard(new Date(MAINT.getTime() - 25 * H), "reseau-quotidien", MAINT)).toBe(false);
    expect(enRetard(new Date(MAINT.getTime() - 27 * H), "reseau-quotidien", MAINT)).toBe(true);
    expect(enRetard(new Date(MAINT.getTime() - 2 * H), "reseau-facturation", MAINT)).toBe(false);
    expect(enRetard(new Date(MAINT.getTime() - 4 * H), "reseau-facturation", MAINT)).toBe(true);
  });
  it("clé absente (Redis vidé) = en retard", () => {
    expect(enRetard(null, "reseau-facturation", MAINT)).toBe(true);
  });
});

describe("verifierPassages", () => {
  it("tout est à jour : silence", async () => {
    await noterPassageReussi("reseau-quotidien", new Date(MAINT.getTime() - 5 * H));
    await noterPassageReussi("reseau-facturation", new Date(MAINT.getTime() - 1 * H));
    expect(await verifierPassages(MAINT)).toEqual([]);
    expect(d.alertes).toEqual([]);
  });

  it("horaire à 4 h : une alerte critique, clé du jour ; le quotidien à jour ne dit rien", async () => {
    await noterPassageReussi("reseau-quotidien", new Date(MAINT.getTime() - 5 * H));
    await noterPassageReussi("reseau-facturation", new Date(MAINT.getTime() - 4 * H));
    expect(await verifierPassages(MAINT)).toEqual(["reseau-facturation"]);
    expect(d.alertes).toHaveLength(1);
    expect(d.alertes[0]!.jobId).toBe(
      "apporteur-surveillance-passage-reseau-facturation-2026-12-01",
    );
    expect(d.alertes[0]!.niveau).toBe("critique");
  });

  it("Redis vide : les deux passages sont signalés", async () => {
    expect(await verifierPassages(MAINT)).toEqual(["reseau-quotidien", "reseau-facturation"]);
  });

  it("Redis en panne à la lecture : signalé, sans lever", async () => {
    const { redis } = await import("@/lib/redis");
    vi.mocked(redis.get).mockRejectedValue(new Error("down"));
    await expect(verifierPassages(MAINT)).resolves.toHaveLength(2);
  });
});
