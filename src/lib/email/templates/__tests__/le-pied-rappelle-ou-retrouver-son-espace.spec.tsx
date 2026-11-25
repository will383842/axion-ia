// @vitest-environment node
// « Lien perdu ? » (2026-11-25) : le pied commun rappelle, sous tout e-mail adressé à un
// APPORTEUR (celui qui porte son `lienEspace`), l'adresse où retrouver son espace. Nulle part
// ailleurs. L'adresse est écrite en texte, pas en lien : le budget de liens des familles (§5.4)
// ne bouge pas, et elle ne porte aucun jeton.
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../review-stats", () => ({
  getPublishedReviewStats: async () => ({ count: 0, avg: 0 }),
}));

import { renderEmailTemplate } from "@/lib/email/templates";
import { BASE_URL } from "@/lib/email/templates/_layout";
import { PAYLOAD_EXEMPLE as EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const { lienEspace: _lienFormateur, ...PAYLOAD_EXEMPLE } = EXEMPLE;
const LIEN =
  "https://axion-ia.com/apporteur/dossier/6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/q3Zt9xR2mK8vL1pW7nB4cY6dF0hJ5sA-gE_uT2iO9kM";
const ADRESSE = `${BASE_URL}/apporteur/dossier/retrouver`;
const LIGNE = `Lien perdu ? Retrouvez votre espace : ${ADRESSE}`;
const aPlat = (html: string) =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ");

beforeAll(() => {
  process.env["AUTH_SECRET"] ??= "secret-de-test-suffisamment-long-0123456789";
});

describe("« Lien perdu ? » dans le pied des e-mails", () => {
  it.each([
    "apporteur-attribution-confirmee",
    "apporteur-releve",
    "apporteur-contrat-signe",
  ] as const)("%s adressé à un apporteur : la ligne, une fois, dans le pied", async (gabarit) => {
    const { html, text } = await renderEmailTemplate(gabarit, "fr", {
      ...PAYLOAD_EXEMPLE,
      lienEspace: LIEN,
    });
    expect(aPlat(html).split(LIGNE)).toHaveLength(2);
    expect(html).toMatch(/data-bloc="pied"[\s\S]*Lien perdu/);
    expect(text).toContain(ADRESSE);
    // En texte : aucun lien de plus dans le budget de la famille.
    expect(html).not.toContain(`href="${ADRESSE}"`);
  });

  it("e-mail d'apporteur sans lien d'espace (dossier refusé, aperçu) : absente", async () => {
    const { html } = await renderEmailTemplate("apporteur-attribution-confirmee", "fr", {
      ...PAYLOAD_EXEMPLE,
    });
    expect(html).not.toContain("Lien perdu");
  });

  it.each(["lead-apporteur-recu", "contact-confirmed"] as const)(
    "%s (pas un e-mail d'apporteur) : jamais, même si le payload porte un lien",
    async (gabarit) => {
      const { html } = await renderEmailTemplate(gabarit, "fr", {
        ...PAYLOAD_EXEMPLE,
        lienEspace: LIEN,
      });
      expect(html).not.toContain("Lien perdu");
    },
  );
});
