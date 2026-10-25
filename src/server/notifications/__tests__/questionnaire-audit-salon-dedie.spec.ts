// Questionnaire avant audit (2026-10-26) — le salon Telegram « Questionnaire audit », ses replis
// (Clients, puis Système, puis le général : décision du 25/10/2026) et le message (10 lignes au
// plus, ni adresse, ni nom complet, ni contenu de réponse). Jamais WhatsApp.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendTelegramRaw } from "../channels/telegram";

import { formatNotification } from "../format";
import {
  getRouting,
  resetTelegramGroupWarnings,
  resolveTelegramTargetPourCategorie,
  shouldNotifyWhatsApp,
  telegramGroupFor,
} from "../routing";

describe("routage du questionnaire avant audit", () => {
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

  it("les 2 catégories vivent dans le salon dédié, Telegram seul ; la réponse sonne, le suivi non", () => {
    for (const c of ["QUESTIONNAIRE_PREAUDIT_REPONSE", "QUESTIONNAIRE_PREAUDIT_SUIVI"] as const) {
      expect(telegramGroupFor(c)).toBe("questionnaire-audit");
      expect(getRouting(c).channels).toEqual(["telegram"]);
      expect(shouldNotifyWhatsApp(c)).toBe(false);
    }
    expect(getRouting("QUESTIONNAIRE_PREAUDIT_REPONSE").severity).toBe("warn");
    expect(getRouting("QUESTIONNAIRE_PREAUDIT_SUIVI").severity).toBe("info");
  });

  it("salon dédié, puis Clients, puis Système, puis le général", () => {
    const cible = () => resolveTelegramTargetPourCategorie("QUESTIONNAIRE_PREAUDIT_REPONSE");
    process.env.TELEGRAM_CHAT_ID = "-100general";
    expect(cible()?.chatId).toBe("-100general");
    process.env.TELEGRAM_CHAT_ID_SYSTEM = "-100systeme";
    expect(cible()?.chatId).toBe("-100systeme");
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-100clients";
    expect(cible()?.chatId).toBe("-100clients");
    process.env.TELEGRAM_CHAT_ID_QUESTIONNAIRE_AUDIT = "-100questionnaire";
    expect(cible()).toEqual({
      botToken: "bot-principal",
      chatId: "-100questionnaire",
      dedicated: true,
    });
  });
});

describe("message du questionnaire avant audit", () => {
  it("réponse reçue : société, prénom + initiale, réponses, prochaine relance, lien ; 10 lignes au plus", () => {
    const { text } = formatNotification(
      {
        category: "QUESTIONNAIRE_PREAUDIT_REPONSE",
        payload: {
          evenement: "reponse",
          societe: "OURY CRÉATION",
          qui: "Flora P.",
          parcours: "collaborateur",
          recues: 3,
          attendues: 7,
          dirigeantARepondu: false,
          prochaine: "mer. 4 nov. à 9 h 30",
          chemin: "rendez-vous/rencontres/r1#questionnaire-avant-audit",
        },
      },
      "warn",
    );
    expect(text).toContain("QUESTIONNAIRE AUDIT");
    expect(text).toContain("réponse reçue");
    expect(text).toContain("OURY CRÉATION");
    expect(text).toContain("Flora P\\. \\(collaborateur\\)");
    expect(text).toContain("3 reçues sur 7 attendues \\(dirigeant : pas encore\\)");
    expect(text).toContain("mer\\. 4 nov\\. à 9 h 30");
    expect(text).toContain("rendez\\-vous/rencontres/r1");
    expect(text.split("\n").length).toBeLessThanOrEqual(10);
  });

  it("« ? » tant que le dirigeant n'a pas répondu ; essai préfixé ; motifs lisibles", () => {
    const corps = (payload: Record<string, unknown>, cat = "QUESTIONNAIRE_PREAUDIT_SUIVI") =>
      formatNotification({ category: cat, payload } as never, "info").text;
    expect(
      corps(
        { evenement: "reponse", societe: "X", recues: 1, attendues: null, chemin: "c" },
        "QUESTIONNAIRE_PREAUDIT_REPONSE",
      ),
    ).toContain("1 reçue \\(nombre attendu connu après la réponse du dirigeant\\)");
    expect(
      corps({ evenement: "relance", rang: 2, essai: true, societe: "X", chemin: "c" }),
    ).toContain("ESSAI · Relance 2 sur 3 partie");
    expect(
      corps({ evenement: "arret", motif: "reponse_dirigeant", societe: "X", chemin: "c" }),
    ).toContain("Relances arrêtées : réponse du dirigeant");
    expect(
      corps({
        evenement: "invitation",
        prochaine: "27/10, 30/10, 04/11",
        societe: "X",
        chemin: "c",
      }),
    ).toContain("Rappels prévus");
  });
});

describe("aperçu de lien du salon « Questionnaire audit »", () => {
  const corpsEnvoye = async (sansApercuLien?: boolean) => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await sendTelegramRaw({
        text: "x",
        chatId: "-100q",
        botToken: "t",
        ...(sansApercuLien ? { sansApercuLien } : {}),
      });
      const appels = fetchMock.mock.calls as unknown as Array<[string, { body: string }]>;
      return JSON.parse(appels[0]![1].body) as Record<string, unknown>;
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it("coupe l'aperçu quand l'option est posée", async () => {
    expect((await corpsEnvoye(true)).link_preview_options).toEqual({ is_disabled: true });
  });

  it("ne change pas les autres salons", async () => {
    expect(await corpsEnvoye()).not.toHaveProperty("link_preview_options");
  });
});
