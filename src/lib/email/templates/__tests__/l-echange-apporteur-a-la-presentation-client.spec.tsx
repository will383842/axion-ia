/**
 * Les e-mails de l'échange apporteur ont la présentation des e-mails clients
 * (décision de Will, 2026-10-07 : « le parcours apporteur doit avoir le même
 * design que le parcours client »).
 *
 * Ce qui est figé :
 *   · la confirmation répond en un coup d'œil — le récapitulatif AVANT la
 *     salutation ;
 *   · un bouton « Rejoindre la visioconférence » aux trois moments, dès que le
 *     lien existe — et aucun bouton sans lien ;
 *   · les liens « déplacer » et « annuler » du SITE (ceux que la file passe),
 *     plus jamais « depuis l'invitation d'agenda » ;
 *   · le vouvoiement, les mots du candidat (jamais « appel de découverte »), et
 *     pas le guide IA entreprise.
 */
import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const LIEN_VISIO = "https://meet.google.com/abc-defg-hij";
const DEPLACER = "https://axion-ia.com/fr/appel/deplacer?t=jeton-d";
const ANNULER = "https://axion-ia.com/fr/appel/annuler?t=jeton-a";

const BASE = {
  prenom: "Léa",
  heure: "11:30",
  date: "vendredi 9 octobre",
  dureeMinutes: 15,
  format: "visio",
  cancelUrl: ANNULER,
  rescheduleUrl: DEPLACER,
};

const JOBS = {
  confirmation: "apporteur-echange-confirme",
  j1: "apporteur-echange-rappel-j1",
  h1: "apporteur-echange-rappel",
} as const;

async function rendre(moment: keyof typeof JOBS, extra: Record<string, unknown> = {}) {
  return renderEmailTemplate(JOBS[moment], "fr", { ...BASE, moment, ...extra });
}

function texte(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");
}

describe("échange apporteur — la présentation des clients", () => {
  it("confirmation : le récapitulatif (quand, durée, format) vient AVANT « Bonjour »", async () => {
    const t = texte((await rendre("confirmation", { lieu: LIEN_VISIO })).html);
    const recap = t.indexOf("Votre rendez-vous");
    expect(recap).toBeGreaterThan(-1);
    expect(t).toContain("vendredi 9 octobre à 11:30");
    expect(t).toContain("15 minutes");
    expect(t).toContain("Visioconférence");
    expect(recap).toBeLessThan(t.indexOf("Bonjour Léa"));
    expect(t).toContain("Ce qui se passe maintenant");
  });

  it.each(["confirmation", "j1", "h1"] as const)(
    "%s : bouton « Rejoindre la visioconférence » vers le lien de visio",
    async (moment) => {
      const { html } = await rendre(moment, { lieu: LIEN_VISIO });
      expect(html).toMatch(
        new RegExp(
          `<a[^>]+href="${LIEN_VISIO}"[^>]*class="ax-cta"|class="ax-cta"[^>]*href="${LIEN_VISIO}"`,
        ),
      );
      expect(texte(html)).toContain("Rejoindre la visioconférence");
    },
  );

  it.each(["confirmation", "j1", "h1"] as const)(
    "%s : sans lien de visio, aucun bouton — on renvoie à l'invitation d'agenda",
    async (moment) => {
      const { html } = await rendre(moment);
      expect(texte(html)).not.toContain("Rejoindre la visioconférence");
      expect(texte(html)).toContain("invitation d'agenda");
    },
  );

  it.each(["confirmation", "j1", "h1"] as const)(
    "%s : les liens déplacer / annuler du SITE, plus « depuis l'invitation d'agenda »",
    async (moment) => {
      const { html } = await rendre(moment, { lieu: LIEN_VISIO });
      expect(html).toContain(`href="${DEPLACER}"`);
      expect(html).toContain(`href="${ANNULER}"`);
      expect(texte(html)).not.toMatch(/replanifier ou annuler depuis l'invitation/i);
    },
  );

  it.each(["confirmation", "j1", "h1"] as const)(
    "%s : vouvoiement, mots du candidat, pas de guide IA entreprise",
    async (moment) => {
      const r = await rendre(moment, { lieu: LIEN_VISIO });
      const t = texte(r.html);
      expect(t).toMatch(/\bvous\b|\bvotre\b/i);
      expect(` ${t} `).not.toMatch(/\s(tu|ton|ta|tes|toi)\s/i);
      expect(t).not.toMatch(/découverte|prospect/i);
      expect(r.html).not.toContain("guide-ia");
      expect(r.subject).toMatch(/échange/i);
    },
  );

  it("charge vide : ni « undefined », ni bouton, ni lien inventé", async () => {
    const r = await renderEmailTemplate("apporteur-echange-confirme", "fr", {
      moment: "confirmation",
    });
    expect(r.html).not.toContain("undefined");
    expect(r.subject).not.toContain("undefined");
    expect(texte(r.html)).not.toContain("Rejoindre la visioconférence");
  });
});
