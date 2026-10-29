// Tests format.ts — escapeMarkdownV2 + formatNotification (Sprint Notif Infra 2026-05-26).

import { describe, it, expect } from "vitest";
import { escapeMarkdownV2, formatNotification, formatParisDateTime } from "../format";
import { preparerPourTelegram } from "../channels/telegram";
import { labeledAnswers, parseScreeningQuestions } from "@/lib/careers/screening-answers";

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
    // Prénom + initiale (le point est échappé), jamais l'e-mail.
    expect(text).toContain("Jean D\\.");
    expect(text).not.toContain("Dupont");
    expect(text).not.toContain("jean@example");
    // Lien vers la fiche (l'underscore de l'identifiant est échappé).
    expect(text).toContain("contacts/messages/sub\\_123");
    // Footer avec catégorie.
    expect(text).toContain("CONTACT\\_FORM\\_SUBMITTED");
  });

  // Décision du 11/10/2026 : le CONTENU saisi par la personne (message,
  // motivation, réponses, tarifs) ne part plus sur Telegram — il se lit sur la
  // fiche. Ces cas rougissent si quelqu'un le réintroduit.
  it("le contenu du message du visiteur n'est PAS rendu (formulaires unifiés)", () => {
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
    expect(text).not.toContain("*Message*");
    expect(text).not.toContain("formation IA pour 12 personnes");
    expect(text).toContain("contacts/messages/sub\\_9");
  });

  it("la motivation d'une candidature n'est PAS rendue", () => {
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
    expect(text).not.toContain("*Motivation*");
    expect(text).not.toContain("montage documentaire");
    expect(text).toContain("contacts/candidatures/app\\_1");
  });

  it("candidature monteur : les réponses aux questions de l'offre (prix) ne sont PAS rendues", () => {
    const { text } = formatNotification(
      {
        category: "VIDEO_EDITOR_APPLICATION_RECEIVED",
        payload: {
          applicationId: "app_2",
          contactName: "Ali",
          contactEmail: "a@x.fr",
          offerTitle: "Monteur vidéo freelance",
          answers: [{ label: "Prix vidéo verticale 30 s", value: "45 € HT" }],
          hasCv: false,
          locale: "fr",
        },
      },
      "info",
    );
    expect(text).not.toContain("Prix vidéo verticale");
    expect(text).not.toContain("45 € HT");
  });

  it("les réponses du formulaire Calendly ne sont PAS rendues", () => {
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
    expect(text).not.toContain("*Réponses formulaire*");
    expect(text).not.toContain("automatiser la compta");
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
        // Décision Will 15/10 : une demande de devis est un CLIENT. Ce gabarit
        // allégé ne sert plus qu'au repli (salon « Clients » pas encore créé).
        attendu: "🔥 *CLIENT* · ",
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

// 2026-09-26 — mesuré en production : le message vidéaste était coupé après le
// deuxième prix (« TRONQUE 11 lignes »). Ce test rejoue les questions RÉELLES
// des deux offres vidéo, avec des réponses complètes et des liens longs, et
// exige que le message arrive ENTIER : tous les prix, le matériel, les liens et
// le lien console, sans troncature.
describe("candidature vidéo freelance : le message Telegram arrive entier", () => {
  const VIDEASTE = parseScreeningQuestions([
    { id: "prix_demi_journee", type: "price", court: "demi-journée", labelFr: "x" },
    { id: "prix_journee", type: "price", court: "journée", labelFr: "x" },
    { id: "prix_soiree", type: "price", court: "soirée", labelFr: "x" },
    { id: "materiel_image", type: "short", ligne: "Matériel", court: "image", labelFr: "x" },
    {
      id: "materiel_son_lumiere",
      type: "short",
      ligne: "Matériel",
      court: "son/lumière",
      labelFr: "x",
    },
    { id: "formats_plans", type: "short", ligne: "Tournage", court: "formats", labelFr: "x" },
    { id: "deplacement", type: "short", ligne: "Tournage", court: "déplacement", labelFr: "x" },
    { id: "prix_binome_journee", type: "price", court: "à deux (journée)", labelFr: "x" },
    { id: "exemples", ligne: "Exemples", labelFr: "x" },
  ]);
  const MONTEUR = parseScreeningQuestions([
    { id: "prix_vertical_30", type: "price", court: "30 s", labelFr: "x" },
    { id: "prix_vertical_60", type: "price", court: "60 s", labelFr: "x" },
    { id: "prix_vertical_90", type: "price", court: "90 s", labelFr: "x" },
    { id: "prix_horizontal_3", type: "price", court: "3 min", labelFr: "x" },
    { id: "prix_horizontal_5", type: "price", court: "5 min", labelFr: "x" },
    { id: "prix_minute_sup", type: "price", court: "min en +", labelFr: "x" },
    { id: "exemples_vertical", ligne: "Exemples", court: "vertical", labelFr: "x" },
    { id: "exemples_horizontal", ligne: "Exemples", court: "horizontal", labelFr: "x" },
  ]);
  const LIEN = "https://www.youtube.com/watch?v=abcdefghijk&list=PL1234567890";

  function message(questions: typeof VIDEASTE, answers: Record<string, string>) {
    const { text } = formatNotification(
      {
        category: "VIDEO_EDITOR_APPLICATION_RECEIVED",
        payload: {
          applicationId: "3ae6506a-40d0-4998-b762-bbd08bda7250",
          contactName: "Jean-Baptiste Témoin-Durand",
          contactEmail: "jean-baptiste.temoin@exemple-temoin.fr",
          contactPhone: "+33 6 00 00 00 00",
          offerTitle: "Vidéaste freelance (F/H) — tournage, sans montage",
          offerCategory: "design",
          city: "Saint-Martin-d'Hères",
          answers: labeledAnswers(questions, answers),
          hasCv: false,
          locale: "fr",
        },
      },
      "info",
    );
    return preparerPourTelegram(text);
  }

  // Depuis le 11/10/2026, ni coordonnées ni réponses (tarifs compris) : le
  // message tient sans troncature et renvoie à la fiche.
  it("vidéaste : tout tient, aucune ligne écartée", () => {
    const envoye = message(VIDEASTE, {
      prix_demi_journee: "180",
      prix_journee: "320",
      prix_soiree: "200",
      materiel_image: "iPhone 15 Pro + Sony ZV-E10",
      materiel_son_lumiere: "Rode Wireless GO II, panneau LED",
      formats_plans: "les deux, plusieurs plans",
      deplacement: "toute la région",
      prix_binome_journee: "550",
      exemples: `${LIEN}\n${LIEN}`,
    });
    expect(envoye).not.toContain("TRONQUE");
    expect(envoye).toContain(String.raw`Jean\-Baptiste T\.`);
    expect(envoye).not.toContain("Durand");
    expect(envoye).not.toContain("exemple\\-temoin");
    expect(envoye).not.toContain("00 00");
    expect(envoye).not.toContain("200 €");
    expect(envoye).not.toContain("Rode Wireless");
    expect(envoye).toContain("Voir en console");
    expect(envoye).not.toContain("Catégorie");
  });

  it("monteur : les tarifs ne partent pas, le lien console reste", () => {
    const envoye = message(MONTEUR, {
      prix_vertical_30: "40",
      prix_vertical_60: "60",
      prix_vertical_90: "80",
      prix_horizontal_3: "120",
      prix_horizontal_5: "180",
      prix_minute_sup: "25",
      exemples_vertical: LIEN,
      exemples_horizontal: LIEN,
    });
    expect(envoye).not.toContain("TRONQUE");
    expect(envoye).not.toContain("25 €");
    expect(envoye).toContain("Voir en console");
  });
});

describe("Tour France IA : alertes minimisées", () => {
  const texte = (event: Parameters<typeof formatNotification>[0]) =>
    formatNotification(event, "warn").text;

  it("nouvelle demande : ville, compteur, compte oui, lien vers la fiche de la ville", () => {
    const t = texte({
      category: "TOUR_DEMANDE_RECUE",
      payload: { ville: "Lyon", villeCle: "lyon", comptees: 3, seuil: 5, compte: true },
    });
    expect(t).toContain("Tour France IA : nouvelle demande");
    expect(t).toContain("Lyon");
    expect(t).toContain("3 sur 5");
    expect(t).toContain("Compte pour la ville");
    expect(t).toContain("oui");
    expect(t).toContain("tunnels/tour/demandes");
    expect(t).not.toContain("fiche");
    expect(t).toContain(String.raw`ville\=lyon`);
  });

  it("doublon : « non (déjà comptée) » ; ville hors liste : lien vers la liste des villes", () => {
    const t = texte({
      category: "TOUR_DEMANDE_RECUE",
      payload: {
        ville: "ville hors liste (à vérifier)",
        villeCle: null,
        comptees: 0,
        seuil: 5,
        compte: false,
      },
    });
    expect(t).toContain(String.raw`non \(déjà comptée\)`);
    expect(t).toContain("ville hors liste");
    expect(t).toContain("tunnels/tour/demandes");
    expect(t).not.toContain("fiche");
  });

  it("ville ouverte : titre dédié et compteur", () => {
    const t = texte({
      category: "TOUR_VILLE_OUVERTE",
      payload: { ville: "Lyon", villeCle: "lyon", comptees: 5, seuil: 5 },
    });
    expect(t).toContain("VILLE OUVERTE");
    expect(t).not.toContain("(5 sur 5)");
    expect(t).toContain("5 sur 5");
  });
});
