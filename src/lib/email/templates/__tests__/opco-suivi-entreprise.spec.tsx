/**
 * Lot OPCO A8 — l'e-mail à l'entreprise : vouvoiement, aucune promesse de
 * délai ni de suivi personnalisé, aucun numéro de téléphone, les boutons de
 * réponse présents, le lien du dossier sans repli en clair, et le budget de
 * liens de sa famille respecté.
 */

import { describe, expect, it } from "vitest";
import { renderEmailTemplate, familleDuHtml } from "../index";
import { REGIME_FAMILLE } from "../_layout";
import type { PayloadSuiviOpco } from "../opco-suivi-entreprise";

const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd";
const base = "https://axion-ia.com/api/qualiopi/suivi-opco";

function payload(p: Partial<PayloadSuiviOpco>): PayloadSuiviOpco {
  return {
    variante: "envoi",
    contactNom: "Claire Martin",
    raisonSociale: "ACME SAS",
    intituleFormation: "L'IA générative au quotidien",
    numeroSession: "AXI-SESS-2026-042",
    dateDebutSession: "16/11/2026",
    nomOpco: "OPCOMMERCE",
    portailUrl: "https://entreprise.lopcommerce.com/forconet/",
    dateLimiteDepot: "30/11/2026",
    lienDossier: `${base}/${JETON}/dossier`,
    liens: {
      oui: `${base}/${JETON}?reponse=oui`,
      pasEncore: `${base}/${JETON}?reponse=pas_encore`,
    },
    ...p,
  };
}

const VARIANTES: PayloadSuiviOpco[] = [
  payload({}),
  payload({ variante: "relance_depot" }),
  payload({
    variante: "relance_reponse",
    lienDossier: null,
    depotFaitLe: "12/10/2026",
    liens: {
      accord: `${base}/${JETON}?reponse=accord`,
      refus: `${base}/${JETON}?reponse=refus`,
      pasEncore: `${base}/${JETON}?reponse=pas_encore`,
    },
  }),
];

/** Texte visible : balises retirées, entités courantes décodées. */
function texteVisible(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("e-mail opco-suivi-entreprise", () => {
  for (const p of VARIANTES) {
    describe(p.variante, () => {
      it("rendu : vouvoiement, sans tutoiement, sans téléphone, sans engagement de délai", async () => {
        const { html, subject } = await renderEmailTemplate("opco-suivi-entreprise", "fr", {
          ...p,
        });
        const t = texteVisible(html);
        expect(subject.length).toBeGreaterThan(10);
        expect(t).toMatch(/\bvous\b|\bvotre\b/);
        expect(t).not.toMatch(/(?<!\p{L})(tu|ton|tes|toi|ta)(?!\p{L})/iu);
        expect(html).not.toMatch(/href="tel:/);
        expect(t).not.toMatch(
          /sous \d+ (heures|jours)|nous vous rappellerons|nous vous recontacterons|suivi personnalisé/i,
        );
      });

      it("boutons de réponse présents ; jeton jamais imprimé en clair hors des liens", async () => {
        const { html } = await renderEmailTemplate("opco-suivi-entreprise", "fr", { ...p });
        for (const href of Object.values(p.liens ?? {})) expect(html).toContain(`href="${href}"`);
        expect(texteVisible(html)).not.toContain(JETON);
      });

      it("budget de liens de sa famille respecté", async () => {
        const { html } = await renderEmailTemplate(
          "opco-suivi-entreprise",
          "fr",
          { ...p },
          "rh@acme.fr",
        );
        const famille = familleDuHtml(html);
        expect(famille).not.toBeNull();
        const liens = new Set((html.match(/href="([^"]+)"/g) ?? []).map((h) => h.slice(6, -1)));
        expect(liens.size).toBeLessThanOrEqual(REGIME_FAMILLE[famille!].budgetLiens);
      });
    });
  }

  it("relance de réponse : accord, refus, pas encore — jamais un montant à saisir", async () => {
    const { html } = await renderEmailTemplate("opco-suivi-entreprise", "fr", { ...VARIANTES[2]! });
    const t = texteVisible(html);
    expect(t).toContain("Accord reçu");
    expect(t).toContain("Refus");
    expect(t).toContain("Pas encore");
    expect(t).not.toMatch(/montant/i);
  });
});
