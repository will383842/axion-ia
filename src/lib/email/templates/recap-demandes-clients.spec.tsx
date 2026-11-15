/**
 * L'e-mail INTERNE « 🔴 Récap clients du JJ/MM : N demandes » — ce qu'il DOIT dire :
 *  · l'objet de la décision du fondateur, emoji rouge en tête, ≤ 45 caractères, sans « undefined » ;
 *  · même sans demande : « aucune demande » (signal de vie) ;
 *  · le détail COMPLET de chaque demande, un bouton de fiche par demande ;
 *  · le texte d'un visiteur échappé (jamais du HTML), le bouton limité à la console de l'instance ;
 *  · classé AUTOMATIQUE : jamais retenu en corbeille.
 */

import { describe, it, expect } from "vitest";
import { renderEmailTemplate } from "./index";
import { lienConsole } from "@/server/notifications/personne";
import {
  EMAILS_A_VALIDER_PAR_DEFAUT,
  estEmailQualiopiAutomatique,
  libelleTemplateEmail,
} from "@/server/email/outbox-policy";

const FICHE = `${lienConsole("")}/contacts/messages/sub_42`;

const PAYLOAD = {
  jour: "2026-11-13",
  jourCourt: "13/11",
  jourLong: "13/11/2026",
  total: 3,
  illisibles: 0,
  nonListees: { demandes: 0, rendezVous: 0, autresRendezVous: 0 },
  demandes: [
    {
      type: "Audit IA",
      nom: "Camille Exemple — Atelier Fictif SARL",
      quand: "13 nov. 2026, 11:15",
      lignes: [
        "Nom : Camille Exemple",
        "E-mail : camille@exemple.fr",
        "Téléphone : +33 6 39 98 12 35",
        "",
        "Message :",
        "Bonjour, nous voulons un audit.",
      ],
      consoleUrl: FICHE,
    },
    {
      type: "Question chatbot sans réponse",
      nom: "visiteur@exemple.fr",
      quand: "13 nov. 2026, 16:00",
      lignes: ["Question :", "Faites-vous des formations en anglais ?"],
      consoleUrl: lienConsole("chatbot/escalades"),
    },
  ],
  rendezVous: [
    {
      type: "Annulation — Diagnostic IA",
      nom: "Alex Exemple",
      quand: "13 nov. 2026, 11:15",
      approximatif: true,
      lignes: ["Nom : Alex Exemple"],
      consoleUrl: lienConsole("contacts/appels/cal_1"),
    },
  ],
  autresRendezVous: [
    {
      type: "Rendez-vous : Échange apporteur",
      nom: "Sam Exemple",
      quand: "13 nov. 2026, 09:00",
      lignes: ["Nom : Sam Exemple"],
      consoleUrl: lienConsole("contacts/appels/cal_9"),
    },
  ],
};

describe("recap-demandes-clients", () => {
  it("objets : pluriel, singulier, aucune demande — emoji rouge en tête, ≤ 45 caractères", async () => {
    const attendus: Array<[Record<string, unknown>, string]> = [
      [{ total: 3 }, "🔴 Récap clients du 13/11 : 3 demandes"],
      [{ total: 1 }, "🔴 Récap clients du 13/11 : 1 demande"],
      [
        { total: 0, demandes: [], rendezVous: [], autresRendezVous: [] },
        "🔴 Récap clients du 13/11 : aucune demande",
      ],
    ];
    for (const [p, objet] of attendus) {
      const r = await renderEmailTemplate("recap-demandes-clients", "fr", { ...PAYLOAD, ...p });
      expect(r.subject).toBe(objet);
      expect(r.subject.length).toBeLessThanOrEqual(45);
    }
  });

  it("même sans demande : un e-mail qui dit « aucune demande » (signal de vie)", async () => {
    const r = await renderEmailTemplate("recap-demandes-clients", "fr", {
      ...PAYLOAD,
      total: 0,
      demandes: [],
      rendezVous: [],
      autresRendezVous: [],
    });
    expect(r.text).toContain("Aucune demande de client");
    expect(r.text).not.toContain("undefined");
  });

  it("rend sans charge utile, sans écrire « undefined »", async () => {
    const r = await renderEmailTemplate("recap-demandes-clients", "fr", {});
    expect(r.text).not.toContain("undefined");
    expect(r.subject).not.toContain("undefined");
  });

  it("porte le détail complet de chaque demande et un bouton de fiche par demande", async () => {
    const r = await renderEmailTemplate("recap-demandes-clients", "fr", PAYLOAD);
    for (const attendu of [
      "Camille Exemple — Atelier Fictif SARL",
      "camille@exemple.fr",
      "+33 6 39 98 12 35",
      "Bonjour, nous voulons un audit.",
      "Faites-vous des formations en anglais ?",
      "Annulation — Diagnostic IA",
      "approximative",
      "Autres rendez-vous",
      "Sam Exemple",
    ]) {
      expect(r.text).toContain(attendu);
    }
    expect(r.html).toContain("/contacts/messages/sub_42");
    expect(r.html).toContain("/contacts/appels/cal_1");
    expect(r.html).toContain("/chatbot/escalades");
    expect(r.html.match(/Ouvrir la fiche/g)?.length).toBe(4);
  });

  it("🔴 le texte d'un visiteur est échappé : jamais du HTML dans l'e-mail", async () => {
    const r = await renderEmailTemplate("recap-demandes-clients", "fr", {
      ...PAYLOAD,
      demandes: [
        {
          type: "Audit IA",
          nom: "<img src=x onerror=alert(1)>",
          quand: "13 nov. 2026",
          lignes: [
            "Message :",
            '<script>alert("x")</script> <a href="https://attaquant.example">cliquez</a>',
          ],
          consoleUrl: FICHE,
        },
      ],
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).not.toContain("<img src=x");
    expect(r.html).not.toContain('href="https://attaquant.example"');
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("🔴 le bouton n'accepte qu'un lien de la console de cette instance", async () => {
    const piege = await renderEmailTemplate("recap-demandes-clients", "fr", {
      ...PAYLOAD,
      demandes: [{ ...PAYLOAD.demandes[0]!, consoleUrl: "https://attaquant.example/login" }],
    });
    expect(piege.html).not.toContain("attaquant.example");
  });

  it("part seul : notification interne, jamais retenue en corbeille", () => {
    expect(estEmailQualiopiAutomatique("recap-demandes-clients")).toBe(true);
    expect(EMAILS_A_VALIDER_PAR_DEFAUT).not.toContain("recap-demandes-clients");
    expect(libelleTemplateEmail("recap-demandes-clients")).not.toMatch(/«/);
  });
});
