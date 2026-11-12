// Lot S2 — l'e-mail du guide d'une demande venue de la PAGE « Recevoir le guide » porte un lien de
// désinscription (porte d'opposition) ; celui du chemin « adresse tapée dans la conversation »
// ne change pas d'un octet.
import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "@/lib/email/templates";
import { jetonOpposition } from "@/server/email/opposition-jeton";

const D = "d".repeat(64);
const OP = jetonOpposition("personne@example.test");

describe("e-mail du guide — page « Recevoir le guide »", () => {
  it("porte le lien de désinscription (/api/unsubscribe) et la politique de confidentialité", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: D,
      reseau: true,
      pageGuide: true,
      oppositionToken: OP,
    });
    expect(r.html).toContain(`/api/unsubscribe?token=${encodeURIComponent(OP)}`);
    expect(r.html).toContain("/fr/politique-confidentialite");
    expect(r.html).toContain(`/api/guide-ia/telecharger?t=${D}`);
    expect(r.html).not.toContain("/confirmation/newsletter");
    expect(r.html).not.toContain("/fr/desabonnement");
    expect(r.text).not.toMatch(/Oui, je confirme|newsletter|STOP/i);
  });

  it("sans `reseau`, `pageGuide` est ignoré (rien ne s'ajoute à la lettre du formulaire)", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", {
      downloadToken: D,
      pageGuide: true,
      oppositionToken: OP,
    });
    expect(r.html).not.toContain("/api/unsubscribe");
  });

  it("le chemin de la conversation (reseau: true seul) est identique à avant : aucun lien de désinscription", async () => {
    const r = await renderEmailTemplate("guide-ia-envoi", "fr", { downloadToken: D, reseau: true });
    expect(r.html).not.toContain("/api/unsubscribe");
    expect(r.html).not.toContain("Me désinscrire");
  });
});
