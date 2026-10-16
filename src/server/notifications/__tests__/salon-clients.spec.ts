/**
 * Le salon Telegram « Clients » (décision Will 15/10).
 *
 * Will a manqué des demandes de clients : alertes allégées (prénom + initiale),
 * parties SANS SON, et mélangées aux autres. Ce fichier verrouille ce qui a été
 * décidé le 15/10 :
 *  - le salon « Clients » reçoit TOUT le détail, en texte brut, découpé sous
 *    4096 caractères, toujours avec son ;
 *  - sans salon dédié, chaque catégorie reprend sa route d'avant (allégée) ;
 *  - un envoi raté au salon retombe sur la route d'avant ;
 *  - fiabilité Telegram : dédoublonnage seulement après succès, 429, salon
 *    devenu supergroupe.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { notify, flushPendingDispatches } from "../index";
import { decouperPourTelegram, sendTelegramRaw, PLAFOND_TELEGRAM } from "../channels/telegram";
import { formatNotificationClient, type EvenementClient } from "../format-clients";
import { flushWhatsAppQueue, resetWhatsAppQueueForTests } from "../channels/whatsapp";

const redisSetMock = vi.fn();
const redisDelMock = vi.fn();
vi.mock("@/lib/redis", () => ({
  redis: {
    set: (...a: unknown[]) => redisSetMock(...a),
    del: (...a: unknown[]) => redisDelMock(...a),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
  },
}));

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;
const saved = { ...process.env };

/** Un formulaire de contact complet — données fictives. */
const DEMANDE = {
  submissionId: "sub_42",
  contactName: "Camille Exemple",
  contactEmail: "camille@exemple.fr",
  contactPhone: "+33 6 39 98 12 35",
  formType: "formation",
  ville: "Grenoble",
  companyName: "Atelier Fictif SARL",
  companySize: "pme",
  budgetIndicative: "10-20 k€",
  timingWeeks: "4-8",
  subType: "inter-entreprises",
  source: "page-formation",
  utmSource: "linkedin",
  utmCampaign: "automne",
  message: "Bonjour, nous voulons former 12 personnes. Merci !",
  submittedAt: "2026-10-15T12:30:00.000Z",
  locale: "fr" as const,
};

function corpsEnvoye(appel: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[appel]?.[1] as { body: string };
  return JSON.parse(init.body) as Record<string, unknown>;
}

function urls(): string[] {
  return fetchMock.mock.calls.map((c) => String(c[0]));
}

beforeEach(() => {
  fetchMock.mockReset();
  redisSetMock.mockReset().mockResolvedValue("OK");
  redisDelMock.mockReset().mockResolvedValue(1);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("TELEGRAM_") || k.startsWith("WHATSAPP_")) delete process.env[k];
  }
  process.env.TELEGRAM_BOT_TOKEN = "bot-principal";
  process.env.TELEGRAM_CHAT_ID_MESSAGES = "-messages";
  process.env.TELEGRAM_CHAT_ID_INTERVENTIONS = "-interventions";
  process.env.REDIS_URL = "redis://localhost:6381";
});

afterEach(async () => {
  await flushPendingDispatches();
  globalThis.fetch = originalFetch;
  process.env = { ...saved };
});

const ok = () => new Response('{"ok":true}', { status: 200 });

