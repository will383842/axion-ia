// Tests routage Telegram — 8 groupes thématiques + 2 bots (refonte 2026-08-09).

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  estCategorieClient,
  getRouting,
  groupeDeRepliClient,
  shouldNotifyWhatsApp,
  telegramGroupFor,
  resolveTelegramTarget,
  resolveSalonClients,
  resolveTelegramTargetPourCategorie,
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
  // 2026-09-27 — la RÉPONSE d'un candidat apporteur à son invitation y entre :
  // c'est la suite de la même conversation, pas une autre campagne.
  it("🧲 Commercial Mémo : salon dédié, seul", () => {
    const memo = ALL_NOTIFICATION_CATEGORIES.filter(
      (c) => telegramGroupFor(c) === "commercial-memo",
    );
    expect(memo).toEqual(["COMMERCIAL_APPLICATION_RECEIVED", "APPORTEUR_REPLIED"]);
  });

  it("📰 Presse · 💰 Investisseurs : un groupe chacun", () => {
    expect(telegramGroupFor("PRESS_REQUEST_SUBMITTED")).toBe("presse");
    expect(telegramGroupFor("INVESTOR_INQUIRY_RECEIVED")).toBe("investisseurs");
  });

  // Décision Will 15/10 : les demandes de prestation sont des CLIENTS. Le
  // groupe 🛠️ ne garde plus de catégorie propre : il ne sert plus que de REPLI
  // tant que le salon « Clients » n'existe pas (`groupeDeRepliClient`).
  it("🔥 Clients : formulaires, chatbot et rendez-vous des clients — et RIEN d'autre", () => {
    const clients = ALL_NOTIFICATION_CATEGORIES.filter((c) => telegramGroupFor(c) === "clients");
    expect(clients.sort()).toEqual(
      [
        "AUDIT_REQUEST_SUBMITTED",
        "CHATBOT_ESCALATION",
        "CHATBOT_LEAD_CAPTURED",
        "CLIENT_CALL_BOOKED",
        "CLIENT_CALL_CANCELED",
        "CLIENT_CALL_RESCHEDULED",
        "CONTACT_FORM_SUBMITTED",
        "CUSTOMER_SUPPORT_REQUEST",
        "IMPLEMENTATION_REQUEST_SUBMITTED",
        "INTERVENTION_REQUEST_SUBMITTED",
        "QUOTE_REQUEST_RECEIVED",
      ].sort(),
    );
  });

  it("🔥 Clients : le repli de chaque catégorie est SA route d'avant le 15/10", () => {
    const attendu: Record<string, TelegramGroup> = {
      CONTACT_FORM_SUBMITTED: "messages",
      CUSTOMER_SUPPORT_REQUEST: "messages",
      AUDIT_REQUEST_SUBMITTED: "interventions",
      INTERVENTION_REQUEST_SUBMITTED: "interventions",
      IMPLEMENTATION_REQUEST_SUBMITTED: "interventions",
      QUOTE_REQUEST_RECEIVED: "interventions",
      // Le chatbot passait par `MONITORING_ALERT`, donc 🔔 Système.
      CHATBOT_LEAD_CAPTURED: "system",
      CHATBOT_ESCALATION: "system",
      CLIENT_CALL_BOOKED: "calendly",
      CLIENT_CALL_CANCELED: "calendly",
      CLIENT_CALL_RESCHEDULED: "calendly",
    };
    for (const c of ALL_NOTIFICATION_CATEGORIES.filter(estCategorieClient)) {
      expect(groupeDeRepliClient(c), c).toBe(attendu[c]);
    }
  });

  // Avant le 2026-08-09, `REVIEW_SUBMITTED` n'était dans aucun Set et tombait
  // donc dans le `return "system"` par défaut — au milieu des alertes techniques.
  // Personne ne l'avait décidé. Ce test verrouille la correction.
  it("⭐ Avis clients : sorti du groupe Système", () => {
    expect(telegramGroupFor("REVIEW_SUBMITTED")).toBe("avis");
  });

  it("💬 Messages : le reste de ce qu'écrit un humain", () => {
    const cats: NotificationCategory[] = [
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
      // 🔥 Salon réservé aux clients (décision Will 15/10).
      "clients",
      "calendly",
      "candidatures",
      "monteur-video",
      "commercial-memo",
      "presse",
      "investisseurs",
      "interventions",
      "avis",
      "messages",
      // 🔗 Salon dédié aux anomalies de la synchro CRM (lot L5, 2026-08-14).
      "crm-sync",
      // 🚨 Salon réservé aux incidents de données (2026-10-11).
      "incidents",
      "system",
    ];
    expect(ALL_NOTIFICATION_CATEGORIES.length).toBeGreaterThan(30);
    for (const c of ALL_NOTIFICATION_CATEGORIES) {
      expect(groups, c).toContain(telegramGroupFor(c));
    }
  });
});

