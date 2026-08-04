/**
 * Tests basiques external-links-monitor-worker.
 * Tests d'intégration HTTP réels exclus — only pure logic + alerting.
 *
 * 🔴 CES DEUX CAS DÉPASSAIENT LEUR DÉLAI EN LOCAL (2026-08-04).
 *
 * Ils ne font pourtant qu'importer le module et lire ses exports : le coût
 * n'était pas dans le test mais dans la CHAÎNE D'IMPORT. Chronométrée plutôt
 * que devinée, elle donne :
 *
 *   worker → `@/lib/telegram` (44 s) → `@/server/notifications`
 *          → `./format` → `@/lib/seo` (**30 s à lui seul**)
 *
 * `format.ts` tire tout `@/lib/seo` pour une seule constante (`SITE_URL`).
 * Le premier cas épuisait ses 30 s là-dedans et entraînait le second.
 *
 * Ça passait en CI, d'où un rouge purement local : le pire des signaux, celui
 * qui apprend à ignorer un test.
 *
 * On bouchonne donc `@/lib/telegram`. Ces cas vérifient la SURFACE du module
 * (ses exports, et son garde-fou d'activation) ; l'alerte n'y est jamais
 * déclenchée, et la logique de vérification HTTP est explicitement hors
 * périmètre — cf. l'en-tête d'origine ci-dessus.
 *
 * ⚠️ Le coût d'import reste réel pour tout autre appelant de `@/lib/telegram`.
 * L'alléger suppose de sortir `SITE_URL` de `@/lib/seo` : chantier distinct,
 * qui touche le chemin de notification commun à tous les workers.
 */

import { describe, it, expect, vi } from "vitest";

// Seul export du module que le worker consomme (alerte > 5 % de liens cassés).
vi.mock("@/lib/telegram", () => ({
  sendTelegram: vi.fn(async () => true),
}));

describe("external-links-monitor exports", () => {
  it("exports startExternalLinksMonitorWorker + runExternalLinksMonitor + QUEUE_NAME", async () => {
    const mod = await import("../external-links-monitor-worker");
    expect(mod.QUEUE_NAME).toBe("external-links-monitor");
    expect(typeof mod.startExternalLinksMonitorWorker).toBe("function");
    expect(typeof mod.runExternalLinksMonitor).toBe("function");
  });

  it("startExternalLinksMonitorWorker throw si EXTERNAL_LINKS_MONITOR_ENABLED!=true", async () => {
    const original = process.env.EXTERNAL_LINKS_MONITOR_ENABLED;
    process.env.EXTERNAL_LINKS_MONITOR_ENABLED = "false";
    const { startExternalLinksMonitorWorker } = await import("../external-links-monitor-worker");
    expect(() => startExternalLinksMonitorWorker()).toThrow(/EXTERNAL_LINKS_MONITOR_ENABLED/);
    process.env.EXTERNAL_LINKS_MONITOR_ENABLED = original;
  });
});
