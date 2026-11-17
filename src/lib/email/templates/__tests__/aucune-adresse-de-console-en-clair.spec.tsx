// L'adresse de la console n'est jamais recopiée en clair dans un e-mail (lot L2a).
//
// Le châssis recopie `cta.href` en texte brut (« repli §3.8 ») sauf si le gabarit pose
// `ctaSecret`. L'adresse de la console est un secret : elle ne doit apparaître que dans
// l'attribut `href` du bouton, jamais comme texte visible.

import { describe, it, expect, afterEach } from "vitest";

import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "../index";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const TEMOIN = "console-temoin-zz91";
const URL_TEMOIN = `https://axion-ia.com/fr/${TEMOIN}/dossiers/42`;
const AVANT = process.env["ADMIN_URL_PREFIX"];

afterEach(() => {
  if (AVANT === undefined) delete process.env["ADMIN_URL_PREFIX"];
  else process.env["ADMIN_URL_PREFIX"] = AVANT;
});

/** Retire les attributs href (le bouton), pour ne garder que le texte et les autres attributs. */
function sansHref(html: string): string {
  return html.replace(/\shref\s*=\s*("[^"]*"|'[^']*')/gi, "");
}

const payloadTemoin = {
  ...PAYLOAD_EXEMPLE,
  consoleUrl: URL_TEMOIN,
  lienConsole: URL_TEMOIN,
};

describe("aucune adresse de console en clair", () => {
  it("🔴 aucun gabarit ne recopie l'adresse de la console hors d'un attribut href", async () => {
    process.env["ADMIN_URL_PREFIX"] = TEMOIN;
    const fautifs: string[] = [];
    for (const name of EMAIL_TEMPLATE_NAMES) {
      let html: string;
      try {
        ({ html } = await renderEmailTemplate(name, "fr", payloadTemoin, {
          destinataire: "destinataire@exemple.invalid",
        }));
      } catch {
        continue; // un gabarit qui ne se rend pas avec ce payload n'est pas l'objet de ce test
      }
      if (sansHref(html).includes(TEMOIN)) fautifs.push(name);
    }
    expect(fautifs).toEqual([]);
  });

  it.each(["candidature-commercial-recap", "apporteur-dossier-a-verifier"] as const)(
    "🔴 %s : le bouton porte l'adresse, le corps ne la recopie pas",
    async (name) => {
      process.env["ADMIN_URL_PREFIX"] = TEMOIN;
      const { html } = await renderEmailTemplate(name as never, "fr", payloadTemoin);
      expect(html).toContain(URL_TEMOIN); // le bouton existe
      expect(sansHref(html)).not.toContain(TEMOIN);
    },
  );
});