// B6 (décision Will, 2026-09-19) : les alertes disent désormais « apporteur » ou
// « client », mais AUCUN canal ni routage ne change. Ce cas fige l'état d'avant
// pour les deux catégories dont le TITRE a changé : si l'on y touchait en
// croyant « finir le travail », il rougirait.
describe("B6 — titres changés, canaux identiques", () => {
  it("réservation Calendly et candidat apporteur : mêmes canaux, même salon, même WhatsApp", () => {
    expect(getRouting("CALENDLY_INVITEE_CREATED")).toMatchObject({
      channels: ["telegram"],
      severity: "info",
    });
    expect(getRouting("COMMERCIAL_APPLICATION_RECEIVED")).toMatchObject({
      channels: ["telegram"],
      severity: "info",
    });
    expect(telegramGroupFor("CALENDLY_INVITEE_CREATED")).toBe("calendly");
    expect(telegramGroupFor("COMMERCIAL_APPLICATION_RECEIVED")).toBe("commercial-memo");
    // Décision Will 15/10 : WhatsApp ne sonne plus que pour les clients. La
    // réservation d'un client est `CLIENT_CALL_BOOKED` ; `CALENDLY_INVITEE_*`
    // ne porte plus que les échanges apporteur et formateur.
    expect(shouldNotifyWhatsApp("CALENDLY_INVITEE_CREATED")).toBe(false);
    expect(shouldNotifyWhatsApp("COMMERCIAL_APPLICATION_RECEIVED")).toBe(false);
    expect(shouldNotifyWhatsApp("CLIENT_CALL_BOOKED")).toBe(true);
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

// Décision Will 15/10 — le salon « Clients » : dédié s'il existe, sinon la route
// d'avant de CHAQUE catégorie, pour ne rien perdre.
describe("resolveTelegramTargetPourCategorie — salon « Clients »", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    resetTelegramGroupWarnings();
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("TELEGRAM_")) delete process.env[k];
    }
    process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
    process.env.TELEGRAM_CALENDLY_BOT_TOKEN = "bot-calendly";
    process.env.TELEGRAM_CHAT_ID_CALENDLY = "-calendly";
    process.env.TELEGRAM_CHAT_ID_MESSAGES = "-messages";
    process.env.TELEGRAM_CHAT_ID_INTERVENTIONS = "-interventions";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("sans TELEGRAM_CHAT_ID_CLIENTS : chaque catégorie garde sa route d'avant", () => {
    expect(resolveSalonClients()).toBeUndefined();
    expect(resolveTelegramTargetPourCategorie("CONTACT_FORM_SUBMITTED")?.chatId).toBe("-messages");
    expect(resolveTelegramTargetPourCategorie("AUDIT_REQUEST_SUBMITTED")?.chatId).toBe(
      "-interventions",
    );
    // Un rendez-vous client garde le salon ET le bot Calendly.
    expect(resolveTelegramTargetPourCategorie("CLIENT_CALL_BOOKED")).toEqual({
      botToken: "bot-calendly",
      chatId: "-calendly",
      dedicated: true,
    });
  });

  it("avec TELEGRAM_CHAT_ID_CLIENTS : bot historique + salon Clients pour tous les clients", () => {
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    for (const c of ALL_NOTIFICATION_CATEGORIES.filter(estCategorieClient)) {
      expect(resolveTelegramTargetPourCategorie(c), c).toEqual({
        botToken: "bot-principal",
        chatId: "-clients",
        dedicated: true,
      });
    }
  });

  it("🔴 client ≠ apporteur : un échange apporteur reste au salon 📅 Calendly", () => {
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    expect(resolveTelegramTargetPourCategorie("CALENDLY_INVITEE_CREATED")?.chatId).toBe(
      "-calendly",
    );
    expect(resolveTelegramTargetPourCategorie("COMMERCIAL_APPLICATION_RECEIVED")?.chatId).toBe(
      "-messages",
    );
  });
});
