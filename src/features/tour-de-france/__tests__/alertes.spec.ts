// @vitest-environment node

/**
 * L'alerte Telegram d'une mini-demande : l'interrupteur, le contenu sans donnée personnelle, le
 * seuil (`>=`), la déduplication, et le fait que rien ne lève jamais.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  notify: vi.fn(async (..._a: unknown[]) => ({ ok: true })),
  count: vi.fn(async (..._a: unknown[]) => 1),
  captureException: vi.fn(),
  after: vi.fn((cb: () => unknown) => {
    void cb();
  }),
}));

vi.mock("@/server/notifications", () => ({ notify: m.notify }));
vi.mock("@/lib/prisma", () => ({ prisma: { tourDemande: { count: m.count } } }));
vi.mock("@sentry/nextjs", () => ({ captureException: m.captureException }));
vi.mock("next/server", () => ({ after: m.after }));

import { envoyerAlertesDemande, programmerAlerteDemande, tourTelegramActif } from "../alertes";
import type { DemandeEnregistree } from "../enregistrer";

const LYON: DemandeEnregistree = {
  id: "d1",
  compte: true,
  rattachement: "a_verifier",
  villeCle: "lyon",
  villeNom: "Lyon",
};

type Appel = { category: string; payload: Record<string, unknown>; dedupKey: string };
const appels = (): Appel[] => m.notify.mock.calls.map((c) => c[0] as Appel);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TOUR_TELEGRAM_ENABLED;
  m.notify.mockResolvedValue({ ok: true });
  m.count.mockResolvedValue(1);
  m.after.mockImplementation((cb: () => unknown) => {
    void cb();
  });
});
afterEach(() => {
  delete process.env.TOUR_TELEGRAM_ENABLED;
});

describe("l'interrupteur", () => {
  it("allumé par défaut ; seule la valeur « false » l'éteint", () => {
    expect(tourTelegramActif()).toBe(true);
    process.env.TOUR_TELEGRAM_ENABLED = "true";
    expect(tourTelegramActif()).toBe(true);
    process.env.TOUR_TELEGRAM_ENABLED = "n importe quoi";
    expect(tourTelegramActif()).toBe(true);
    process.env.TOUR_TELEGRAM_ENABLED = "false";
    expect(tourTelegramActif()).toBe(false);
  });

  it("éteint : ni lecture de la base, ni notification", async () => {
    process.env.TOUR_TELEGRAM_ENABLED = "false";
    await envoyerAlertesDemande(LYON);
    expect(m.count).not.toHaveBeenCalled();
    expect(m.notify).not.toHaveBeenCalled();
  });
});

describe("envoyerAlertesDemande", () => {
  it("compte les demandes comptées de la ville, hors écartées", async () => {
    await envoyerAlertesDemande(LYON);
    expect(m.count).toHaveBeenCalledWith({
      where: { villeCle: "lyon", compte: true, statut: { not: "ecartee" } },
    });
  });

  it("nouvelle demande : ville, compteur, compte ; clé de déduplication par demande", async () => {
    m.count.mockResolvedValue(3);
    await envoyerAlertesDemande(LYON);
    expect(appels()).toHaveLength(1);
    expect(m.notify).toHaveBeenCalledWith({
      category: "TOUR_DEMANDE_RECUE",
      payload: { ville: "Lyon", villeCle: "lyon", comptees: 3, seuil: 5, compte: true },
      dedupKey: "tour-demande:d1",
      dedupTtlSec: 3600,
    });
  });

  it("ville hors liste : « ville hors liste », ni clé ni texte saisi, pas d'alerte d'ouverture", async () => {
    m.count.mockResolvedValue(9);
    await envoyerAlertesDemande({
      ...LYON,
      villeCle: "?village-secret-tape-par-la-personne",
      villeNom: null,
    });
    const tout = JSON.stringify(m.notify.mock.calls);
    expect(tout).toContain("ville hors liste");
    expect(tout).not.toContain("village-secret");
    expect(appels()).toHaveLength(1);
    expect(appels()[0]?.payload).toMatchObject({ villeCle: null });
  });

  it("4 comptées : pas d'ouverture ; 5 : ouverture avec la clé de la ville", async () => {
    m.count.mockResolvedValue(4);
    await envoyerAlertesDemande(LYON);
    expect(appels().map((a) => a.category)).toEqual(["TOUR_DEMANDE_RECUE"]);

    vi.clearAllMocks();
    m.count.mockResolvedValue(5);
    await envoyerAlertesDemande(LYON);
    expect(appels().map((a) => a.category)).toEqual(["TOUR_DEMANDE_RECUE", "TOUR_VILLE_OUVERTE"]);
    expect(m.notify).toHaveBeenLastCalledWith({
      category: "TOUR_VILLE_OUVERTE",
      payload: { ville: "Lyon", villeCle: "lyon", comptees: 5, seuil: 5 },
      dedupKey: "tour-ville-ouverte:lyon",
      dedupTtlSec: 400 * 24 * 3600,
    });
  });

  it("doublon (compte: false) à 6 : pas d'ouverture ; demande comptée à 6 : ouverture (>=)", async () => {
    m.count.mockResolvedValue(6);
    await envoyerAlertesDemande({ ...LYON, compte: false });
    expect(appels().map((a) => a.category)).toEqual(["TOUR_DEMANDE_RECUE"]);
    expect(appels()[0]?.payload).toMatchObject({ compte: false });

    vi.clearAllMocks();
    m.count.mockResolvedValue(6);
    await envoyerAlertesDemande(LYON);
    expect(appels().map((a) => a.category)).toContain("TOUR_VILLE_OUVERTE");
  });

  it("aucune donnée personnelle dans ce qui part", async () => {
    m.count.mockResolvedValue(5);
    await envoyerAlertesDemande(LYON);
    const tout = JSON.stringify(m.notify.mock.calls);
    expect(tout).not.toMatch(/@|email|telephone|ipHash|villeSaisie/i);
  });

  it("notify qui lève : aucune exception, Sentry prévenu", async () => {
    m.notify.mockRejectedValue(new Error("telegram"));
    await expect(envoyerAlertesDemande(LYON)).resolves.toBeUndefined();
    expect(m.captureException).toHaveBeenCalledTimes(1);
  });

  it("count qui lève : aucune exception, aucune notification", async () => {
    m.count.mockRejectedValue(new Error("base"));
    await expect(envoyerAlertesDemande(LYON)).resolves.toBeUndefined();
    expect(m.notify).not.toHaveBeenCalled();
    expect(m.captureException).toHaveBeenCalledTimes(1);
  });
});

describe("programmerAlerteDemande", () => {
  it("programme l'envoi après la réponse", async () => {
    programmerAlerteDemande(LYON);
    expect(m.after).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(m.notify).toHaveBeenCalledTimes(1));
  });

  it("`after` qui lève : l'envoi part quand même, sans exception", async () => {
    m.after.mockImplementation(() => {
      throw new Error("hors requête");
    });
    expect(() => programmerAlerteDemande(LYON)).not.toThrow();
    await vi.waitFor(() => expect(m.notify).toHaveBeenCalledTimes(1));
  });
});
