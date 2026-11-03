// Décision de Will du 03/11/2026 : l'e-mail du guide d'une demande venue d'un réseau porte le lien
// de la politique de confidentialité et AUCUNE proposition d'autres envois.
import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "@/lib/email/templates";

const D = "d".repeat(64);

describe("e-mail du guide — demande venue d'un réseau", () => {
  it("lien vers la politique de confidentialité, et rien d'autre à confirmer ou à recevoir", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: D,
      reseau: true,
      // Même si des jetons traînent dans la charge, ils ne sont jamais rendus.
      doubleAccordToken: "a".repeat(64),
      confirmToken: "c".repeat(64),
      unsubscribeToken: "u".repeat(64),
    });
    expect(r.html).toContain("/fr/politique-confidentialite");
    expect(r.html).toContain(`/api/guide-ia/telecharger?t=${D}`);
    expect(r.html).not.toContain("/confirmation/newsletter");
    expect(r.html).not.toContain("/desabonnement");
    expect(r.text).not.toMatch(/Oui, je confirme|lettre|STOP|Recevoir/i);
  });

  it("sans `reseau`, le comportement de la lettre du formulaire est inchangé", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: D,
      unsubscribeToken: "u".repeat(64),
    });
    expect(r.html).toContain("/fr/desabonnement?token=");
    expect(r.html).not.toContain("/fr/politique-confidentialite");
  });
});
