import { describe, expect, it, vi } from "vitest";

import {
  buildStub,
  estTableAbsente,
  lireModePilotage,
  modeDepuisValeur,
  pilotageSeoActif,
} from "../interrupteur";
import {
  FUSEAU_SEO_PILOTAGE,
  PATTERN_SEO_INGESTION,
  PATTERN_SEO_PURGE,
  PATTERN_SEO_ROBOTS_IA,
  PATTERN_SEO_RECALCUL,
  PATTERN_SEO_RATTRAPAGE,
} from "../planification";

describe("interrupteur du pilotage SEO", () => {
  it("seul « true » exact allume le robot", () => {
    expect(pilotageSeoActif({ CONTENT_PILOTAGE_SEO: "true" })).toBe(true);
    for (const v of [undefined, "", "1", "TRUE", "True", " true", "true ", "yes", "false"]) {
      expect(pilotageSeoActif({ CONTENT_PILOTAGE_SEO: v } as never)).toBe(false);
    }
  });

  it("le mode vaut observation par défaut, et pour toute valeur inconnue", () => {
    expect(modeDepuisValeur(undefined)).toBe("observation");
    expect(modeDepuisValeur({ mode: "n'importe quoi" })).toBe("observation");
    expect(modeDepuisValeur("auto_borne")).toBe("observation");
    expect(modeDepuisValeur({ mode: "proposition" })).toBe("proposition");
  });

  it("une panne de lecture du mode retombe sur observation", async () => {
    const prisma = { contentGenConfig: { findUnique: vi.fn().mockRejectedValue(new Error("x")) } };
    expect(await lireModePilotage(prisma as never)).toBe("observation");
  });

  it("reconnaît le stub de build et les tables absentes", () => {
    expect(
      buildStub({
        DATABASE_URL: "postgresql://stub:stub@stub.invalid:5432/stub",
      }),
    ).toBe(true);
    expect(buildStub({ DATABASE_URL: "postgresql://u@db:5432/x" })).toBe(false);
    expect(estTableAbsente({ code: "P2021" })).toBe(true);
    expect(estTableAbsente({ code: "P2022" })).toBe(true);
    expect(estTableAbsente({ code: "P2002" })).toBe(false);
    expect(estTableAbsente(null)).toBe(false);
  });
});

describe("cadences du robot", () => {
  it("ne tombent pas sur la minute 0 de site-route-gsc et keyword-sync (04:00 UTC)", () => {
    const minutes = (p: string) => (p.split(" ")[0] as string).split(",").map(Number);
    for (const p of [
      PATTERN_SEO_INGESTION,
      PATTERN_SEO_RATTRAPAGE,
      PATTERN_SEO_PURGE,
      PATTERN_SEO_ROBOTS_IA,
      PATTERN_SEO_RECALCUL,
    ]) {
      expect(minutes(p)).not.toContain(0);
    }
    expect(FUSEAU_SEO_PILOTAGE).toBe("Europe/Paris");
  });

  it("les crons existants visés sont bien à 04:00 UTC (le test ne ment pas)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/server/queue/queues.ts", "utf8");
    expect(src).toMatch(/pattern: "0 4 \* \* \*" \}, jobId: "site-route-gsc-cron"/);
    expect(src).toMatch(/pattern: "0 4 \* \* 1" \}, jobId: "content-keyword-sync-cron"/);
  });
});
