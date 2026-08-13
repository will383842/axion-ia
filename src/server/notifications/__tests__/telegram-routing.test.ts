// Tests routage Telegram — 8 groupes thématiques + 2 bots (refonte 2026-08-09).

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  telegramGroupFor,
  resolveTelegramTarget,
  resetTelegramGroupWarnings,
  ALL_NOTIFICATION_CATEGORIES,
  type TelegramGroup,
} from "../routing";
import type { NotificationCategory } from "../types";

describe("telegramGroupFor", () => {
  it("📅 Calendly : les 3 événements, et RIEN d'autre", () => {
    const calendly = ALL_NOTIFICATION_CATEGORIES.filter((c) => telegramGroupFor(c) === "calendly");
    expect(calendly.sort()).toEqual([
      "CALENDLY_INVITEE_CANCELED",
      "CALENDLY_INVITEE_CREATED",
      "CALENDLY_INVITEE_RESCHEDULED",
    ]);
  });

  it("💼 Candidatures : offre d'emploi + spontanée", () => {
    for (const c of ["JOB_APPLICATION_RECEIVED", "RECRUITMENT_RECEIVED"] as const) {
      expect(telegramGroupFor(c), c).toBe("candidatures");
    }
  });

  // Demande Will 2026-08-12 : l'offre monteur vidéo freelance a son propre salon,
  // ses candidatures ne se mélangent ni aux autres offres ni aux messages.
  it("🎬 Monteur vidéo : salon dédié, seul", () => {
    const monteur = ALL_NOTIFICATION_CATEGORIES.filter(
      (c) => telegramGroupFor(c) === "monteur-video",
    );
    expect(monteur).toEqual(["VIDEO_EDITOR_APPLICATION_RECEIVED"]);
  });

  // Même logique pour le tunnel commercial Mémorial de l'Isère (2026-08-12) :
  // une campagne de recrutement = un salon, jamais mélangée aux autres.
  it("🧲 Commercial Mémo : salon dédié, seul", () => {
    const memo = ALL_NOTIFICATION_CATEGORIES.filter(
      (c) => telegramGroupFor(c) === "commercial-memo",
    );
    expect(memo).toEqual(["COMMERCIAL_APPLICATION_RECEIVED"]);
  });

  it("📰 Presse · 💰 Investisseurs : un groupe chacun", () => {
    expect(telegramGroupFor("PRESS_REQUEST_SUBMITTED")).toBe("presse");
    expect(telegramGroupFor("INVESTOR_INQUIRY_RECEIVED")).toBe("investisseurs");
  });

  it("🛠️ Interventions : toute demande de prestation payante", () => {
    const cats: NotificationCategory[] = [
      "INTERVENTION_REQUEST_SUBMITTED",
      "AUDIT_REQUEST_SUBMITTED",
      "IMPLEMENTATION_REQUEST_SUBMITTED",
      "QUOTE_REQUEST_RECEIVED",
    ];
    for (const c of cats) expect(telegramGroupFor(c), c).toBe("interventions");
  });

  // Avant le 2026-08-09, `REVIEW_SUBMITTED` n'était dans aucun Set et tombait
  // donc dans le `return "system"` par défaut — au milieu des alertes techniques.
  // Personne ne l'avait décidé. Ce test verrouille la correction.
  it("⭐ Avis clients : sorti du groupe Système", () => {
    expect(telegramGroupFor("REVIEW_SUBMITTED")).toBe("avis");
  });

  it("💬 Messages : le reste de ce qu'écrit un humain", () => {
    const cats: NotificationCategory[] = [
      "CONTACT_FORM_SUBMITTED",
      "CUSTOMER_SUPPORT_REQUEST",
      "PODCAST_REQUEST_SUBMITTED",
      "SPEAKER_INVITATION_RECEIVED",
    ];
    for (const c of cats) expect(telegramGroupFor(c), c).toBe("messages");
  });

  it("🔔 Système : ops, newsletter, et le tunnel de réservation éteint", () => {
    const cats: NotificationCategory[] = [
      "NEWSLETTER_PENDING",
      "BACKUP_FAILED",
      "INCIDENT_DETECTED",
      "SECURITY_ALERT",
      "STRIPE_EVENT",
      "MONITORING_ALERT",
      "BOOKING_CREATED",
      "OPTION_POSTED",
    ];
    for (const c of cats) expect(telegramGroupFor(c), c).toBe("system");
  });

  it("chaque catégorie a un groupe valide (aucun trou)", () => {
    const groups: TelegramGroup[] = [
      "calendly",
      "candidatures",
      "monteur-video",
      "commercial-memo",
      "presse",
      "investisseurs",
      "interventions",
      "avis",
      "messages",
      "system",
    ];
    expect(ALL_NOTIFICATION_CATEGORIES.length).toBeGreaterThan(30);
    for (const c of ALL_NOTIFICATION_CATEGORIES) {
      expect(groups, c).toContain(telegramGroupFor(c));
    }
  });
});

