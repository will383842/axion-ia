// @vitest-environment node

/**
 * Verrou — le lien « Supprimer ma candidature » (2026-10-11).
 *
 *  · les e-mails aux candidats d'offres d'emploi le portent, en pied de
 *    message, quand l'appelant fournit le lien signé ;
 *  · sans lien fourni (aperçus, anciens envois), rien n'apparaît ;
 *  · ⛔ les e-mails des apporteurs d'affaires ne le portent JAMAIS, même si on
 *    leur passait le lien par erreur.
 *  · le budget de liens de la famille reste tenu pour les gabarits B et C.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "../index";
import { REGIME_FAMILLE } from "../_layout";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const LIEN = "https://axion-ia.com/fr/candidature/supprimer?token=jeton-de-test";
const MARQUE = "/candidature/supprimer";

const GABARITS_CANDIDATS = ["candidature-recue", "candidature-reponse", "vivier-information"];

const GABARITS_APPORTEURS = EMAIL_TEMPLATE_NAMES.filter(
  (n) => n.includes("apporteur") || n.startsWith("candidature-commercial"),
);

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
});

function liensDistincts(html: string): Set<string> {
  return new Set((html.match(/href="([^"]+)"/g) ?? []).map((h) => h.slice(6, -1)));
}

describe("les e-mails aux candidats portent le lien", () => {
  for (const nom of GABARITS_CANDIDATS) {
    it(`${nom} : le lien est là, en clair et en texte`, async () => {
      const { html, text } = await renderEmailTemplate(
        nom as (typeof EMAIL_TEMPLATE_NAMES)[number],
        "fr",
        { ...PAYLOAD_EXEMPLE, lienSuppression: LIEN },
      );
      expect(html).toContain(`href="${LIEN}"`);
      expect(html).toContain("Supprimer ma candidature");
      expect(text).toContain("Supprimer ma candidature");
    });

    it(`${nom} : sans lien fourni, aucune ligne`, async () => {
      const { html } = await renderEmailTemplate(
        nom as (typeof EMAIL_TEMPLATE_NAMES)[number],
        "fr",
        PAYLOAD_EXEMPLE,
      );
      expect(html).not.toContain(MARQUE);
      expect(html).not.toContain("Supprimer ma candidature");
    });
  }

  it("le lien est bleu (charte : liens en bleu)", async () => {
    const { html } = await renderEmailTemplate("candidature-recue", "fr", {
      ...PAYLOAD_EXEMPLE,
      lienSuppression: LIEN,
    });
    const balise = new RegExp(`<a[^>]*href="${LIEN.replace(/[?.]/g, "\\$&")}"[^>]*>`).exec(html);
    expect(balise?.[0]).toMatch(/color:\s*#1a4dd9/i);
  });

  for (const nom of ["candidature-recue", "candidature-reponse"] as const) {
    it(`${nom} : le budget de liens de sa famille reste tenu`, async () => {
      const { html, famille } = await renderEmailTemplate(
        nom,
        "fr",
        { ...PAYLOAD_EXEMPLE, lienSuppression: LIEN },
        { destinataire: "candidat@exemple.fr" },
      );
      expect(famille).not.toBeNull();
      expect(liensDistincts(html).size).toBeLessThanOrEqual(REGIME_FAMILLE[famille!].budgetLiens);
    });
  }
});

describe("⛔ les e-mails des apporteurs ne le portent pas", () => {
  it("témoin de non-vacuité : la liste des gabarits apporteurs n'est pas vide", () => {
    expect(GABARITS_APPORTEURS.length).toBeGreaterThan(10);
  });

  for (const nom of GABARITS_APPORTEURS) {
    it(`${nom} : jamais de lien de suppression, même passé par erreur`, async () => {
      const { html } = await renderEmailTemplate(nom, "fr", {
        ...PAYLOAD_EXEMPLE,
        lienSuppression: LIEN,
      });
      expect(html).not.toContain(MARQUE);
      expect(html).not.toContain("Supprimer ma candidature");
    });
  }
});
