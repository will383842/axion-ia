// Phase 4 — garde-fous coût (T-30) contre DB + Redis réels. Cap atteint → ecoMode.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getDefaultTenant } from "@/server/chatbot/tenant";
import { evaluateCostCap, getMonthlySpend } from "@/server/chatbot/cost/cost-guard";

describe("Phase 4 — cost-guard T-30 (DB + Redis réels)", () => {
  let tenantId: string;
  let convoId: string;

  beforeAll(async () => {
    const t = await getDefaultTenant();
    tenantId = t!.id;
    const convo = await prisma.chatConversation.create({
      data: { tenantId, sessionUuid: randomUUID() },
      select: { id: true },
    });
    convoId = convo.id;
    // Message assistant coûteux (coutEstime) → alimente le spend mensuel réel.
    await prisma.chatMessage.create({
      data: { conversationId: convoId, role: "assistant", contenu: "x", coutEstime: 5.0 },
    });
    // Invalide le cache spend Redis pour forcer le recalcul DB.
    try {
      await redis.del(`chatbot:spend:${tenantId}`);
    } catch {
      /* fail-soft */
    }
  });

  afterAll(async () => {
    await prisma.chatMessage.deleteMany({ where: { conversationId: convoId } });
    await prisma.chatConversation.delete({ where: { id: convoId } });
    try {
      await redis.del(`chatbot:spend:${tenantId}`);
    } catch {
      /* fail-soft */
    }
  });

  it("getMonthlySpend somme réellement les coûts du mois (≥ 5 USD injectés)", async () => {
    const spend = await getMonthlySpend(tenantId);
    expect(spend).toBeGreaterThanOrEqual(5.0);
  });

  it("cap atteint → ecoMode=true ; cap large → ecoMode=false", async () => {
    const tight = await evaluateCostCap(tenantId, 1.0); // spend≥5 > cap 1 → ratio≥1
    expect(tight.ecoMode).toBe(true);
    expect(tight.ratio).toBeGreaterThanOrEqual(1);

    const loose = await evaluateCostCap(tenantId, 1_000_000);
    expect(loose.ecoMode).toBe(false);
  });
});
