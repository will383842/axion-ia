// Tests format.ts — escapeMarkdownV2 + formatNotification (Sprint Notif Infra 2026-05-26).

import { describe, it, expect } from "vitest";
import { escapeMarkdownV2, formatNotification, formatParisDateTime } from "../format";

describe("escapeMarkdownV2", () => {
  it("échappe les 18 caractères réservés MarkdownV2", () => {
    const input = "_*[]()~`>#+-=|{}.!";
    const out = escapeMarkdownV2(input);
    // Chaque char devrait être préfixé par "\".
    for (const c of input) {
      expect(out).toContain(`\\${c}`);
    }
  });

  it("n'échappe pas les lettres ni les chiffres", () => {
    expect(escapeMarkdownV2("Bonjour 42")).toBe("Bonjour 42");
  });

  it("échappe les antislashes", () => {
    expect(escapeMarkdownV2("a\\b")).toBe("a\\\\b");
  });

  it("traite les emails (point + tirets)", () => {
    expect(escapeMarkdownV2("user@axion-ia.com")).toBe("user@axion\\-ia\\.com");
  });
});

describe("formatParisDateTime", () => {
  it("retourne '—' pour input invalide ou vide", () => {
    expect(formatParisDateTime(undefined)).toBe("—");
    expect(formatParisDateTime("not-a-date")).toBe("—");
  });

  it("formatte une Date en Europe/Paris fr-FR", () => {
    const d = new Date("2026-05-26T08:30:00Z"); // 10:30 Paris (heure d'été)
    const formatted = formatParisDateTime(d);
    // dateStyle: "medium" en fr-FR donne "26 mai 2026, 10:30"
    expect(formatted).toContain("26");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("10:30");
  });
});

