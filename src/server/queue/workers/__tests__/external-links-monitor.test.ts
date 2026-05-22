/**
 * Tests basiques external-links-monitor-worker.
 * Tests d'intégration HTTP réels exclus — only pure logic + alerting.
 */

import { describe, it, expect } from "vitest";

describe("external-links-monitor exports", () => {
  it("exports startExternalLinksMonitorWorker + runExternalLinksMonitor + QUEUE_NAME", async () => {
    const mod = await import("../external-links-monitor-worker");
    expect(mod.QUEUE_NAME).toBe("external-links-monitor");
    expect(typeof mod.startExternalLinksMonitorWorker).toBe("function");
    expect(typeof mod.runExternalLinksMonitor).toBe("function");
  }, 30_000);

  it("startExternalLinksMonitorWorker throw si EXTERNAL_LINKS_MONITOR_ENABLED!=true", async () => {
    const original = process.env.EXTERNAL_LINKS_MONITOR_ENABLED;
    process.env.EXTERNAL_LINKS_MONITOR_ENABLED = "false";
    const { startExternalLinksMonitorWorker } = await import("../external-links-monitor-worker");
    expect(() => startExternalLinksMonitorWorker()).toThrow(/EXTERNAL_LINKS_MONITOR_ENABLED/);
    process.env.EXTERNAL_LINKS_MONITOR_ENABLED = original;
  });
});