describe("resolveTelegramTarget", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    resetTelegramGroupWarnings();
    // On part d'un environnement vierge : les variables réelles de la machine
    // de dev fausseraient les cas de repli.
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("TELEGRAM_")) delete process.env[k];
    }
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("groupe dédié : bot dédié + salon dédié", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CALENDLY_BOT_TOKEN = "bot-calendly";
    process.env.TELEGRAM_CHAT_ID_CALENDLY = "-100111";
    expect(resolveTelegramTarget("calendly")).toEqual({
      botToken: "bot-calendly",
      chatId: "-100111",
      dedicated: true,
    });
  });

  it("les 7 autres groupes utilisent le bot historique", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CHAT_ID_PRESSE = "-100222";
    expect(resolveTelegramTarget("presse")).toEqual({
      botToken: "bot-principal",
      chatId: "-100222",
      dedicated: true,
    });
  });

  // 🔴 LE test de ce module. Résoudre bot et salon séparément produirait ici
  // (bot-principal → salon Calendly) : or seul le bot Calendly est membre de ce
  // salon, donc Telegram répondrait « chat not found » et l'alerte de rendez-vous
  // disparaîtrait en silence. On exige le repli sur un couple qui fonctionne.
  it("salon Calendly configuré SANS son bot → repli, jamais un couple impossible", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CHAT_ID_CALENDLY = "-100111";
    process.env.TELEGRAM_CHAT_ID_RDV = "-100999";
    const target = resolveTelegramTarget("calendly");
    expect(target).toEqual({ botToken: "bot-principal", chatId: "-100999", dedicated: false });
    expect(target?.chatId).not.toBe("-100111");
  });

  // Tant que Will n'a pas créé les 6 nouveaux groupes, le déploiement ne doit
  // RIEN changer à ce qu'il reçoit. Ces 4 cas reproduisent le routage d'avant.
  it("sans les nouveaux groupes, le routage d'avant le 2026-08-09 est conservé", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CHAT_ID_RDV = "-rdv";
    process.env.TELEGRAM_CHAT_ID_MESSAGES = "-messages";
    process.env.TELEGRAM_CHAT_ID_SYSTEM = "-systeme";

    expect(resolveTelegramTarget("calendly")?.chatId).toBe("-rdv");
    expect(resolveTelegramTarget("candidatures")?.chatId).toBe("-messages");
    // Salon monteur vidéo pas encore créé → ces candidatures suivent le groupe
    // Candidatures (lui-même en repli Messages ici) : rien ne se perd.
    expect(resolveTelegramTarget("monteur-video")?.chatId).toBe("-messages");
    expect(resolveTelegramTarget("interventions")?.chatId).toBe("-messages");
    expect(resolveTelegramTarget("investisseurs")?.chatId).toBe("-messages");
    // L'avis tombait dans Système : on y retombe, pas dans Messages.
    expect(resolveTelegramTarget("avis")?.chatId).toBe("-systeme");
  });

  it("🧲 commercial mémo : repli sur Candidatures, salon dédié dès qu'il existe", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CHAT_ID_CANDIDATURES = "-candidatures";
    expect(resolveTelegramTarget("commercial-memo")).toEqual({
      botToken: "bot-principal",
      chatId: "-candidatures",
      dedicated: false,
    });
    process.env.TELEGRAM_CHAT_ID_COMMERCIAL_MEMO = "-memo";
    expect(resolveTelegramTarget("commercial-memo")).toEqual({
      botToken: "bot-principal",
      chatId: "-memo",
      dedicated: true,
    });
  });

  it("🎬 monteur vidéo : repli sur Candidatures, salon dédié dès qu'il existe", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CHAT_ID_CANDIDATURES = "-candidatures";
    expect(resolveTelegramTarget("monteur-video")).toEqual({
      botToken: "bot-principal",
      chatId: "-candidatures",
      dedicated: false,
    });
    process.env.TELEGRAM_CHAT_ID_MONTEUR_VIDEO = "-monteur";
    expect(resolveTelegramTarget("monteur-video")).toEqual({
      botToken: "bot-principal",
      chatId: "-monteur",
      dedicated: true,
    });
  });

  it("repli ultime sur TELEGRAM_CHAT_ID (mode 1-groupe historique)", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CHAT_ID = "-legacy";
    for (const g of ["calendly", "presse", "avis", "system"] as const) {
      expect(resolveTelegramTarget(g)?.chatId, g).toBe("-legacy");
    }
  });

  it("aucun bot configuré → undefined (et pas un envoi qui échouera)", () => {
    process.env.TELEGRAM_CHAT_ID_CALENDLY = "-100111";
    expect(resolveTelegramTarget("calendly")).toBeUndefined();
  });

  it("aucun salon configuré → undefined", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    expect(resolveTelegramTarget("presse")).toBeUndefined();
  });

  it("une valeur vide ou en espaces ne compte pas comme configurée", () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CHAT_ID_PRESSE = "   ";
    process.env.TELEGRAM_CHAT_ID_MESSAGES = "-messages";
    expect(resolveTelegramTarget("presse")?.chatId).toBe("-messages");
  });
});
