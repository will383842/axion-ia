/**
 * `D6-5-C1` — WhatsApp ne transporte AUCUNE donnée personnelle.
 *
 * ## Pourquoi ce canal est traité à part
 *
 * WhatsApp passe par CallMeBot. Trois faits, vérifiés le 2026-08-20 sur leurs
 * propres pages :
 *
 * 1. **Aucune entité légale n'est publiée** — ni nom, ni adresse, ni juridiction,
 *    ni dans les conditions d'utilisation ni dans la politique de
 *    confidentialité. La page publique `/sous-processeurs` ne PEUT donc pas le
 *    déclarer : il n'y a personne à nommer. Pas de contrat de sous-traitance,
 *    pas de durée de conservation annoncée, transferts hors UE reconnus sans
 *    garantie détaillée.
 * 2. **Leurs conditions INTERDISENT** de s'en servir pour « collect or track the
 *    personal information of others » — exactement ce que faisait l'envoi du
 *    nom et du téléphone d'un prospect.
 * 3. Le message part dans l'**URL** (requête GET), donc journalisé par chaque
 *    intermédiaire qu'il traverse, avec la clé d'API.
 *
 * ## Ce que le canal garde, et ce qu'il perd
 *
 * 🔑 Il prévient — c'est son seul rôle, et il le tient : l'écran verrouillé
 * n'affiche de toute façon que les premiers caractères. Le détail qui permet de
 * rappeler vit sur Telegram, canal déclaré et couvert par des clauses
 * contractuelles types.
 *
 * ⚠️ La tentation qui reviendra : « juste le prénom », « juste la ville ». Ce
 * test est là pour que ce soit un choix explicite, pas un glissement.
 */

import { describe, it, expect } from "vitest";
import { formatNotificationWhatsApp, formatNotificationPlain } from "../format";
import {
  libelleTypeDemande,
  libelleTypeDemandeWhatsApp,
  type EvenementClient,
} from "../format-clients";
import type { NotificationEvent } from "../types";

/** Un événement de contact, avec tout ce qu'un prospect fournit. */
const EVENEMENT = {
  category: "CONTACT_FORM_SUBMITTED",
  payload: {
    contactName: "Jeanne Dupont",
    contactEmail: "jeanne.dupont@exemple.fr",
    contactPhone: "+33 6 39 98 12 34",
    message: "Je cherche une formation IA pour douze personnes en novembre.",
    ville: "Grenoble",
    companyName: "Exemple SAS",
  },
} as unknown as NotificationEvent;

const PII = [
  "Jeanne",
  "Dupont",
  "jeanne.dupont@exemple.fr",
  "639981234",
  "6 39 98 12 34",
  "douze personnes",
  "Grenoble",
  "Exemple SAS",
];

