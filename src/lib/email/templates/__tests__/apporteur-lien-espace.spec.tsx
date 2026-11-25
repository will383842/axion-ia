// @vitest-environment node
// L'e-mail « Le lien de votre espace d'apporteur » : son bouton mène au lien personnel, qui
// n'est JAMAIS recopié en clair (il porte le jeton) ; vouvoiement, mise en garde contre le
// transfert ; et il se rend même sans payload.
import { beforeAll, describe, expect, it } from "vitest";

import { renderEmailTemplate } from "@/lib/email/templates";
import { CATALOGUE } from "@/server/email/apercu/catalogue";
import { LIBELLE_TEMPLATE_EMAIL } from "@/server/email/outbox-policy";

const LIEN =
  "https://axion-ia.com/apporteur/dossier/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/QzAb12cd34ef56gh78ij90kl12mn34op56qr78st9";

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

  // Relecture de la PR #2255 (I1) : le texte « à sa demande » ne bouge pas d'un mot.
  it("à la demande de l'apporteur (charge sans origine) : texte inchangé au mot près", async () => {
    const { text } = await renderEmailTemplate("apporteur-lien-espace", "fr", {
      prenom: "Claire",
      lien: LIEN,
    });
    expect(text).toContain(
      "Voici le lien de votre espace d'apporteur Axion-IA, comme vous l'avez demandé.",
    );
    expect(text).toContain(
      "Ce lien vous est personnel : ne transférez pas cet e-mail. Si vous n'êtes pas à l'origine de cette demande, ignorez-le simplement.",
    );
  });

  it("🔴 envoyé depuis la console : ni « comme vous l'avez demandé », ni « si vous n'êtes pas à l'origine »", async () => {
    const { subject, html, text } = await renderEmailTemplate("apporteur-lien-espace", "fr", {
      prenom: "Claire",
      lien: LIEN,
      origine: "console",
    });
    expect(subject).toBe("Le lien de votre espace d'apporteur");
    expect(text).toContain("Voici le lien de votre espace d'apporteur Axion-IA.");
    expect(text).toContain("Ce lien vous est personnel : ne transférez pas cet e-mail.");
    // Le CORPS seul : le pied commun de la famille A (« Vous n'êtes pas à l'origine de cette
    // demande ? Écrivez-nous ») appartient au gabarit de base, partagé par tous ses e-mails.
    const corps = html.slice(
      html.indexOf('data-bloc="debut-corps"'),
      html.indexOf('data-bloc="fin-corps"'),
    );
    expect(corps).toContain("Bonjour Claire,");
    expect(corps).not.toContain("demandé");
    expect(corps).not.toContain("origine de cette demande");
    for (const rendu of [html, text]) {
      expect(rendu).not.toContain("comme vous l");
      expect(rendu).not.toMatch(/Si vous n(&#x27;|')êtes pas/);
      expect(rendu).not.toContain("ignorez-le");
    }
    expect(html.split(LIEN).length - 1).toBe(1);
  });

  it("une origine inconnue se lit comme une demande de l'apporteur (texte d'origine)", async () => {
    const { text } = await renderEmailTemplate("apporteur-lien-espace", "fr", {
      lien: LIEN,
      origine: "autre",
    });
    expect(text).toContain("comme vous l'avez demandé");
  });

  it("le catalogue et la politique d'envoi disent les DEUX origines", () => {
    const fiche = CATALOGUE["apporteur-lien-espace"];
    expect(fiche.destinataire).not.toBe("l'apporteur du réseau qui a demandé son lien");
    expect(fiche.destinataire).toContain("console");
    expect(LIBELLE_TEMPLATE_EMAIL["apporteur-lien-espace"]).toContain("console");
    expect(LIBELLE_TEMPLATE_EMAIL["apporteur-lien-espace"]).toContain("à sa demande");
  });
});
