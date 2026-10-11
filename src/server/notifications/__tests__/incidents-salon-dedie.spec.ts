// Incidents de données (2026-10-11) — le salon Telegram réservé, ses replis, et
// le contenu du message : aucun texte saisi dans la fiche ne part sur Telegram.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { formatNotification, phraseAlerteIncident } from "../format";
import {
  getRouting,
  resetTelegramGroupWarnings,
  resolveTelegramTarget,
  shouldNotifyWhatsApp,
  telegramGroupFor,
} from "../routing";

describe("routage des incidents de données", () => {
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

  it("la catégorie vit dans le salon « incidents », Telegram seul, jamais WhatsApp", () => {
    expect(telegramGroupFor("DATA_INCIDENT_ALERT")).toBe("incidents");
    expect(getRouting("DATA_INCIDENT_ALERT").channels).toEqual(["telegram"]);
    expect(shouldNotifyWhatsApp("DATA_INCIDENT_ALERT")).toBe(false);
  });

  it("salon dédié configuré → il est utilisé, avec le bot historique", () => {
    process.env.TELEGRAM_CHAT_ID_INCIDENTS = "-100incidents";
    process.env.TELEGRAM_CHAT_ID_SYSTEM = "-100systeme";
    process.env.TELEGRAM_CHAT_ID = "-100general";
    expect(resolveTelegramTarget("incidents")).toEqual({
      botToken: "bot-principal",
      chatId: "-100incidents",
      dedicated: true,
    });
  });

  it("sans salon dédié → repli sur le salon Système", () => {
    process.env.TELEGRAM_CHAT_ID_SYSTEM = "-100systeme";
    process.env.TELEGRAM_CHAT_ID = "-100general";
    expect(resolveTelegramTarget("incidents")).toEqual({
      botToken: "bot-principal",
      chatId: "-100systeme",
      dedicated: false,
    });
  });

  it("ni dédié ni Système → repli sur le salon général", () => {
    process.env.TELEGRAM_CHAT_ID = "-100general";
    expect(resolveTelegramTarget("incidents")?.chatId).toBe("-100general");
  });

  it("une valeur vide compte comme absente", () => {
    process.env.TELEGRAM_CHAT_ID_INCIDENTS = "   ";
    process.env.TELEGRAM_CHAT_ID = "-100general";
    expect(resolveTelegramTarget("incidents")?.chatId).toBe("-100general");
  });
});

describe("message d'un incident de données", () => {
  const echeance = new Date("2026-10-14T07:30:00Z"); // 09:30 à Paris
  const avant = new Date("2026-10-11T10:00:00Z");

  it("déclaration : numéro, échéance à l'heure de Paris, et rien d'autre", () => {
    expect(phraseAlerteIncident(12, "declare", echeance, avant)).toBe(
      "🚨 Incident de données n° 12 déclaré. À traiter : déclaration à la CNIL à décider avant le 14 octobre 2026 à 09:30.",
    );
  });

  it("déclaration tardive : jamais « avant » une date passée", () => {
    const apres = new Date("2026-10-15T00:00:00Z");
    const phrase = phraseAlerteIncident(12, "declare", echeance, apres);
    expect(phrase).toContain("déjà dépassé");
    expect(phrase).not.toContain("à décider avant");
  });

  it("chaque palier a sa phrase", () => {
    expect(phraseAlerteIncident(3, "48h", echeance)).toContain("moins de 48 h");
    expect(phraseAlerteIncident(3, "24h", echeance)).toContain("moins de 24 h");
    expect(phraseAlerteIncident(3, "6h", echeance)).toContain("moins de 6 h");
    expect(phraseAlerteIncident(3, "depasse", echeance)).toContain("délai de 72 h dépassé");
  });

  it("le message Telegram porte le lien de la fiche, et seulement le numéro", () => {
    const { text } = formatNotification(
      {
        category: "DATA_INCIDENT_ALERT",
        payload: { numero: 12, palier: "declare", echeance: echeance.toISOString() },
      },
      "warn",
    );
    expect(text).toContain("INCIDENT DE DONNÉES");
    expect(text).toContain("conformite\\-rgpd/incidents/12");
    expect(text).toContain("Ouvrir la fiche");
  });
});
