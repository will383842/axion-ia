/**
 * T-12 — Registre des tools + schémas Zod + injection tenant_id serveur.
 *
 * Couvre : validation Zod (refus payload invalide) · dispatch · injection
 * tenant_id serveur (jamais depuis le LLM) · tool inconnu rejeté · évolutivité.
 */

import { z } from "zod";
import { describe, it, expect } from "vitest";
import {
  ToolRegistry,
  ToolValidationError,
  UnknownToolError,
  chatbotTools,
} from "@/server/chatbot/tools/registry";

const ctx = { tenantId: "axion-ia" };

describe("T-12 registre — registre par défaut", () => {
  it("contient rechercher_offres", () => {
    expect(chatbotTools.has("rechercher_offres")).toBe(true);
    expect(chatbotTools.names()).toContain("rechercher_offres");
  });

  it("dispatch rechercher_offres avec input valide → résultat", async () => {
    const res = (await chatbotTools.dispatch(
      "rechercher_offres",
      { vertical: "formation" },
      ctx,
    )) as { offres: unknown[] };
    expect(Array.isArray(res.offres)).toBe(true);
    expect(res.offres.length).toBeGreaterThan(0);
  });

  it("refuse un payload invalide (Zod) → ToolValidationError", async () => {
    await expect(
      chatbotTools.dispatch("rechercher_offres", { vertical: "compta" }, ctx),
    ).rejects.toBeInstanceOf(ToolValidationError);
  });

  it("refuse une clé inconnue (strict) — ex. tenant_id injecté par le LLM", async () => {
    await expect(
      chatbotTools.dispatch("rechercher_offres", { tenant_id: "autre-tenant" }, ctx),
    ).rejects.toBeInstanceOf(ToolValidationError);
  });

  it("tool inconnu → UnknownToolError", async () => {
    await expect(chatbotTools.dispatch("tool_fantome", {}, ctx)).rejects.toBeInstanceOf(
      UnknownToolError,
    );
  });
});

describe("T-12 registre — framework", () => {
  it("register + dispatch injecte le contexte serveur (tenant)", async () => {
    const reg = new ToolRegistry();
    let seenCtx: { tenantId: string } | null = null;
    reg.register<{ x: number }>({
      name: "echo",
      description: "test",
      schema: z.object({ x: z.number() }).strict(),
      handler: async (input, c) => {
        seenCtx = c;
        return input.x * 2;
      },
    });
    const out = await reg.dispatch("echo", { x: 21 }, { tenantId: "t1" });
    expect(out).toBe(42);
    expect(seenCtx).toEqual({ tenantId: "t1" });
  });

  it("interdit le double enregistrement", () => {
    const reg = new ToolRegistry();
    const def = {
      name: "dup",
      description: "d",
      schema: z.object({}).strict(),
      handler: async () => null,
    };
    reg.register(def);
    expect(() => reg.register(def)).toThrow(/déjà enregistré/);
  });
});
