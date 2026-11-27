import { beforeEach, describe, expect, it, vi } from "vitest";

// Toute touche à la base ou à Google est un échec du test quand le robot est éteint.
const accesBase = vi.fn();
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    accesBase();
    return {};
  },
}));
const tacheIngestion = vi.fn();
const tacheRattrapage = vi.fn();
const tachePurge = vi.fn();
vi.mock("@/server/seo-pilotage/ingestion", () => ({
  tacheIngestionGsc: tacheIngestion,
  tacheRattrapageGsc: tacheRattrapage,
  tachePurge,
}));
const lireMode = vi.fn(async () => "observation");
vi.mock("@/server/seo-pilotage/interrupteur", async (orig) => ({
  ...(await orig<typeof import("@/server/seo-pilotage/interrupteur")>()),
  lireModePilotage: lireMode,
}));
vi.mock("bullmq", () => ({ Worker: class {} }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));

const { runSeoPilotageJob } = await import("../seo-pilotage-worker");
const job = (tache: unknown) => ({ data: { tache } }) as never;

describe("worker seo-pilotage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTENT_PILOTAGE_SEO;
    process.env.DATABASE_URL = "postgresql://u:p@db:5432/x";
    tacheIngestion.mockResolvedValue({ tache: "ingestion-gsc", issue: "termine", motif: "ok" });
    tacheRattrapage.mockResolvedValue({ tache: "rattrapage-gsc", issue: "termine", motif: "ok" });
    tachePurge.mockResolvedValue({
      semainesCumulees: 0,
      semainesEnAttente: 0,
      joursSupprimes: 0,
      semainesSupprimees: 0,
      requetesRetirees: 0,
    });
  });

  it("éteint (par défaut) : aucune lecture de base, aucun appel, aucune écriture", async () => {
    for (const t of ["ingestion-gsc", "rattrapage-gsc", "purge"]) {
      expect(await runSeoPilotageJob(job(t))).toEqual({
        issue: "saute",
        motif: "interrupteur_eteint",
      });
    }
    for (const v of ["1", "TRUE", "yes"]) {
      process.env.CONTENT_PILOTAGE_SEO = v;
      expect(await runSeoPilotageJob(job("ingestion-gsc"))).toMatchObject({ issue: "saute" });
    }
    expect(accesBase).not.toHaveBeenCalled();
    expect(tacheIngestion).not.toHaveBeenCalled();
    expect(tacheRattrapage).not.toHaveBeenCalled();
    expect(tachePurge).not.toHaveBeenCalled();
  });

  it("build stub : saut, base non touchée", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect(await runSeoPilotageJob(job("purge"))).toEqual({ issue: "saute", motif: "stub" });
    expect(accesBase).not.toHaveBeenCalled();
    expect(tachePurge).not.toHaveBeenCalled();
  });

  it("table absente (P2021 ou P2022) : saut sans échec, pour chaque tâche", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    for (const code of ["P2021", "P2022"]) {
      const err = Object.assign(new Error("table absente"), { code });
      tacheIngestion.mockRejectedValueOnce(err);
      tacheRattrapage.mockRejectedValueOnce(err);
      tachePurge.mockRejectedValueOnce(err);
      for (const t of ["ingestion-gsc", "rattrapage-gsc", "purge"]) {
        expect(await runSeoPilotageJob(job(t))).toEqual({
          issue: "saute",
          motif: "tables_absentes",
        });
      }
    }
  });

  it("une autre erreur de base remonte (la tâche échoue et se voit)", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    tacheIngestion.mockRejectedValueOnce(Object.assign(new Error("autre"), { code: "P2002" }));
    await expect(runSeoPilotageJob(job("ingestion-gsc"))).rejects.toThrow("autre");
  });

  it("allumé : aiguille chaque tâche vers sa fonction", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    await runSeoPilotageJob(job("ingestion-gsc"));
    await runSeoPilotageJob(job("rattrapage-gsc"));
    await runSeoPilotageJob(job("purge"));
    expect(tacheIngestion).toHaveBeenCalledTimes(1);
    expect(tacheRattrapage).toHaveBeenCalledTimes(1);
    expect(tachePurge).toHaveBeenCalledTimes(1);
  });

  it("une tâche inconnue est journalisée et IGNORÉE, même allumé, sans rien lancer", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const t of ["inspection", "opportunites", "", undefined, 42, "ingestion-gsc\nINJECTE"]) {
      expect(await runSeoPilotageJob(job(t))).toEqual({ issue: "ignoree" });
    }
    expect(warn).toHaveBeenCalledTimes(6);
    expect(warn.mock.calls.every((c) => String(c[0]).includes("tâche inconnue ignorée"))).toBe(
      true,
    );
    expect(warn.mock.calls.some((c) => String(c[0]).includes("\n" + "INJECTE"))).toBe(false);
    expect(accesBase).not.toHaveBeenCalled();
    expect(tacheIngestion).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
