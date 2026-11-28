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
const tacheRecalcul = vi.fn();
vi.mock("@/server/seo-pilotage/recalcul", () => ({ tacheRecalcul }));
const tacheInspection = vi.fn();
vi.mock("@/server/seo-pilotage/inspection/tache", () => ({ tacheInspection }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
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
    tacheRecalcul.mockResolvedValue({ issue: "fait", routesMisesAJour: 0, motsCles: 0 });
    tacheInspection.mockResolvedValue({
      inspectees: 0,
      ecrites: 0,
      inchangees: 0,
      echecs: 0,
      arret: "fini",
    });
    tachePurge.mockResolvedValue({
      semainesCumulees: 0,
      semainesEnAttente: 0,
      joursSupprimes: 0,
      semainesSupprimees: 0,
      requetesRetirees: 0,
    });
  });

  it("éteint (par défaut) : aucune lecture de base, aucun appel, aucune écriture", async () => {
    for (const t of ["ingestion-gsc", "rattrapage-gsc", "purge", "recalcul", "inspection"]) {
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
    expect(tacheRecalcul).not.toHaveBeenCalled();
    expect(tacheInspection).not.toHaveBeenCalled();
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
      tacheRecalcul.mockRejectedValueOnce(err);
      tacheInspection.mockRejectedValueOnce(err);
      for (const t of ["ingestion-gsc", "rattrapage-gsc", "purge", "recalcul", "inspection"]) {
        expect(await runSeoPilotageJob(job(t))).toEqual({
          issue: "saute",
          motif: "tables_absentes",
        });
      }
    }
  });

  it("inspection : un quota Google atteint se journalise sans faire échouer le job", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    tacheInspection.mockResolvedValueOnce({
      inspectees: 3,
      ecrites: 1,
      inchangees: 2,
      echecs: 0,
      arret: "quota_google",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await runSeoPilotageJob(job("inspection"))).toEqual({
      issue: "fait",
      tache: "inspection",
    });
    expect(warn.mock.calls.some((c) => String(c[0]).includes("quota_google"))).toBe(true);
    warn.mockRestore();
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
    expect(await runSeoPilotageJob(job("inspection"))).toEqual({
      issue: "fait",
      tache: "inspection",
    });
    expect(tacheInspection).toHaveBeenCalledTimes(1);
    expect(tacheIngestion).toHaveBeenCalledTimes(1);
    expect(tacheRattrapage).toHaveBeenCalledTimes(1);
    expect(tachePurge).toHaveBeenCalledTimes(1);
  });

  it("recalcul (P6a) : aiguillé quand allumé ; historique insuffisant = saut sans échec", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    expect(await runSeoPilotageJob(job("recalcul"))).toEqual({ issue: "fait", tache: "recalcul" });
    tacheRecalcul.mockResolvedValueOnce({ issue: "saute", motif: "historique_insuffisant" });
    expect(await runSeoPilotageJob(job("recalcul"))).toEqual({
      issue: "saute",
      motif: "historique_insuffisant",
    });
    expect(tacheRecalcul).toHaveBeenCalledTimes(2);
  });

  it("une tâche inconnue est journalisée et IGNORÉE, même allumé, sans rien lancer", async () => {
    process.env.CONTENT_PILOTAGE_SEO = "true";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    for (const t of ["opportunites", "", undefined, 42, "ingestion-gsc\nINJECTE"]) {
      expect(await runSeoPilotageJob(job(t))).toEqual({ issue: "ignoree" });
    }
    expect(warn).toHaveBeenCalledTimes(5);
    expect(warn.mock.calls.every((c) => String(c[0]).includes("tâche inconnue ignorée"))).toBe(
      true,
    );
    expect(warn.mock.calls.some((c) => String(c[0]).includes("\n" + "INJECTE"))).toBe(false);
    expect(accesBase).not.toHaveBeenCalled();
    expect(tacheIngestion).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
