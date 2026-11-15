/**
 * Prix des modèles Claude 5.5 (table de l'adaptateur Anthropic + client claude-search)
 * et modèle par défaut du fournisseur anthropic.
 *
 * Haiku 5.5 : prix NON connu — le calcul de coût doit échouer proprement,
 * jamais renvoyer un chiffre inventé.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { providerConfig: { findUnique: vi.fn().mockResolvedValue(null) } },
}));

import { computeCost } from "../anthropic";
import { computeClaudeCost } from "@/server/clients/claude-search";
import { readProviderConfig } from "../../lib/config-reader";
import { seedProviderConfig } from "../../../../../prisma/seeds/content-gen/provider-config";

const M = 1_000_000;

describe("computeCost (anthropic.ts)", () => {
  it("claude-opus-5-5 : 4 $ entrée / 20 $ sortie par million", () => {
    expect(computeCost("claude-opus-5-5", M, 0, 0, 0)).toBeCloseTo(4, 10);
    expect(computeCost("claude-opus-5-5", 0, M, 0, 0)).toBeCloseTo(20, 10);
  });

  it("claude-sonnet-5-5 : 2 $ entrée / 10 $ sortie par million", () => {
    expect(computeCost("claude-sonnet-5-5", M, 0, 0, 0)).toBeCloseTo(2, 10);
    expect(computeCost("claude-sonnet-5-5", 0, M, 0, 0)).toBeCloseTo(10, 10);
  });

  it("prix de cache 5.5 (tarif propre au modèle, source Studio tarifs.ts:31-32)", () => {
    expect(computeCost("claude-opus-5-5", 0, 0, M, 0)).toBeCloseTo(0.2, 10);
    expect(computeCost("claude-opus-5-5", 0, 0, 0, M)).toBeCloseTo(5.0, 10);
    expect(computeCost("claude-sonnet-5-5", 0, 0, M, 0)).toBeCloseTo(0.2, 10);
    expect(computeCost("claude-sonnet-5-5", 0, 0, 0, M)).toBeCloseTo(2.5, 10);
  });

  it("claude-haiku-5-5 : prix inconnu, le calcul échoue proprement", () => {
    expect(() => computeCost("claude-haiku-5-5", 1000, 1000, 0, 0)).toThrow(/prix inconnu/i);
  });

  it("anciens modèles inchangés", () => {
    expect(computeCost("claude-sonnet-4-6", M, M, 0, 0)).toBeCloseTo(18, 10);
    expect(computeCost("claude-opus-4-7", M, M, 0, 0)).toBeCloseTo(90, 10);
  });
});

describe("computeClaudeCost (claude-search.ts)", () => {
  it("opus-5-5 et sonnet-5-5", () => {
    expect(computeClaudeCost("claude-opus-5-5", M, M)).toBeCloseTo(24, 10);
    expect(computeClaudeCost("claude-sonnet-5-5", M, M)).toBeCloseTo(12, 10);
  });

  it("haiku-5-5 : échec propre", () => {
    expect(() => computeClaudeCost("claude-haiku-5-5", 10, 10)).toThrow(/prix inconnu/i);
  });

  it("anciens modèles inchangés", () => {
    expect(computeClaudeCost("claude-sonnet-4-6", M, M)).toBeCloseTo(18, 10);
  });
});

describe("modèle par défaut du fournisseur anthropic", () => {
  it("config-reader (défauts V0) : claude-sonnet-5-5", async () => {
    const cfg = await readProviderConfig("anthropic");
    expect(cfg.model).toBe("claude-sonnet-5-5");
  });

  it("seed : la ligne anthropic crée claude-sonnet-5-5 ; openai reste gpt-4o", async () => {
    const creates: Array<{ provider: string; role: string; model: string }> = [];
    const updates: Array<Record<string, unknown>> = [];
    const fake = {
      providerConfig: {
        upsert: vi.fn(
          async (args: {
            create: { provider: string; role: string; model: string };
            update: Record<string, unknown>;
          }) => {
            creates.push(args.create);
            updates.push(args.update);
          },
        ),
      },
    };
    await seedProviderConfig(fake as never);
    // Garantie « ne pas écraser la base » : l'update ne touche jamais au modèle.
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) expect(u).not.toHaveProperty("model");
    expect(creates.find((r) => r.provider === "anthropic")?.model).toBe("claude-sonnet-5-5");
    expect(creates.find((r) => r.provider === "openai" && r.role === "text")?.model).toBe("gpt-4o");
  });
});
