// @vitest-environment node
/**
 * Le worker de balayage ÉCRIT le bilan des fiches des demandes (`DOSSIER_FICHE_DEMANDE`) dans son
 * journal : des NOMBRES seulement. Sans cette ligne, l'étape « essai » (à blanc) ne se lirait nulle part.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const espions = vi.hoisted(() => ({
  processeur: null as null | ((job: unknown) => Promise<void>),
  passerBalayage: vi.fn(),
  balayerEnregistreur: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_nom: string, processeur: (job: unknown) => Promise<void>) {
      espions.processeur = processeur;
    }
    on() {
      return this;
    }
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { marque: "prisma" } }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@/server/visio/balayage", () => ({ passerBalayage: espions.passerBalayage }));
vi.mock("@/server/visio/balayage-enregistreur", () => ({
  balayerEnregistreur: espions.balayerEnregistreur,
  notifierParTelegram: vi.fn(),
}));

const BILAN = {
  mode: "essai",
  creees: 0,
  liees: 0,
  doutes: 2,
  plantees: 1,
  creeraient: 3,
  lieraient: 4,
  doublons: [],
  colonneAbsente: false,
};

function resultat(fichesDemande: Record<string, unknown>) {
  return {
    rencontresAssurees: 0,
    comptesRendusAValider: 0,
    suitesEchues: 0,
    veille: 0,
    couverture: null,
    etapesEnEchec: [],
    fichesDemande,
  };
}

async function unPassage(): Promise<void> {
  const { startVisioBalayageWorker } = await import("@/server/queue/workers/visio-balayage-worker");
  startVisioBalayageWorker();
  if (!espions.processeur) throw new Error("processeur non capturé");
  await espions.processeur({ id: "t" });
}

describe("le worker de balayage journalise les fiches des demandes", () => {
  let avert: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("DOSSIER_BALAYAGE_ENABLED", "true");
    espions.balayerEnregistreur
      .mockReset()
      .mockResolvedValue({ cloture: {}, purges: {}, temoinOk: true, alertes: 0 });
    avert = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    avert.mockRestore();
  });

  const lignes = () => avert.mock.calls.map((c: unknown[]) => String(c[0]));

  it("à blanc : les nombres du bilan, colonne absente comprise, rien d'autre", async () => {
    espions.passerBalayage.mockReset().mockResolvedValue(resultat(BILAN));
    await unPassage();
    const ligne = lignes().find((l: string) => l.includes("fiches des demandes À BLANC"));
    expect(ligne).toBeDefined();
    expect(ligne).toContain("créerait 3");
    expect(ligne).toContain("lierait 4");
    expect(ligne).toContain("douterait 2");
    expect(ligne).toContain("planterait 1");
    expect(ligne).toContain("colonne absente non");
  });

  it("actif : créées, liées, doublons, doutes, plantées", async () => {
    espions.passerBalayage.mockReset().mockResolvedValue(
      resultat({
        ...BILAN,
        mode: "actif",
        creees: 5,
        liees: 2,
        doublons: [{ clientId: "x", proches: 1 }],
      }),
    );
    await unPassage();
    const ligne = lignes().find((l: string) => l.includes("fiches des demandes :"));
    expect(ligne).toContain("5 créée(s)");
    expect(ligne).toContain("2 liée(s)");
    expect(ligne).toContain("1 doublon(s) possible(s)");
    expect(ligne).toContain("2 doute(s)");
    expect(ligne).toContain("1 plantée(s)");
  });

  it("la colonne absente est écrite même sans autre compteur", async () => {
    espions.passerBalayage.mockReset().mockResolvedValue(
      resultat({
        ...BILAN,
        mode: "actif",
        doutes: 0,
        plantees: 0,
        creeraient: 0,
        lieraient: 0,
        colonneAbsente: true,
      }),
    );
    await unPassage();
    expect(lignes().some((l: string) => l.includes("colonne absente oui"))).toBe(true);
  });

  it("coupé et rien à dire : aucune ligne", async () => {
    espions.passerBalayage.mockReset().mockResolvedValue(
      resultat({
        ...BILAN,
        mode: "coupe",
        doutes: 0,
        plantees: 0,
        creeraient: 0,
        lieraient: 0,
      }),
    );
    await unPassage();
    expect(lignes().some((l: string) => l.includes("fiches des demandes"))).toBe(false);
  });
});
