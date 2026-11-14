// Candidatures et recrutement MUETS depuis le 14/11/2026 (décision du fondateur).
// Une seule liste réversible : `CATEGORIES_SANS_ALERTE`. Retirer une ligne rallume la route.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { flushPendingDispatches, notify } from "../index";
import {
  ALL_NOTIFICATION_CATEGORIES,
  CATEGORIES_SANS_ALERTE,
  estCategorieClient,
  getRouting,
  telegramGroupFor,
} from "../routing";
import type { NotificationCategory, NotifyInput } from "../types";

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}));

const GROUPES_COUPES = new Set(["candidatures", "monteur-video", "commercial-memo"]);

/**
 * Deux alertes PROTECTRICES restent actives, bien qu'elles vivent dans le salon des candidatures
 * (décision du fondateur, 14/11/2026) :
 * - `TRAINER_CHANGEMENT_DEMANDE` : garde anti-fraude au changement de coordonnées ;
 * - `CANDIDAT_SELF_ERASED` : effacement demandé par la personne, le fondateur est alerté et décide.
 */
const EXCEPTIONS_PROTECTRICES: NotificationCategory[] = [
  "TRAINER_CHANGEMENT_DEMANDE",
  "CANDIDAT_SELF_ERASED",
];

const fetchMock = vi.fn();

describe("candidatures muettes", () => {
  const fetchOriginal = globalThis.fetch;
  const envOriginal = { ...process.env };

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.TELEGRAM_BOT_TOKEN = "bot";
    process.env.TELEGRAM_CHAT_ID = "-general";
    process.env.REDIS_URL = "redis://localhost:6381";
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    process.env = { ...envOriginal };
  });

  it("la liste = les catégories des 3 groupes candidatures, moins les 2 exceptions protectrices", () => {
    const attendues = ALL_NOTIFICATION_CATEGORIES.filter(
      (c) => GROUPES_COUPES.has(telegramGroupFor(c)) && !EXCEPTIONS_PROTECTRICES.includes(c),
    ).sort();
    expect([...CATEGORIES_SANS_ALERTE].sort()).toEqual(attendues);
    expect(CATEGORIES_SANS_ALERTE.size).toBe(11);
  });

  it("les deux alertes protectrices gardent leur route", () => {
    for (const c of EXCEPTIONS_PROTECTRICES) {
      expect(CATEGORIES_SANS_ALERTE.has(c), c).toBe(false);
      expect(getRouting(c).channels, c).toEqual(["telegram"]);
    }
  });

  it("aucune catégorie client ni Calendly dans la liste", () => {
    for (const c of CATEGORIES_SANS_ALERTE) {
      expect(estCategorieClient(c), c).toBe(false);
      expect(c.startsWith("CALENDLY_"), c).toBe(false);
      expect(c.startsWith("CLIENT_CALL_"), c).toBe(false);
    }
  });

  it("`getRouting` rend aucun canal pour chaque catégorie muette", () => {
    for (const c of CATEGORIES_SANS_ALERTE) expect(getRouting(c).channels, c).toEqual([]);
  });

  it("notify() : `channels` vide et aucun appel réseau", async () => {
    for (const category of CATEGORIES_SANS_ALERTE) {
      const r = await notify({
        category,
        payload: {},
        sync: true,
      } as unknown as NotifyInput);
      expect(r, category).toEqual({ ok: true, channels: {} });
    }
    await flushPendingDispatches();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retirer une catégorie de la liste rend sa route", () => {
    const c: NotificationCategory = "CANDIDAT_REPLIED";
    const mutable = CATEGORIES_SANS_ALERTE as Set<NotificationCategory>;
    expect(getRouting(c).channels).toEqual([]);
    mutable.delete(c);
    try {
      expect(getRouting(c).channels).toEqual(["telegram"]);
    } finally {
      mutable.add(c);
    }
    expect(getRouting(c).channels).toEqual([]);
  });
});
