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
import type { NotificationEvent } from "../types";

/** Un événement de contact, avec tout ce qu'un prospect fournit. */
const EVENEMENT = {
  category: "CONTACT_FORM_SUBMITTED",
  payload: {
    contactName: "Jeanne Dupont",
    contactEmail: "jeanne.dupont@exemple.fr",
    contactPhone: "+33 6 12 34 56 78",
    message: "Je cherche une formation IA pour douze personnes en novembre.",
    ville: "Grenoble",
    companyName: "Exemple SAS",
  },
} as unknown as NotificationEvent;

const PII = [
  "Jeanne",
  "Dupont",
  "jeanne.dupont@exemple.fr",
  "612345678",
  "6 12 34 56 78",
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

  it("🔴 le TÉMOIN : ces mêmes données partent bien sur Telegram", () => {
    // 🔑 Sans ce témoin, le test ci-dessus passerait au vert même si le
    // formateur Telegram cessait lui aussi de porter le détail — et on aurait
    // « corrigé » le problème en privant Will de ce qui lui sert à rappeler.
    // C'est le partage qu'on garde : WhatsApp prévient, Telegram renseigne.
    // ⚠️ `formatNotificationPlain` et non `formatNotification` : le second
    // échappe le MarkdownV2 (`exemple\.fr`), et le témoin échouerait sur
    // l'échappement au lieu de dire ce qu'il doit dire.
    const telegram = formatNotificationPlain(EVENEMENT, "info").text;
    expect(telegram).toContain("Jeanne Dupont");
    expect(telegram).toContain("jeanne.dupont@exemple.fr");
    expect(telegram, "et le message, que Will lit pour rappeler").toContain("douze personnes");
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

function readSource(relatif: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require("node:path") as typeof import("node:path");
  return readFileSync(join(process.cwd(), relatif), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
