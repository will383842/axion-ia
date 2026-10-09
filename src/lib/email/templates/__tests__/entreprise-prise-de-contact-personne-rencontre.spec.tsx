import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "@/lib/email/templates";
import { texteParDefaut } from "@/lib/email/templates/apporteur-demarrage";

// Contrat 2.7 (art. 3.2) : quand l'apporteur a été représenté (associé, salarié), la prise de
// contact nomme la personne rencontrée ; sans elle, le texte est celui d'avant, mot pour mot.
// Règle permanente : l'e-mail ne dit JAMAIS à l'entreprise qu'on vérifie l'apporteur.

const base = {
  contactName: "Claire Durand",
  nomApporteur: "Éloïse Lefèvre",
  entreprise: "Boulangerie Martin",
};

describe("prise de contact : la personne qui a rencontré l'entreprise", () => {
  it("renseignée : citée dans la phrase de présentation", async () => {
    const r = await renderEmailTemplate("entreprise-prise-de-contact-apporteur", "fr", {
      ...base,
      personneRencontre: "Paul Associé",
    });
    expect(r.html).toContain(
      "Éloïse Lefèvre, qui a échangé avec vous par l&#x27;intermédiaire de Paul Associé, m&#x27;a parlé de votre intérêt pour l&#x27;intelligence artificielle chez Boulangerie Martin",
    );
    expect(r.html).not.toMatch(/vérifi|contrôl/i);
    expect(
      texteParDefaut("entreprise-prise-de-contact-apporteur", {
        ...base,
        personneRencontre: "Paul Associé",
      }),
    ).toContain("qui a échangé avec vous par l'intermédiaire de Paul Associé,");
  });

  it("vide : texte d'avant inchangé", async () => {
    const r = await renderEmailTemplate("entreprise-prise-de-contact-apporteur", "fr", base);
    expect(r.html).toContain(
      "Éloïse Lefèvre m&#x27;a parlé de votre intérêt pour l&#x27;intelligence artificielle chez Boulangerie Martin, et je me permets de vous écrire pour me présenter.",
    );
    expect(r.html).not.toContain("par l&#x27;intermédiaire de");
  });
});
