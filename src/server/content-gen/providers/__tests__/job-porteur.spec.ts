/**
 * Job porteur (P0) : ligne `content_gen_jobs` d'un type EXISTANT et autorisé, au statut terminal
 * `cancelled`, qui rattache un appel Claude hors génération à la porte de coût. Il doit rester
 * invisible pour l'orchestrateur, les balayages de `recovery` et le moniteur « chaîne à l'arrêt ».
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const creations: Array<{ data: Record<string, unknown> }> = [];
let echec = false;
vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentGenJob: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        if (echec) throw new Error("base KO");
        creations.push(args);
        return { id: `porteur-${creations.length}` };
      }),
    },
  },
}));

import { ContentType } from "../../../../../prisma/generated/client";
import { BlogClaudeRefusError } from "../blog-claude-ledger";
import {
  BORNE_PLAFOND_PORTEUR_USD,
  PREFIXE_CLE_PORTEUR,
  creerJobPorteur,
  estJobPorteur,
  whereHorsPorteurs,
} from "../job-porteur";

const racine = resolve(__dirname, "../../../../..");
const lire = (chemin: string) => readFileSync(resolve(racine, chemin), "utf-8");

beforeEach(() => {
  creations.length = 0;
  echec = false;
  delete process.env["CONTENT_GEN_CLAUDE_TYPES"];
});
afterEach(() => {
  delete process.env["CONTENT_GEN_CLAUDE_TYPES"];
});

describe("creerJobPorteur", () => {
  it("crée un job terminal d'un type existant, avec l'origine et le plafond par job", async () => {
    const r = await creerJobPorteur({ origine: "pilotage", plafondJobUsd: 0.5 });
    expect(r.jobId).toBe("porteur-1");
    const d = creations[0]!.data;
    expect(Object.values(ContentType)).toContain(d["contentType"]);
    expect(r.contentType).toBe(d["contentType"]);
    expect(d["status"]).toBe("cancelled");
    expect(d["primaryProvider"]).toBe("anthropic");
    expect(d["inputPayload"]).toMatchObject({ origine: "pilotage", plafondJobUsd: 0.5 });
    expect(String(d["idempotencyKey"]).startsWith(PREFIXE_CLE_PORTEUR)).toBe(true);
    expect(d["completedAt"]).toBeInstanceOf(Date);
    expect(d["retryCount"] ?? 0).toBe(0);
  });

  it("deux porteurs n'ont jamais la même clé d'idempotence", async () => {
    await creerJobPorteur({ origine: "pilotage", plafondJobUsd: 1 });
    await creerJobPorteur({ origine: "pilotage", plafondJobUsd: 1 });
    expect(creations[0]!.data["idempotencyKey"]).not.toBe(creations[1]!.data["idempotencyKey"]);
  });

  it("le type est celui des types AUTORISÉS (liste personnalisée respectée)", async () => {
    process.env["CONTENT_GEN_CLAUDE_TYPES"] = "blog_article";
    const r = await creerJobPorteur({ origine: "equipe_maj", plafondJobUsd: 3 });
    expect(r.contentType).toBe("blog_article");
  });

  it("aucun type autorisé : refus sûr, rien n'est créé", async () => {
    process.env["CONTENT_GEN_CLAUDE_TYPES"] = "type_inconnu";
    await expect(creerJobPorteur({ origine: "pilotage", plafondJobUsd: 1 })).rejects.toMatchObject({
      code: "config_invalide",
    });
    expect(creations).toHaveLength(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "plafond par job invalide (%s) : refus",
    async (plafondJobUsd) => {
      await expect(creerJobPorteur({ origine: "pilotage", plafondJobUsd })).rejects.toBeInstanceOf(
        BlogClaudeRefusError,
      );
      expect(creations).toHaveLength(0);
    },
  );

  it("base en erreur : refus sûr (UnrecoverableError), pas de job fantôme", async () => {
    echec = true;
    await expect(creerJobPorteur({ origine: "pilotage", plafondJobUsd: 1 })).rejects.toMatchObject({
      code: "base_indisponible",
    });
  });
});

describe("estJobPorteur et bornes", () => {
  it("reconnaît la clé, la charge, et rien d'autre", () => {
    expect(estJobPorteur({ idempotencyKey: "porteur:pilotage:x" })).toBe(true);
    expect(estJobPorteur({ idempotencyKey: "h", inputPayload: { porteur: true } })).toBe(true);
    expect(estJobPorteur({ idempotencyKey: "hash", inputPayload: { primaryKeyword: "k" } })).toBe(
      false,
    );
    expect(estJobPorteur({ inputPayload: null })).toBe(false);
  });
  it("plafond au-dessus de la borne de garde : refus", async () => {
    await expect(
      creerJobPorteur({ origine: "pilotage", plafondJobUsd: BORNE_PLAFOND_PORTEUR_USD + 1 }),
    ).rejects.toMatchObject({ code: "config_invalide" });
  });
});

describe("le porteur est invisible", () => {
  it("les autres comptages sans filtre de statut l'excluent (rapport, tableau de bord, santé)", () => {
    for (const f of [
      "src/server/queue/workers/content-weekly-report-worker.ts",
      "src/server/actions/content-gen/dashboard.ts",
      "src/server/actions/content-gen/health.ts",
    ]) {
      expect(lire(f)).toContain("whereHorsPorteurs");
    }
  });
  it("« Relancer » refuse un porteur", () => {
    expect(lire("src/server/actions/content-gen/jobs.ts")).toContain("estJobPorteur(dbJob)");
  });

  it("statut `cancelled` : hors des statuts lus par le recovery et l'orchestrateur", () => {
    const sources = [
      lire("src/server/content-gen/recovery/backlog-recovery.ts"),
      lire("src/server/queue/workers/content-orchestrator-worker.ts"),
    ].join("\n");
    // Tous les statuts énumérés dans un `status: { in: [...] }` de ces fichiers.
    const enumeres = new Set<string>();
    for (const m of sources.matchAll(/status:\s*\{\s*in:\s*\[([^\]]*)\]/g)) {
      for (const s of m[1]!.matchAll(/"([a-z_]+)"/g)) enumeres.add(s[1]!);
    }
    expect(enumeres.size).toBeGreaterThan(0);
    expect(enumeres.has("cancelled")).toBe(false);
    // Les relances ne ciblent que `failed` ; les comptages du jour excluent `cancelled`.
    expect(sources).toContain('status: "failed"');
    expect(sources).toContain('status: { not: "cancelled" }');
  });

  it("le moniteur « chaîne à l'arrêt » exclut les porteurs de ses deux comptages", () => {
    const src = lire("src/server/queue/workers/content-monitoring-worker.ts");
    expect(src).toContain("whereHorsPorteurs");
    expect(src).toMatch(/createdAt: \{ gte: fourHoursAgo \}, \.\.\.whereHorsPorteurs/);
    expect(src).toMatch(/createdAt: \{ gte: twentyFourHoursAgo \}, \.\.\.whereHorsPorteurs/);
  });

  it("whereHorsPorteurs exclut la clé de préfixe `porteur:`", () => {
    expect(whereHorsPorteurs).toEqual({
      NOT: { idempotencyKey: { startsWith: PREFIXE_CLE_PORTEUR } },
    });
  });
});