describe("le message complet du salon « Clients »", () => {
  it("🔥 première ligne, puis TOUTES les informations utiles pour répondre", () => {
    const texte = formatNotificationClient({
      category: "INTERVENTION_REQUEST_SUBMITTED",
      payload: DEMANDE,
    } as EvenementClient);
    const lignes = texte.split("\n");
    expect(lignes[0]).toBe("🔥 NOUVEAU CLIENT — Formation IA");
    // L'heure de Paris : 12:30 UTC = 14:30 à Paris en octobre.
    expect(lignes[1]).toMatch(/14:30.*heure de Paris/);
    for (const attendu of [
      "Nom : Camille Exemple",
      "Entreprise : Atelier Fictif SARL",
      "E-mail : camille@exemple.fr",
      "Téléphone : +33 6 39 98 12 35",
      "Ville : Grenoble",
      "Taille : PME",
      "Budget : 10-20 k€",
      "Délai : 4 à 8 semaines",
      "Sous-type : inter-entreprises",
      "Source : page-formation",
      "UTM : source linkedin · campagne automne",
      DEMANDE.message,
    ]) {
      expect(texte).toContain(attendu);
    }
    expect(texte).toMatch(/Fiche : https?:\/\/\S+\/contacts\/messages\/sub_42/);
  });

  it("🔴 les caractères spéciaux * _ [ ] ( ) . ! restent INTACTS (texte brut)", () => {
    const message = "Prix *net* _HT_ [devis](lien) 3.5 k€ ! (urgent) ~ > # + - = | { }";
    const texte = formatNotificationClient({
      category: "CONTACT_FORM_SUBMITTED",
      payload: { ...DEMANDE, formType: "autre", message },
    } as EvenementClient);
    expect(texte).toContain(message);
    expect(texte).not.toContain("\\");
  });

  it("annulation : le MOTIF ÉCRIT et qui a annulé", () => {
    const texte = formatNotificationClient({
      category: "CLIENT_CALL_CANCELED",
      payload: {
        eventUri: "evt_9",
        inviteeEmail: "camille@exemple.fr",
        inviteeName: "Camille Exemple",
        inviteePhone: "+33 6 39 98 12 35",
        eventName: "Diagnostic IA (30 min)",
        eventStartTime: "2026-10-20T08:00:00.000Z",
        reason: "Empêchement : réunion de dernière minute.",
        canceledBy: "Camille Exemple",
        cancelerType: "invitee",
      },
    } as EvenementClient);
    expect(texte.split("\n")[0]).toBe("❌ ANNULATION CLIENT — Diagnostic IA (30 min)");
    expect(texte).toContain("Motif :\nEmpêchement : réunion de dernière minute.");
    expect(texte).toContain("Annulé par : Camille Exemple");
    expect(texte).toContain("Téléphone : +33 6 39 98 12 35");
  });

  it("annulation sans motif : le dit, plutôt que d'inventer", () => {
    const texte = formatNotificationClient({
      category: "CLIENT_CALL_CANCELED",
      payload: { eventUri: "evt_9", inviteeEmail: "camille@exemple.fr" },
    } as EvenementClient);
    expect(texte).toContain("(aucun motif écrit)");
    expect(texte).not.toContain("Annulation constatée");
  });

  it("réservation : type, début, format, lieu, téléphone, réponses, lien d'annulation", () => {
    const texte = formatNotificationClient({
      category: "CLIENT_CALL_BOOKED",
      payload: {
        eventUri: "evt_7",
        inviteeEmail: "camille@exemple.fr",
        inviteeName: "Camille Exemple",
        inviteePhone: "+33 6 39 98 12 35",
        eventStartTime: "2026-10-20T08:00:00.000Z",
        eventName: "Diagnostic IA (30 min)",
        typeRendezVous: "diagnostic",
        format: "visio",
        lieu: "https://meet.exemple.fr/abc",
        answersText: "Effectif : 12",
        cancelUrl: "https://calendly.com/cancellations/xyz",
      },
    } as EvenementClient);
    expect(texte.split("\n")[0]).toBe("🔥 NOUVEAU CLIENT — Diagnostic IA réservé");
    for (const attendu of [
      "Début : 20 oct. 2026, 10:00",
      "Format : Visio",
      "Lieu : https://meet.exemple.fr/abc",
      "Téléphone : +33 6 39 98 12 35",
      "Effectif : 12",
      "Annuler / déplacer : https://calendly.com/cancellations/xyz",
    ]) {
      expect(texte).toContain(attendu);
    }
  });
});

describe("découpe sous 4096 caractères", () => {
  it("un message long est découpé, chaque morceau sous le plafond, rien n'est perdu", () => {
    const long = Array.from({ length: 300 }, (_, i) => `Ligne ${i} : ${"x".repeat(40)}`).join("\n");
    const morceaux = decouperPourTelegram(long);
    expect(morceaux.length).toBeGreaterThan(1);
    for (const m of morceaux) expect(m.length).toBeLessThanOrEqual(PLAFOND_TELEGRAM);
    const recolle = morceaux.map((m) => m.replace(/^\(suite \d+\/\d+\)\n/, "")).join("\n");
    expect(recolle).toBe(long);
    expect(morceaux[1]).toMatch(/^\(suite 2\/\d+\)\n/);
  });

  it("une ligne unique géante est coupée net, sans rien perdre", () => {
    const geant = "y".repeat(9000);
    const morceaux = decouperPourTelegram(geant);
    for (const m of morceaux) expect(m.length).toBeLessThanOrEqual(PLAFOND_TELEGRAM);
    expect(morceaux.map((m) => m.replace(/^\(suite \d+\/\d+\)\n/, "")).join("")).toBe(geant);
  });

  it("un message court reste un seul message, sans mention", () => {
    expect(decouperPourTelegram("court")).toEqual(["court"]);
  });

  // Relecture PR 1553 : `slice(0, place)` pouvait couper une paire de
  // substitution UTF-16 (un emoji) en deux — Telegram affiche alors « � ».
  const DEMI_PAIRE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  const sansMention = (m: string) => m.replace(/^\(suite \d+\/\d+\)\n/, "");

  it("🔴 une ligne d'emojis n'est jamais coupée au milieu d'une paire de substitution", () => {
    // Le « a » décale d'une unité : la coupe d'avant tombait EN PLEINE paire.
    const ligne = `a${"😀".repeat(3000)}`;
    const morceaux = decouperPourTelegram(ligne);
    expect(morceaux.length).toBeGreaterThan(1);
    for (const m of morceaux) {
      expect(m.length).toBeLessThanOrEqual(PLAFOND_TELEGRAM);
      expect(DEMI_PAIRE.test(m), "aucune moitié d'emoji").toBe(false);
    }
    expect(morceaux.map(sansMention).join("")).toBe(ligne);
  });

  it("un emoji composé (famille, ZWJ) reste d'un seul tenant", () => {
    const famille = "👨‍👩‍👧";
    const ligne = `ab${famille.repeat(1200)}`;
    const morceaux = decouperPourTelegram(ligne).map(sansMention);
    expect(morceaux.length).toBeGreaterThan(1);
    for (const m of morceaux.slice(1)) expect(m.startsWith(famille)).toBe(true);
    expect(morceaux.join("")).toBe(ligne);
  });
});

