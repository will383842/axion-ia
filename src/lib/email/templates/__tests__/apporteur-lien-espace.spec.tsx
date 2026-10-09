// @vitest-environment node
// L'e-mail « Le lien de votre espace d'apporteur » : son bouton mène au lien personnel, qui
// n'est JAMAIS recopié en clair (il porte le jeton) ; vouvoiement, mise en garde contre le
// transfert ; et il se rend même sans payload.
import { beforeAll, describe, expect, it } from "vitest";

import { renderEmailTemplate } from "@/lib/email/templates";

const LIEN = "https://axion-ia.com/apporteur/dossier/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/QzAb12cd34ef56gh78ij90kl12mn34op56qr78st9";

beforeAll(() => {
  process.env["AUTH_SECRET"] ??= "secret-de-test-suffisamment-long-0123456789";
});

describe("apporteur-lien-espace", () => {
  it("le bouton mène au lien, l'adresse n'apparaît qu'une fois (dans le bouton)", async () => {
    const { subject, html, text } = await renderEmailTemplate("apporteur-lien-espace", "fr", {
      prenom: "Claire",
      lien: LIEN,
    });
    expect(subject).toBe("Le lien de votre espace d'apporteur");
    expect(html.split(LIEN).length - 1).toBe(1);
    expect(html).toContain("Bonjour Claire,");
    expect(text).toContain("ne transférez pas cet e-mail");
    expect(text).not.toMatch(/\btu\b|\bton\b/i);
  });

  it("se rend sans payload (aucune exception)", async () => {
    const { html } = await renderEmailTemplate("apporteur-lien-espace", "fr", {});
    expect(html).toContain("Bonjour,");
  });
});
