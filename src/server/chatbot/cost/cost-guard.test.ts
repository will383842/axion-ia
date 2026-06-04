// T-30 — garde-fous coût (spend mensuel, mode éco, alertes 80/100 %).

import { describe, it, expect, vi, beforeEach } from "vitest";

const aggregate = vi.fn();
const redisGet = vi.fn();
const redisSet = vi.fn();
const sendTelegram = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { chatMessage: { aggregate: (...a: unknown[]) => aggregate(...a) } },
}));
vi.mock("@/lib/redis", () => ({
  redis: { get: (...a: unknown[]) => redisGet(...a), set: (...a: unknown[]) => redisSet(...a) },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => sendTelegram(...a) }));

import {
  getMonthlySpend,
  evaluateCostCap,
  maybeAlertCostThreshold,
} from "@/server/chatbot/cost/cost-guard";

beforeEach(() => {
  aggregate.mockReset();
  redisGet.mockReset();
  redisSet.mockReset();
  sendTelegram.mockReset();
});

describe("getMonthlySpend", () => {
  it("renvoie la valeur cachée si présente (pas d'agrégat DB)", async () => {
    redisGet.mockResolvedValue("12.5");
    expect(await getMonthlySpend("t1")).toBe(12.5);
    expect(aggregate).not.toHaveBeenCalled();
  });
  it("agrège la DB sur cache miss puis met en cache", async () => {
    redisGet.mockResolvedValue(null);
    aggregate.mockResolvedValue({ _sum: { coutEstime: 7 } });
    redisSet.mockResolvedValue("OK");
    expect(await getMonthlySpend("t1")).toBe(7);
    expect(redisSet).toHaveBeenCalled();
  });
  it("fail-soft → 0 si la DB throw", async () => {
    redisGet.mockResolvedValue(null);
    aggregate.mockRejectedValue(new Error("db down"));
    expect(await getMonthlySpend("t1")).toBe(0);
  });
});

describe("evaluateCostCap", () => {
  it("mode éco quand spend ≥ cap", async () => {
    redisGet.mockResolvedValue("50");
    const s = await evaluateCostCap("t1", 50);
    expect(s.ecoMode).toBe(true);
    expect(s.ratio).toBe(1);
  });
  it("pas de mode éco sous le cap", async () => {
    redisGet.mockResolvedValue("10");
    const s = await evaluateCostCap("t1", 50);
    expect(s.ecoMode).toBe(false);
  });
});

describe("maybeAlertCostThreshold", () => {
  it("alerte une fois à 100 % (set NX = OK → Telegram)", async () => {
    redisSet.mockResolvedValue("OK");
    sendTelegram.mockResolvedValue(true);
    await maybeAlertCostThreshold({ spend: 50, cap: 50, ratio: 1, ecoMode: true }, "t1");
    expect(sendTelegram).toHaveBeenCalledOnce();
  });
  it("ne re-alerte pas si déjà alerté (set NX = null)", async () => {
    redisSet.mockResolvedValue(null);
    await maybeAlertCostThreshold({ spend: 45, cap: 50, ratio: 0.9, ecoMode: false }, "t1");
    expect(sendTelegram).not.toHaveBeenCalled();
  });
  it("aucune alerte sous 80 %", async () => {
    await maybeAlertCostThreshold({ spend: 10, cap: 50, ratio: 0.2, ecoMode: false }, "t1");
    expect(redisSet).not.toHaveBeenCalled();
  });
});
