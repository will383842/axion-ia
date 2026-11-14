/**
 * L'e-mail INTERNE « 🔴 IMPORTANT DEMANDE CLIENT … » — ce qu'il DOIT dire :
 *  · l'objet de la décision du fondateur (MESSAGE / CALENDLY / ANNULÉ / REPORTÉ), ≤ 45 caractères ;
 *  · toutes les informations de la demande (nom, e-mail, téléphone, message) et le lien de la fiche ;
 *  · classé AUTOMATIQUE : une notification au fondateur, jamais retenue en corbeille.
 */

import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";
import {
  EMAILS_A_VALIDER_PAR_DEFAUT,
  estEmailQualiopiAutomatique,
  libelleTemplateEmail,
} from "@/server/email/outbox-policy";

const PAYLOAD = {
  canal: "message",
  evenement: "nouveau",
  typeDemande: "Formation IA",
  nom: "Camille Exemple",
  recuLe: "15 oct. 2026, 14:30",
  lignes: [
    "Nom : Camille Exemple",
    "E-mail : camille@exemple.fr",
    "Téléphone : +33 6 39 98 12 35",
    "",
    "Message :",
    "Bonjour, nous voulons former 12 personnes.",
    "",
    "Fiche : https://axion-ia.com/fr/admin-x/contacts/messages/sub_42",
  ],
  consoleUrl: "https://axion-ia.com/fr/admin-x/contacts/messages/sub_42",
};

describe("alerte-demande-client", () => {
  it("les quatre objets de la décision, chacun sous 45 caractères", async () => {
    const attendus: Array<[Record<string, unknown>, string]> = [
      [{ canal: "message", evenement: "nouveau" }, "🔴 IMPORTANT DEMANDE CLIENT MESSAGE"],
      [{ canal: "calendly", evenement: "nouveau" }, "🔴 IMPORTANT DEMANDE CLIENT CALENDLY"],
      [{ canal: "calendly", evenement: "annule" }, "🔴 IMPORTANT DEMANDE CLIENT CALENDLY ANNULÉ"],
      [{ canal: "calendly", evenement: "reporte" }, "🔴 IMPORTANT DEMANDE CLIENT CALENDLY REPORTÉ"],
    ];
    for (const [p, objet] of attendus) {
      const r = await renderEmailTemplate("alerte-demande-client", "fr", { ...PAYLOAD, ...p });
      expect(r.subject).toBe(objet);
      expect(r.subject.length).toBeLessThanOrEqual(45);
    }
  });

  it("porte toutes les informations et un bouton vers la fiche", async () => {
    const r = await renderEmailTemplate("alerte-demande-client", "fr", PAYLOAD);
    for (const attendu of [
      "Camille Exemple",
      "camille@exemple.fr",
      "+33 6 39 98 12 35",
      "Bonjour, nous voulons former 12 personnes.",
      "15 oct. 2026, 14:30",
    ]) {
      expect(r.text).toContain(attendu);
    }
    expect(r.html).toContain("/fr/admin-x/contacts/messages/sub_42");
  });

  it("rend sans charge utile, sans écrire « undefined »", async () => {
    const r = await renderEmailTemplate("alerte-demande-client", "fr", {});
    expect(r.text).not.toContain("undefined");
    expect(r.subject).not.toContain("undefined");
  });

  it("part seul : notification interne, jamais retenue en corbeille", () => {
    expect(estEmailQualiopiAutomatique("alerte-demande-client")).toBe(true);
    expect(EMAILS_A_VALIDER_PAR_DEFAUT).not.toContain("alerte-demande-client");
    expect(libelleTemplateEmail("alerte-demande-client")).not.toMatch(/«/);
  });
});
