// Tour France IA (2026-10-29) : le salon Telegram « Tour » et ses replis (Clients, puis Système,
// puis le général). Les deux alertes sont Telegram seul : jamais WhatsApp.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getRouting,
  resetTelegramGroupWarnings,
  resolveTelegramTargetPourCategorie,
  shouldNotifyWhatsApp,
  telegramGroupFor,
} from "../routing";

const CATEGORIES = ["TOUR_DEMANDE_RECUE", "TOUR_VILLE_OUVERTE"] as const;

describe("routage des alertes du Tour France IA", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    resetTelegramGroupWarnings();
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("TELEGRAM_")) delete process.env[k];
    }
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("les 2 catégories vivent dans le salon « tour », Telegram seul, sévérité warn", () => {
    for (const c of CATEGORIES) {
      expect(telegramGroupFor(c)).toBe("tour");
      expect(getRouting(c).channels).toEqual(["telegram"]);
      expect(getRouting(c).severity).toBe("warn");
      expect(shouldNotifyWhatsApp(c)).toBe(false);
    }
    expect(getRouting("TOUR_DEMANDE_RECUE").rateLimitPerHour).toBe(20);
    expect(getRouting("TOUR_VILLE_OUVERTE").rateLimitPerHour).toBe(6);
  });

  it("salon dédié, puis Clients, puis Système, puis le général", () => {
    const cible = () => resolveTelegramTargetPourCategorie("TOUR_DEMANDE_RECUE");
    process.env.TELEGRAM_CHAT_ID = "-100general";
    expect(cible()?.chatId).toBe("-100general");
    process.env.TELEGRAM_CHAT_ID_SYSTEM = "-100systeme";
    expect(cible()?.chatId).toBe("-100systeme");
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-100clients";
    expect(cible()?.chatId).toBe("-100clients");
    process.env.TELEGRAM_CHAT_ID_TOUR = "-100tour";
    expect(cible()).toEqual({ botToken: "bot-principal", chatId: "-100tour", dedicated: true });
  });
});
