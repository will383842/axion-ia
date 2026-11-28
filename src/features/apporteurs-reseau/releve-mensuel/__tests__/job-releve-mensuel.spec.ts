// @vitest-environment node

/**
 * Lot 4c : le passage quotidien PRÉPARE et ALERTE ; il n'enfile AUCUN e-mail d'apporteur.
 * Rattrapage le lendemain, une seule alerte, table absente : passage sauté.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  preparer: vi.fn(),
  completude: vi.fn(),
  reprise: vi.fn(),
  abandon: vi.fn(),
  enqueue: vi.fn(),
  dejaEnvoye: vi.fn(),
}));

vi.mock("../preparation", () => ({
  preparerTranche: m.preparer,
  anomaliesDeCompletude: m.completude,
}));
vi.mock("../reprise", () => ({
  reprendreEnvoisEnCours: m.reprise,
  abandonnerLotsMorts: m.abandon,
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: m.enqueue }));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "interne@exemple.invalid",
}));
vi.mock("../../commissions", () => ({ dejaEnvoye: m.dejaEnvoye }));
vi.mock("../../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { passerReleveMensuel } from "../passage-mensuel";

// 2026-11-01 est un dimanche (Toussaint) : le 1er jour ouvré de novembre 2026 est le lundi 2.
const AVANT = new Date("2026-11-01T09:30:00Z");
const JOUR_1 = new Date("2026-11-02T08:30:00Z");
const JOUR_2 = new Date("2026-11-03T08:30:00Z");

const tranche = (crees: number, reste: number, echecs = 0) => ({
  periode: "2026-10",
  cibles: 5,
  crees,
  dejaPrepares: 0,
  reste,
  echecs: Array.from({ length: echecs }, (_, i) => ({ apporteurId: `a${i}`, message: "x" })),
  anomaliesCalcul: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  m.reprise.mockResolvedValue({ envoyes: 0, echecs: 0 });
  m.abandon.mockResolvedValue(0);
  m.completude.mockResolvedValue([]);
  m.dejaEnvoye.mockResolvedValue(false);
  m.enqueue.mockResolvedValue({ enqueued: true });
  m.preparer.mockResolvedValue(tranche(5, 0));
});

describe("fenêtre", () => {
  it("avant le 1er jour ouvré de M+1 : rien n'est lu ni préparé", async () => {
    const r = await passerReleveMensuel(AVANT);
    expect(r.statut).toBe("hors_fenetre");
    expect(m.preparer).not.toHaveBeenCalled();
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("le 1er jour ouvré : prépare la période PRÉCÉDENTE", async () => {
    const r = await passerReleveMensuel(JOUR_1);
    expect(r).toMatchObject({ statut: "ok", periode: "2026-10", crees: 5 });
    expect(m.preparer.mock.calls[0]![0]).toBe("2026-10");
  });
});

describe("aucun e-mail d'apporteur", () => {
  it("le passage n'enfile que l'alerte interne, jamais le gabarit du relevé", async () => {
    await passerReleveMensuel(JOUR_1);
    expect(m.enqueue).toHaveBeenCalledTimes(1);
    const [gabarit, destinataire] = m.enqueue.mock.calls[0]!;
    expect(gabarit).toBe("qualiopi-alerte-interne");
    expect(destinataire).toBe("interne@exemple.invalid");
    for (const appel of m.enqueue.mock.calls) {
      expect(appel[0]).not.toBe("apporteur-releve-mensuel");
      expect(appel[0]).not.toMatch(/^apporteur-/);
    }
  });

  it("l'alerte pointe l'écran de vérification de la période et dit que rien n'est parti", async () => {
    await passerReleveMensuel(JOUR_1);
    const charge = m.enqueue.mock.calls[0]![3] as { chemin: string; message: string; code: string };
    expect(charge.chemin).toBe("apporteurs/releves/2026-10");
    expect(charge.message).toMatch(/Aucun e-mail n'est parti/);
    expect(m.enqueue.mock.calls[0]![4]).toMatchObject({ jobId: "releve-mensuel-pret-2026-10" });
  });
});

describe("tranches, rattrapage, alerte unique", () => {
  it("enchaîne toutes les tranches jusqu'à « reste 0 »", async () => {
    m.preparer
      .mockResolvedValueOnce(tranche(25, 40))
      .mockResolvedValueOnce(tranche(25, 15))
      .mockResolvedValueOnce(tranche(15, 0));
    const r = await passerReleveMensuel(JOUR_1);
    expect(m.preparer).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ crees: 65, reste: 0, alerte: true });
  });

  it("s'arrête sans progrès (cibles en échec) et alerte « incomplet », pas « prêts »", async () => {
    m.preparer.mockResolvedValue(tranche(0, 3, 3));
    m.completude.mockResolvedValue([{ code: "completude", detail: "x" }]);
    const r = await passerReleveMensuel(JOUR_1);
    expect(m.preparer).toHaveBeenCalledTimes(1);
    expect(r.reste).toBe(3);
    const charge = m.enqueue.mock.calls[0]![3] as { code: string; niveau: string };
    expect(charge.code).toBe("releve-mensuel-incomplet");
    expect(charge.niveau).toBe("critique");
  });

  it("le lendemain, le rattrapage prépare ce qui manque ; l'alerte « prêts » n'est dite qu'une fois", async () => {
    await passerReleveMensuel(JOUR_1);
    m.dejaEnvoye.mockImplementation(async (j: string) => j === "releve-mensuel-pret-2026-10");
    m.preparer.mockResolvedValue(tranche(0, 0));
    m.enqueue.mockClear();
    const r = await passerReleveMensuel(JOUR_2);
    expect(r).toMatchObject({ statut: "ok", alerte: false });
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("reprend les envois interrompus avant de préparer", async () => {
    await passerReleveMensuel(JOUR_1);
    expect(m.reprise).toHaveBeenCalledTimes(1);
    expect(m.reprise.mock.invocationCallOrder[0]).toBeLessThan(
      m.preparer.mock.invocationCallOrder[0]!,
    );
  });
});

describe("table absente", () => {
  it("P2021 : passage sauté et journalisé, aucune erreur, aucune alerte", async () => {
    m.reprise.mockRejectedValue(Object.assign(new Error("table"), { code: "P2021" }));
    const r = await passerReleveMensuel(JOUR_1);
    expect(r.statut).toBe("table_absente");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("table absente"));
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("une autre erreur remonte (le job échoue visiblement)", async () => {
    m.reprise.mockRejectedValue(new Error("base en panne"));
    await expect(passerReleveMensuel(JOUR_1)).rejects.toThrow("base en panne");
  });
});