describe("`D6-5-C1` — le message WhatsApp ne porte aucune donnée personnelle", () => {
  const whatsapp = formatNotificationWhatsApp("CONTACT_FORM_SUBMITTED", "info").text;

  it("🔴 aucune donnée du prospect n'apparaît", () => {
    for (const fragment of PII) {
      expect(whatsapp, `« ${fragment} » ne doit pas partir chez CallMeBot`).not.toContain(fragment);
    }
  });

  it("🔴 le TÉMOIN : Telegram porte le prénom, l'initiale, la ville et l'entreprise", () => {
    // 🔑 Sans ce témoin, le test ci-dessus passerait au vert même si le
    // formateur Telegram cessait de porter quoi que ce soit d'utile. Depuis le
    // 11/10/2026, Telegram dit QUI (prénom + initiale), d'où, pour quelle
    // entreprise, et renvoie à la fiche — jamais les coordonnées ni le message.
    // ⚠️ `formatNotificationPlain` et non `formatNotification` : le second
    // échappe le MarkdownV2, et le témoin échouerait sur l'échappement.
    const telegram = formatNotificationPlain(EVENEMENT, "info").text;
    expect(telegram).toContain("Jeanne D.");
    expect(telegram).toContain("Grenoble");
    expect(telegram).toContain("Exemple SAS");
    expect(telegram).not.toContain("Dupont");
    expect(telegram).not.toContain("jeanne.dupont@exemple.fr");
    expect(telegram, "le message se lit sur la fiche").not.toContain("douze personnes");
  });

  it("il prévient quand même : nature de l'alerte et heure", () => {
    // Le canal doit rester UTILE. Un message vide de sens ne vaudrait pas mieux
    // qu'un canal coupé — et Will a demandé à continuer d'être prévenu.
    expect(whatsapp.length).toBeGreaterThan(20);
    expect(whatsapp, "l'heure situe l'alerte").toMatch(/\d{2}:\d{2}/);
    expect(whatsapp, "et il dit où trouver le détail").toMatch(/Telegram|console/i);
  });

  it("🔴 le dispatch appelle le formateur DÉDIÉ, pas celui de Telegram", () => {
    // 🔑 Le câblage, pas la définition. Une première version de ce correctif
    // aurait pu laisser `dispatchChannels` sur `markdownV2ToPlain(formattedText)`
    // — le formateur sûr aurait existé sans jamais servir. C'est le patron
    // « l'outil est écrit, le câblage manque », rencontré cinq fois dans cet
    // audit.
    const source = readSource("src/server/notifications/index.ts");
    expect(source).toMatch(/formatNotificationWhatsApp\(\s*category/);
    expect(source, "le texte complet ne doit plus atteindre `sendWhatsAppRaw`").not.toMatch(
      /sendWhatsAppRaw\(\{\s*text:\s*markdownV2ToPlain/,
    );
  });
});

describe("Décision Will 15/10 — la sonnette WhatsApp des clients", () => {
  it("🔥 une ligne : nature, type de demande, heure, et où lire le détail", () => {
    const texte = formatNotificationWhatsApp("AUDIT_REQUEST_SUBMITTED", "info", "Audit IA").text;
    expect(texte).toMatch(
      /^🔥 NOUVEAU CLIENT · Audit IA · \d{2}:\d{2} — tout le détail dans Telegram \(salon Clients\)$/,
    );
  });

  it("❌ annulation et 🔁 report ont leur propre première ligne", () => {
    expect(
      formatNotificationWhatsApp("CLIENT_CALL_CANCELED", "warn", "Diagnostic IA").text,
    ).toMatch(/^❌ ANNULATION CLIENT · Diagnostic IA · /);
    expect(formatNotificationWhatsApp("CLIENT_CALL_RESCHEDULED", "info").text).toMatch(
      /^🔁 REPORT CLIENT · /,
    );
  });

  it("🔴 le type de demande transmis ne porte AUCUNE donnée de la personne", () => {
    const evenements = [
      EVENEMENT,
      {
        category: "CLIENT_CALL_BOOKED",
        payload: {
          eventUri: "evt_1",
          inviteeEmail: "jeanne.dupont@exemple.fr",
          inviteeName: "Jeanne Dupont",
          inviteePhone: "+33 6 39 98 12 34",
          eventStartTime: "2026-10-16T08:00:00Z",
          eventName: "Diagnostic IA (30 min)",
          answersText: "douze personnes à former",
        },
      },
      {
        category: "CLIENT_CALL_CANCELED",
        payload: {
          eventUri: "evt_1",
          inviteeEmail: "jeanne.dupont@exemple.fr",
          inviteeName: "Jeanne Dupont",
          reason: "douze personnes malades",
        },
      },
    ] as unknown as EvenementClient[];
    for (const e of evenements) {
      const texte = formatNotificationWhatsApp(
        e.category,
        "info",
        libelleTypeDemandeWhatsApp(e),
      ).text;
      for (const fragment of PII)
        expect(texte, `${e.category} : ${fragment}`).not.toContain(fragment);
    }
  });
});

describe("Relecture PR 1553 — aucun champ LIBRE n'atteint WhatsApp", () => {
  // Ce que le client écrit lui-même : nom et numéro glissés dans son besoin.
  const LIBRE = ["Jeanne", "Dupont", "06 39 98 12 34", "0639981234", "Exemple SAS", "Grenoble"];
  const BESOIN = "Rappeler Jeanne Dupont au 06 39 98 12 34 (Exemple SAS, Grenoble)";

  it("🔴 réservation avec un besoin portant un nom et un numéro ⇒ absent du WhatsApp", () => {
    const e = {
      category: "CLIENT_CALL_BOOKED",
      payload: {
        eventUri: "evt_2",
        inviteeEmail: "jeanne.dupont@exemple.fr",
        inviteeName: "Jeanne Dupont",
        eventStartTime: "2026-10-16T08:00:00Z",
        eventName: "Échange projet",
        typeRendezVous: "echange_projet",
        besoin: BESOIN,
      },
    } as unknown as EvenementClient;
    const texte = formatNotificationWhatsApp(
      e.category,
      "info",
      libelleTypeDemandeWhatsApp(e),
    ).text;
    for (const fragment of LIBRE) expect(texte, fragment).not.toContain(fragment);
    expect(texte, "la nature reste dite").toContain("Échange projet réservé");
    // 🔑 TÉMOIN : le titre Telegram, lui, porte toujours le besoin. Sans ce
    // témoin, un besoin jamais recopié nulle part passerait aussi au vert.
    expect(libelleTypeDemande(e)).toContain("Jeanne Dupont");
  });

  it("🔴 message, réponses, motif, société, ville, nom du type : rien n'atteint WhatsApp", () => {
    const evenements = [
      {
        category: "QUOTE_REQUEST_RECEIVED",
        payload: {
          contactName: "Jeanne Dupont",
          contactEmail: "jeanne.dupont@exemple.fr",
          contactPhone: "06 39 98 12 34",
          message: BESOIN,
          companyName: "Exemple SAS",
          ville: "Grenoble",
          // Un `formType` hors catalogue (forgé) ne doit pas être recopié.
          formType: "Jeanne Dupont 06 39 98 12 34",
        },
      },
      {
        category: "CLIENT_CALL_RESCHEDULED",
        payload: {
          eventUri: "evt_3",
          inviteeEmail: "jeanne.dupont@exemple.fr",
          inviteeName: "Jeanne Dupont",
          eventName: "Jeanne Dupont 06 39 98 12 34",
          answersText: BESOIN,
        },
      },
      {
        category: "CLIENT_CALL_CANCELED",
        payload: {
          eventUri: "evt_4",
          inviteeEmail: "jeanne.dupont@exemple.fr",
          inviteeName: "Jeanne Dupont",
          eventName: "Diagnostic IA — Jeanne Dupont",
          reason: BESOIN,
        },
      },
      {
        category: "CHATBOT_ESCALATION",
        payload: { escalationId: "e1", question: BESOIN, contexte: BESOIN },
      },
    ] as unknown as EvenementClient[];
    for (const e of evenements) {
      const texte = formatNotificationWhatsApp(
        e.category,
        "info",
        libelleTypeDemandeWhatsApp(e),
      ).text;
      for (const fragment of LIBRE)
        expect(texte, `${e.category} : ${fragment}`).not.toContain(fragment);
    }
  });

  it("🔴 le dispatch passe le libellé WhatsApp, pas celui de Telegram", () => {
    const source = readSource("src/server/notifications/index.ts");
    expect(source).toMatch(/libelleTypeDemandeWhatsApp\(event/);
    expect(source).not.toMatch(/[^A-Za-z]libelleTypeDemande\(/);
  });
});

function readSource(relatif: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require("node:path") as typeof import("node:path");
  return readFileSync(join(process.cwd(), relatif), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