describe("notify() → salon « Clients »", () => {
  it("🔴 salon dédié : texte BRUT (sans parse_mode), complet, AVEC SON", async () => {
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    fetchMock.mockImplementation(async () => ok());
    const r = await notify({ category: "CONTACT_FORM_SUBMITTED", payload: DEMANDE });
    expect(r.channels.telegram).toBe("sent");
    const corps = corpsEnvoye(0);
    expect(corps["chat_id"]).toBe("-clients");
    expect(corps["parse_mode"]).toBeUndefined();
    expect(corps["disable_notification"]).toBe(false);
    expect(String(corps["text"])).toContain("camille@exemple.fr");
    expect(String(corps["text"])).toContain(DEMANDE.message);
  });

  it("message long : plusieurs envois, tous au salon, tous avec son", async () => {
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    fetchMock.mockImplementation(async () => ok());
    const message = Array.from({ length: 200 }, (_, i) => `Paragraphe ${i} du besoin.`).join("\n");
    await notify({ category: "CONTACT_FORM_SUBMITTED", payload: { ...DEMANDE, message } });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    for (let i = 0; i < fetchMock.mock.calls.length; i++) {
      const corps = corpsEnvoye(i);
      expect(corps["chat_id"]).toBe("-clients");
      expect(corps["disable_notification"]).toBe(false);
      expect(String(corps["text"]).length).toBeLessThanOrEqual(PLAFOND_TELEGRAM);
    }
  });

  it("sans TELEGRAM_CHAT_ID_CLIENTS : route d'avant, gabarit ALLÉGÉ, mais AVEC SON", async () => {
    fetchMock.mockImplementation(async () => ok());
    const r = await notify({ category: "CONTACT_FORM_SUBMITTED", payload: DEMANDE });
    expect(r.channels.telegram).toBe("sent");
    const corps = corpsEnvoye(0);
    expect(corps["chat_id"]).toBe("-messages");
    expect(corps["parse_mode"]).toBe("MarkdownV2");
    expect(corps["disable_notification"]).toBe(false);
    expect(String(corps["text"])).not.toContain("camille@exemple.fr");
    expect(String(corps["text"])).not.toContain("Exemple ");
  });

  it("🔴 salon dédié en échec : dernier essai vers la route d'avant (allégé)", async () => {
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    fetchMock
      .mockImplementationOnce(async () => new Response('{"ok":false}', { status: 403 }))
      .mockImplementation(async () => ok());
    const r = await notify({ category: "AUDIT_REQUEST_SUBMITTED", payload: DEMANDE });
    expect(r.channels.telegram).toBe("sent");
    expect(corpsEnvoye(0)["chat_id"]).toBe("-clients");
    expect(corpsEnvoye(1)["chat_id"]).toBe("-interventions");
    expect(String(corpsEnvoye(1)["text"])).not.toContain("camille@exemple.fr");
  });

  it("les autres salons gardent le comportement d'avant (presse : silencieux, allégé)", async () => {
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    fetchMock.mockImplementation(async () => ok());
    await notify({
      category: "PRESS_REQUEST_SUBMITTED",
      payload: {
        submissionId: "sub_1",
        contactName: "Camille Exemple",
        contactEmail: "camille@exemple.fr",
        locale: "fr",
      },
    });
    const corps = corpsEnvoye(0);
    expect(corps["chat_id"]).toBe("-messages");
    expect(corps["disable_notification"]).toBe(true);
    expect(String(corps["text"])).not.toContain("camille@exemple.fr");
  });

  it("WhatsApp : la sonnette d'un client ne porte aucune donnée personnelle", async () => {
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    process.env.WHATSAPP_CALLMEBOT_APIKEY = "123456";
    process.env.WHATSAPP_NOTIFY_PHONE = "+33639981235";
    fetchMock.mockImplementation(async () => ok());
    resetWhatsAppQueueForTests();
    const r = await notify({ category: "INTERVENTION_REQUEST_SUBMITTED", payload: DEMANDE });
    // #1554 : WhatsApp passe par une file avec relances ; l'envoi part en arrière-plan.
    expect(r.channels.whatsapp).toBe("queued");
    await flushWhatsAppQueue();
    const url = decodeURIComponent(urls().find((u) => u.includes("callmebot")) ?? "");
    expect(url).toContain("🔥 NOUVEAU CLIENT · Formation IA · ");
    expect(url).toContain("tout le détail dans Telegram (salon Clients)");
    for (const pii of ["Camille", "camille@", "39 98", "Grenoble", "Atelier", "former 12"]) {
      expect(url).not.toContain(pii);
    }
  });
});

