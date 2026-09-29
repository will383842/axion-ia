/**
 * ⛔ Le préavis dit QUI traite la parole, POURQUOI, COMBIEN DE TEMPS, et que le
 * client peut REFUSER.
 *
 * ## Pourquoi
 *
 * Le 28/09 au soir, Will a choisi le crédit API OpenAI pour la transcription et
 * le compte rendu (ADR 0055). Les versions précédentes du plan nommaient
 * Mistral, puis Anthropic, puis « le son reste sur le poste ». Un préavis qui
 * garderait un de ces restes informerait le client d'un traitement qui
 * n'existe pas — et tairait celui qui existe : son de la réunion envoyé aux
 * États-Unis.
 *
 * ## Ce que la garde vérifie
 *
 * Le texte rendu (via le routeur réel `renderEmailTemplate`) contient OpenAI,
 * les États-Unis, le compte rendu, l'accord, les 30 jours, le refus, les deux
 * liens (sous-traitants, politique) et une date d'effet = aujourd'hui + 30 j ;
 * il ne contient ni Mistral, ni Anthropic, ni Claude, ni « le son reste sur »,
 * ni « démarre », ni numéro de téléphone.
 *
 * Mutation vérifiée : remplacer « OpenAI, LLC » par « Mistral AI » dans
 * `preavis-sous-traitants.tsx` → rouge. Contre-témoin : le même test sur un
 * autre gabarit du parc (`vivier-information`) ne contient pas « OpenAI » —
 * la recherche ne réussit pas par hasard sur le pied de page commun.
 *
 * Angle mort avoué : la garde lit des MOTS, pas le sens. Une phrase qui dirait
 * « OpenAI n'est pas utilisé » passerait. Le texte est relu par Will dans la
 * file de validation avant de partir (point d'arrêt du chantier).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderEmailTemplate } from "../index";
import { dateEffetPreavis, formaterDateEffet } from "../preavis-sous-traitants";

function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

const MAINTENANT = new Date("2026-09-30T08:00:00.000Z");

describe("préavis — OpenAI, la finalité, la durée, le refus", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MAINTENANT);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("⛔ nomme OpenAI, les États-Unis, le compte rendu, l'accord et les 30 jours", async () => {
    const { html, text } = await renderEmailTemplate("preavis-sous-traitants", "fr", {});
    const t = texte(html);
    for (const attendu of [
      "OpenAI",
      "États-Unis",
      "clauses contractuelles types",
      "compte rendu",
      "accord",
      "30 jours",
      "refuser",
      "retirer votre accord",
      "entraîner ses modèles",
      "Google Meet",
    ]) {
      expect(t, `« ${attendu} » absent du préavis`).toContain(attendu);
    }
    expect(text).toContain("OpenAI");
  });

  it("⛔ ne nomme aucun fournisseur abandonné ni l'ancienne promesse", async () => {
    const { html, subject } = await renderEmailTemplate("preavis-sous-traitants", "fr", {});
    const t = `${subject} ${texte(html)}`;
    for (const interdit of [/mistral/i, /anthropic/i, /claude/i, /le son reste sur/i, /démarr/i]) {
      expect(t, `${interdit} présent dans le préavis`).not.toMatch(interdit);
    }
    // Aucun numéro de téléphone public (ordre permanent).
    expect(t).not.toMatch(/(\+33|\b0[1-9])([ .]?\d{2}){4}/);
  });

  it("⛔ la date d'effet est la date du rendu (donc de l'envoi) + 30 jours", async () => {
    const { html } = await renderEmailTemplate("preavis-sous-traitants", "fr", {});
    const attendue = formaterDateEffet(dateEffetPreavis(MAINTENANT));
    expect(attendue).toBe("30 octobre 2026");
    expect(texte(html)).toContain(`À partir du ${attendue}`);
  });

  it("renvoie vers la page des sous-traitants et la politique de confidentialité", async () => {
    const { html } = await renderEmailTemplate("preavis-sous-traitants", "fr", {});
    expect(html).toMatch(/href="[^"]*\/fr\/sous-processeurs"/);
    expect(html).toMatch(/href="[^"]*\/fr\/politique-confidentialite"/);
  });

  it("contre-témoin : un autre gabarit du parc ne nomme pas OpenAI", async () => {
    const { html } = await renderEmailTemplate("vivier-information", "fr", {});
    expect(texte(html)).not.toContain("OpenAI");
  });
});