describe("formatNotification", () => {
  it("CONTACT_FORM_SUBMITTED produit un message MarkdownV2 valide", () => {
    const { text } = formatNotification(
      {
        category: "CONTACT_FORM_SUBMITTED",
        payload: {
          submissionId: "sub_123",
          contactName: "Jean Dupont",
          contactEmail: "jean@example.com",
          formType: "contact",
          ville: "Paris",
          locale: "fr",
        },
      },
      "info",
    );
    expect(text).toContain("🟢");
    expect(text).toContain("*Nouveau message contact*");
    // Email contient un point → doit être échappé.
    expect(text).toContain("jean@example\\.com");
    // ID submission affiché.
    expect(text).toContain("sub\\_123");
    // Footer avec catégorie.
    expect(text).toContain("CONTACT\\_FORM\\_SUBMITTED");
  });

  // Demande Will 2026-08-12 : le CONTENU écrit par le visiteur doit arriver
  // dans Telegram/WhatsApp, pas seulement les métadonnées. Ces trois cas
  // rougissent si quelqu'un retire les champs message/motivation/réponses.
  it("le contenu du message du visiteur est rendu (formulaires unifiés)", () => {
    const { text } = formatNotification(
      {
        category: "CONTACT_FORM_SUBMITTED",
        payload: {
          submissionId: "sub_9",
          contactName: "Marie",
          contactEmail: "m@x.fr",
          formType: "contact",
          message: "Bonjour, je cherche une formation IA pour 12 personnes.",
          locale: "fr",
        },
      },
      "info",
    );
    expect(text).toContain("*Message*");
    expect(text).toContain("formation IA pour 12 personnes");
  });

  it("la motivation d'une candidature est rendue", () => {
    const { text } = formatNotification(
      {
        category: "JOB_APPLICATION_RECEIVED",
        payload: {
          applicationId: "app_1",
          contactName: "Ali",
          contactEmail: "a@x.fr",
          offerTitle: "Monteur vidéo freelance",
          motivationExcerpt: "Dix ans de montage documentaire.",
          hasCv: true,
          locale: "fr",
        },
      },
      "info",
    );
    expect(text).toContain("*Motivation*");
    expect(text).toContain("montage documentaire");
  });

  it("les réponses du formulaire Calendly sont rendues", () => {
    const { text } = formatNotification(
      {
        category: "CALENDLY_INVITEE_CREATED",
        payload: {
          eventUri: "evt_1",
          inviteeEmail: "i@x.fr",
          inviteeName: "Zoé",
          eventStartTime: "2026-08-20T10:00:00Z",
          eventName: "appel",
          answersText: "Votre besoin : automatiser la compta",
        },
      },
      "info",
    );
    expect(text).toContain("*Réponses formulaire*");
    expect(text).toContain("automatiser la compta");
  });

  it("CALENDLY_INVITEE_CREATED inclut start-time et page URL échappés", () => {
    const { text } = formatNotification(
      {
        category: "CALENDLY_INVITEE_CREATED",
        payload: {
          eventUri: "evt_abc",
          inviteeEmail: "invitee@axion-ia.com",
          inviteeName: "Will",
          eventStartTime: "2026-05-30T10:00:00Z",
          eventName: "appel-decouverte",
          pageUrl: "https://axion-ia.com/fr/appel",
        },
      },
      "info",
    );
    expect(text).toContain("appel\\-decouverte");
    expect(text).toContain("axion\\-ia\\.com");
  });

  // Depuis la refonte 2026-08-09, le message commence par l'EN-TÊTE DE THÈME et
  // non plus par l'emoji de gravité : c'est ce que WhatsApp affiche sur l'écran
  // verrouillé, et c'est là que se joue la distinction entre un rendez-vous et
  // une candidature. La gravité reste présente, juste après.
  it("severity warn/error utilise le bon emoji, après le thème", () => {
    const warn = formatNotification(
      {
        category: "OPTION_REFUSED",
        payload: { bookingId: "bk_1", admin: "Will", reason: "indispo" },
      },
      "warn",
    );
    expect(warn.text).toMatch(/^🔔 \*SYSTÈME\* · 🟡/);
    const err = formatNotification(
      {
        category: "DEPLOY_FAILED",
        payload: { sha: "abc1234", error: "build crashed" },
      },
      "error",
    );
    expect(err.text).toMatch(/^🔔 \*SYSTÈME\* · 🔴/);
  });

  it("chaque thème pose son en-tête en PREMIÈRE ligne", () => {
    const cas = [
      {
        category: "CALENDLY_INVITEE_CREATED" as const,
        payload: {
          eventUri: "evt_1",
          inviteeEmail: "a@b.com",
          inviteeName: "Marie",
          eventStartTime: "(voir mail Calendly)",
          eventName: "Appel découverte",
        },
        attendu: "📅 *CALENDLY* · ",
      },
      {
        category: "REVIEW_SUBMITTED" as const,
        payload: { reviewId: "rev_1", authorName: "Marie D.", rating: 5, hasPhoto: false },
        attendu: "⭐ *AVIS CLIENT* · ",
      },
      {
        category: "QUOTE_REQUEST_RECEIVED" as const,
        payload: {
          submissionId: "sub_1",
          contactName: "Marie",
          contactEmail: "a@b.com",
          locale: "fr" as const,
        },
        attendu: "🛠️ *INTERVENTION* · ",
      },
    ];
    for (const { category, payload, attendu } of cas) {
      const { text } = formatNotification(
        { category, payload } as Parameters<typeof formatNotification>[0],
        "info",
      );
      expect(text.startsWith(attendu), `${category} → ${text.slice(0, 40)}`).toBe(true);
    }
  });

  // L'horaire arrivait brut du payload : un ISO en UTC, illisible sur un
  // téléphone et faux de deux heures pour un lecteur français.
  it("l'horaire Calendly est rendu en heure de Paris, le texte libre est conservé", () => {
    const iso = formatNotification(
      {
        category: "CALENDLY_INVITEE_CREATED",
        payload: {
          eventUri: "evt_1",
          inviteeEmail: "a@b.com",
          inviteeName: "Marie",
          eventStartTime: "2026-08-20T07:30:00.000Z",
          eventName: "Appel découverte",
        },
      },
      "info",
    ).text;
    expect(iso).toContain("09:30"); // 07:30 UTC = 09:30 à Paris en août
    expect(iso).not.toContain("2026\\-08\\-20T07");

    const libre = formatNotification(
      {
        category: "CALENDLY_INVITEE_CREATED",
        payload: {
          eventUri: "evt_2",
          inviteeEmail: "a@b.com",
          inviteeName: "Marie",
          eventStartTime: "(voir mail Calendly)",
          eventName: "Appel découverte",
        },
      },
      "info",
    ).text;
    expect(libre).toContain("voir mail Calendly");
  });
});
