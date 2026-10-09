// @vitest-environment node
// « Ouvrir mon espace d'apporteur » (décision de Will, 2026-10-09) : le gabarit de base
// l'affiche sous tout e-mail d'APPORTEUR qui porte `lienEspace`, et nulle part ailleurs ; pas
// en double quand le bouton principal mène déjà au même lien.
import { beforeAll, describe, expect, it, vi } from "vitest";

// Entrelacement forcé : le premier rendu attend ses statistiques d'avis plus longtemps que le
// second (même procédé que `deux-rendus-simultanes-ne-s-echangent-pas-leur-lien.spec.tsx`).
const h = vi.hoisted(() => ({ appels: 0 }));
vi.mock("../../review-stats", () => ({
  getPublishedReviewStats: async () => {
    h.appels += 1;
    if (h.appels % 2 === 1) await new Promise((r) => setTimeout(r, 40));
    return { count: 0, avg: 0 };
  },
}));

import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { renderEmailTemplate } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE as EXEMPLE } from "@/server/email/apercu/payloads-exemple";

// Le payload d'exemple porte déjà un `lienEspace` (celui des formateurs) : on l'en retire pour
// que « sans lienEspace » le soit vraiment.
const { lienEspace: _lienFormateur, ...PAYLOAD_EXEMPLE } = EXEMPLE;
const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
// Même forme que `urlDossier` : UUID + HMAC-SHA256 en base64url (43 caractères).
const JETON = "q3Zt9xR2mK8vL1pW7nB4cY6dF0hJ5sA-gE_uT2iO9kM";
const LIEN = `https://axion-ia.com/apporteur/dossier/${ID}/${JETON}`;
const BOUTON = "Ouvrir mon espace d&#x27;apporteur";
const compte = (html: string, s: string) => html.split(s).length - 1;

beforeAll(() => {
  process.env["AUTH_SECRET"] ??= "secret-de-test-suffisamment-long-0123456789";
});

describe("le bouton « Ouvrir mon espace »", () => {
  it("e-mail d'apporteur avec lienEspace : présent, vers son lien", async () => {
    const { html } = await renderEmailTemplate("apporteur-attribution-confirmee", "fr", {
      ...PAYLOAD_EXEMPLE,
      lienEspace: LIEN,
    });
    expect(compte(html, BOUTON)).toBe(1);
    expect(html).toContain(`href="${LIEN}"`);
    expect(html).toContain("Ce lien vous est personnel : ne transférez pas cet e-mail.");
  });

  it("e-mail d'apporteur sans lienEspace : absent", async () => {
    const { html } = await renderEmailTemplate("apporteur-attribution-confirmee", "fr", {
      ...PAYLOAD_EXEMPLE,
    });
    expect(compte(html, BOUTON)).toBe(0);
  });

  it("le rendu suivant ne garde pas le lien du précédent", async () => {
    await renderEmailTemplate("apporteur-attribution-confirmee", "fr", {
      ...PAYLOAD_EXEMPLE,
      lienEspace: LIEN,
    });
    const { html } = await renderEmailTemplate("apporteur-releve", "fr", { ...PAYLOAD_EXEMPLE });
    expect(compte(html, BOUTON)).toBe(0);
  });

  it("e-mail qui n'est pas d'apporteur : jamais, même si le payload le porte", async () => {
    const { html } = await renderEmailTemplate("lead-apporteur-recu", "fr", {
      ...PAYLOAD_EXEMPLE,
      lienEspace: LIEN,
    });
    expect(compte(html, BOUTON)).toBe(0);
  });

  it("la copie console masque le jeton du lien (ni l'UUID ni le HMAC en clair)", async () => {
    const rendu = await renderEmailTemplate("apporteur-attribution-confirmee", "fr", {
      ...PAYLOAD_EXEMPLE,
      lienEspace: LIEN,
    });
    expect(rendu.html).toContain(JETON);
    const copie = masquerSecretsEmail(rendu);
    for (const champ of [copie.html, copie.text]) {
      expect(champ).not.toContain(JETON);
      expect(champ).not.toContain(ID);
    }
    expect(copie.html).toContain("https://axion-ia.com/apporteur/dossier/");
  });

  it("deux e-mails rendus EN MÊME TEMPS : chacun ne porte que SON lien d'espace", async () => {
    const JETON_B = "Zb7Kq2Wm9Xr4Lp1Vn8Ty3Uc6Hd0Gf5Sa-jE_kR7oP2iQ";
    const LIEN_B = `https://axion-ia.com/apporteur/dossier/7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b4c/${JETON_B}`;
    for (let essai = 0; essai < 3; essai++) {
      const [a, b] = await Promise.all([
        renderEmailTemplate("apporteur-attribution-confirmee", "fr", {
          ...PAYLOAD_EXEMPLE,
          lienEspace: LIEN,
        }),
        renderEmailTemplate("apporteur-attribution-confirmee", "fr", {
          ...PAYLOAD_EXEMPLE,
          lienEspace: LIEN_B,
        }),
      ]);
      expect(a.html).toContain(JETON);
      expect(a.html).not.toContain(JETON_B);
      expect(b.html).toContain(JETON_B);
      expect(b.html).not.toContain(JETON);
      expect(a.text).not.toContain(JETON_B);
      expect(b.text).not.toContain(JETON);
    }
  });
});