describe("fiabilité Telegram (décision Will 15/10)", () => {
  it("🔴 dédoublonnage : la clé est RETIRÉE quand l'envoi échoue", async () => {
    fetchMock.mockImplementation(async () => new Response('{"ok":false}', { status: 500 }));
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "sub_42",
    });
    expect(r.channels.telegram).toBe("failed");
    expect(redisDelMock).toHaveBeenCalledWith("notif:dedup:CONTACT_FORM_SUBMITTED:sub_42");
  });

  it("🔴 dédoublonnage : un 1er morceau parti garde la clé, même si la suite échoue", async () => {
    // Relecture PR 1553 : la clé libérée, un rejeu renvoyait le 1er morceau en
    // DOUBLE au salon. Un morceau arrivé vaut une alerte commencée.
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    fetchMock
      .mockImplementationOnce(async () => ok())
      .mockImplementation(async () => new Response('{"ok":false}', { status: 500 }));
    const message = Array.from({ length: 200 }, (_, i) => `Paragraphe ${i} du besoin.`).join("\n");
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: { ...DEMANDE, message },
      dedupKey: "sub_42",
    });
    expect(r.channels.telegram, "le reste n'est pas parti, ni au salon ni au repli").toBe("failed");
    expect(corpsEnvoye(0)["chat_id"]).toBe("-clients");
    expect(corpsEnvoye(1)["chat_id"]).toBe("-clients");
    expect(corpsEnvoye(2)["chat_id"]).toBe("-messages");
    expect(redisDelMock).not.toHaveBeenCalled();
  });

  it("dédoublonnage : un repli seul arrivé garde aussi la clé", async () => {
    process.env.TELEGRAM_CHAT_ID_CLIENTS = "-clients";
    fetchMock
      .mockImplementationOnce(async () => new Response('{"ok":false}', { status: 500 }))
      .mockImplementation(async () => ok());
    const r = await notify({
      category: "CONTACT_FORM_SUBMITTED",
      payload: DEMANDE,
      dedupKey: "sub_42",
    });
    expect(r.channels.telegram).toBe("sent");
    expect(redisDelMock).not.toHaveBeenCalled();
  });

  it("dédoublonnage : la clé RESTE après un envoi réussi", async () => {
    fetchMock.mockImplementation(async () => ok());
    await notify({ category: "CONTACT_FORM_SUBMITTED", payload: DEMANDE, dedupKey: "sub_42" });
    expect(redisSetMock).toHaveBeenCalled();
    expect(redisDelMock).not.toHaveBeenCalled();
  });

  it("429 : attend `retry_after` puis réessaie UNE fois", async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockImplementationOnce(
          async () => new Response('{"ok":false,"parameters":{"retry_after":2}}', { status: 429 }),
        )
        .mockImplementation(async () => ok());
      const envoi = sendTelegramRaw({ text: "x", chatId: "-1", botToken: "b" });
      await vi.advanceTimersByTimeAsync(2_000);
      expect(await envoi).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("429 : l'attente est plafonnée à 5 s, et un second 429 n'est pas réessayé", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(
        async () => new Response('{"ok":false,"parameters":{"retry_after":60}}', { status: 429 }),
      );
      const envoi = sendTelegramRaw({ text: "x", chatId: "-1", botToken: "b" });
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await envoi).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("🔴 salon devenu supergroupe : renvoi au `migrate_to_chat_id`, et signalement", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockImplementationOnce(
        async () =>
          new Response(
            '{"ok":false,"description":"group chat was upgraded to a supergroup chat","parameters":{"migrate_to_chat_id":-1001234567890}}',
            { status: 400 },
          ),
      )
      .mockImplementation(async () => ok());
    const okEnvoi = await sendTelegramRaw({ text: "x", chatId: "-4242", botToken: "b" });
    expect(okEnvoi).toBe(true);
    expect(corpsEnvoye(1)["chat_id"]).toBe("-1001234567890");
    expect(erreur.mock.calls.flat().join(" ")).toContain("-1001234567890");
    erreur.mockRestore();
  });
});
