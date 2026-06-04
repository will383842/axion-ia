/**
 * T-03 — Résolution tenant + réglages (tenant.ts).
 *
 * mergeSettings (pur) : défauts + override profond. resolveTenantByKey (Prisma
 * mocké) : tenant actif résolu, inactif/absent → null. (L'idempotence du seed
 * est vérifiée par le smoke runtime contre la dev DB — cf. journal T-03.)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { chatTenant: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { mergeSettings, resolveTenantByKey, getDefaultTenant } from "@/server/chatbot/tenant";
import { DEFAULT_TENANT_SETTINGS } from "@/server/chatbot/constants";

beforeEach(() => findUnique.mockReset());

describe("T-03 mergeSettings", () => {
  it("retourne les défauts si reglages vide/null", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_TENANT_SETTINGS);
    expect(mergeSettings({})).toEqual(DEFAULT_TENANT_SETTINGS);
  });

  it("override profond du palier LLM sans perdre les autres clés", () => {
    const merged = mergeSettings({ llmTier: { faqSimple: "sonnet" } });
    expect(merged.llmTier.faqSimple).toBe("sonnet"); // override
    expect(merged.llmTier.recherche).toBe("sonnet"); // défaut conservé
    expect(merged.llmTier.reformulation).toBe("haiku"); // défaut conservé
  });

  it("override du cap coût + cache", () => {
    const merged = mergeSettings({ costCapUsdPerMonth: 100, cache: { ttlHours: 1 } });
    expect(merged.costCapUsdPerMonth).toBe(100);
    expect(merged.cache.ttlHours).toBe(1);
    expect(merged.cache.enabled).toBe(true); // défaut conservé
  });
});

describe("T-03 resolveTenantByKey", () => {
  it("résout un tenant actif", async () => {
    findUnique.mockResolvedValue({
      id: "uuid-1",
      cle: "axion-ia",
      nom: "Axion-IA",
      domaine: "axion-ia.com",
      actif: true,
      reglages: { confidenceThreshold: 0.5 },
    });
    const t = await resolveTenantByKey("axion-ia");
    expect(t?.id).toBe("uuid-1");
    expect(t?.settings.confidenceThreshold).toBe(0.5); // override appliqué
    expect(t?.settings.maxOfferCards).toBe(DEFAULT_TENANT_SETTINGS.maxOfferCards);
  });

  it("retourne null si tenant inactif", async () => {
    findUnique.mockResolvedValue({
      id: "x",
      cle: "axion-ia",
      nom: "n",
      domaine: null,
      actif: false,
      reglages: null,
    });
    expect(await resolveTenantByKey("axion-ia")).toBeNull();
  });

  it("retourne null si tenant absent", async () => {
    findUnique.mockResolvedValue(null);
    expect(await resolveTenantByKey("inconnu")).toBeNull();
  });

  it("getDefaultTenant interroge la clé axion-ia", async () => {
    findUnique.mockResolvedValue(null);
    await getDefaultTenant();
    expect(findUnique).toHaveBeenCalledWith({ where: { cle: "axion-ia" } });
  });
});
