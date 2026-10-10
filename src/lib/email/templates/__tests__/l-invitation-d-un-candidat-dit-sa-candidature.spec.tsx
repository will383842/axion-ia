// 2026-09-27 (Will) — l'invitation d'une personne qui a POSTULÉ lui dit que sa
// candidature est retenue (pas « merci pour votre intérêt »), change d'objet d'un
// candidat à l'autre et invite à réserver — sans dates fixes ni rareté (2026-10-10) :
// le Calendly suit les disponibilités de Will. Une saisie manuelle garde le
// texte d'origine.

import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "../index";

const BASE = { contactName: "Camille", calendlyUrl: "https://calendly.com/axion-ia/x" };

describe("invitation d'un candidat", () => {
  it("quatre objets DIFFÉRENTS, qui disent tous « votre candidature »", async () => {
    const objets = await Promise.all(
      [0, 1, 2, 3].map(
        async (variante) =>
          (
            await renderEmailTemplate("apporteur-invitation-appel", "fr", {
              ...BASE,
              candidature: true,
              variante,
            })
          ).subject,
      ),
    );
    expect(new Set(objets).size).toBe(4);
    for (const o of objets) expect(o).toMatch(/votre candidature/i);
  });

  it("dit que la candidature est retenue, sans se placer en demandeur", async () => {
    const { html } = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      ...BASE,
      candidature: true,
      variante: 0,
    });
    expect(html).toMatch(/est retenue pour l(?:&#x27;|')étape suivante/);
    expect(html).not.toMatch(/Merci pour votre intérêt/);
    expect(html).toMatch(/Réserver mon créneau/);
    // Anti-requalification : jamais d'« entretien ».
    expect(html).not.toMatch(/entretien/i);
  });

  it("invite à réserver sans rareté (« créneaux limités »), sans annoncer de dates fixes", async () => {
    const { html } = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      ...BASE,
      candidature: true,
    });
    expect(html).toMatch(/Réservez le vôtre dès maintenant avec le bouton ci-dessous\./);
    expect(html).not.toMatch(/limité/i);
    expect(html).not.toMatch(/septembre|octobre/);
  });

  it("porte la signature du fondateur, sans numéro de téléphone", async () => {
    const { html } = await renderEmailTemplate("apporteur-invitation-appel", "fr", {
      ...BASE,
      candidature: true,
    });
    expect(html).toContain("Williams Jullin");
    expect(html).toMatch(/Fondateur/);
    // Signature COURTE : ni le discours client (vouvoiement) ni l'agenda client.
    expect(html).not.toMatch(/Prendre rendez-vous/);
    expect(html).not.toMatch(/Vous entendez parler/);
    expect(html).toMatch(/LinkedIn/);
    expect(html).not.toMatch(/\+33|0[67](?:[ .]?\d{2}){4}/);
  });

  it("une invitation SANS la marque candidature garde son objet et son texte d'origine", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-appel", "fr", BASE);
    expect(r.subject).toBe("Et si on en parlait 15 minutes ?");
    expect(r.html).toMatch(/Merci pour votre intérêt/);
    expect(r.html).not.toMatch(/créneaux sont limités/);
  });
});
