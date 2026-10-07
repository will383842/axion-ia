import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

// E-mails apporteurs alignés sur le contrat 2.3 (07/10/2026) : commission versée quand la
// prestation est RÉALISÉE et entièrement payée (4.2) ; contestation : réponse sous 30 jours (3.3) ;
// parrainage : commandes signées dans les 6 mois de la signature du contrat par Axion-IA (4.6).
const texte = async (g: string, p: Record<string, unknown>, l: "fr" | "en" = "fr") =>
  (await renderEmailTemplate(g as never, l, p)).text.replace(/\s+/g, " ");

describe("textes alignés sur le contrat 2.3", () => {
  it("« Retenu », « contrat signé », « commande signée » : prestation réalisée ET payée", async () => {
    for (const [g, p] of [
      ["apporteur-issue-retenu", { contactName: "Claire Martin" }],
      ["apporteur-contrat-signe", { contactName: "Claire Martin" }],
      ["apporteur-commande-signee", { contactName: "Claire Martin", entreprise: "Acme" }],
    ] as const) {
      const t = await texte(g, p);
      expect(t, g).not.toContain("réglé l'intégralité de sa facture");
      expect(t, g).toMatch(/prestation (est|sera) réalisée/);
    }
  });

  it("« Retenu » en anglais : plus de « by simple email », et le versement suit la réalisation", async () => {
    const t = await texte("apporteur-issue-retenu", { contactName: "Claire Martin" }, "en");
    expect(t).not.toContain("by simple email");
    expect(t).toContain("once the service has been delivered");
  });

  it("parrainage : six mois après la signature du contrat par Axion-IA", async () => {
    const t = await texte("apporteur-contrat-signe", { contactName: "Claire Martin" });
    expect(t).toContain("qui suivent la signature de son contrat par Axion-IA");
  });

  it("« Déclaration refusée » : réponse à une contestation sous 30 jours", async () => {
    const t = await texte("apporteur-presentation-refusee", {
      contactName: "Claire Martin",
      entreprise: "Acme",
      motif: "deja-connue",
    });
    expect(t).toMatch(/30 jours/);
    expect(t).not.toMatch(/15 jours/);
  });
});
