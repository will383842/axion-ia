// V8-E1 — palette définitive du châssis des e-mails, clair et sombre.
// Garde aussi que le bloc signature ne porte JAMAIS le numéro de téléphone de Williams.

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "./index";
import { EMAIL_LEGAL } from "@/lib/email/legal-footer";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";

const MODELES = [
  "audit-confirmed",
  "implementation-confirmed",
  "qualiopi-suivi-j30",
  "contact-confirmed",
  "quote-request-received",
  "rappel-confirme",
] as const;

async function rendre(nom: string): Promise<string> {
  const { html } = await renderEmailTemplate(nom as never, "fr", PAYLOAD_EXEMPLE);
  return html;
}

function blocSombre(html: string): string {
  const debut = html.indexOf("prefers-color-scheme: dark");
  expect(debut).toBeGreaterThan(-1);
  return html.slice(debut, html.indexOf("max-width: 600px", debut));
}

describe("châssis e-mail — palette définitive", () => {
  for (const nom of MODELES) {
    it(`${nom} : clair, ivoire/noir/terracotta, Manrope, ni bleu ni dégradé`, async () => {
      const html = await rendre(nom);
      const bas = html.toLowerCase();
      expect(bas).toContain("#faf9f5");
      expect(bas).toContain("#141413");
      expect(bas).toContain("#b23f16");
      expect(bas).toContain("manrope");
      for (const interdit of ["#1a4dd9", "#c24a1b", "georgia", "gradient(", "#f6f1e8"]) {
        expect(bas, `${nom} porte ${interdit}`).not.toContain(interdit);
      }
    });

    it(`${nom} : sombre, fond noir, textes ivoire, liens orange`, async () => {
      const sombre = blocSombre(await rendre(nom)).toLowerCase();
      expect(sombre).toContain("background-color: #141413");
      expect(sombre).toContain("color: #faf9f5");
      expect(sombre).toContain("color: #b0aea5");
      expect(sombre).toContain("color: #d97757");
      expect(sombre).not.toContain("#f0a070");
    });

    it(`${nom} : aucune couleur rgba()/rgb()/hsl() hors palette`, async () => {
      const html = await rendre(nom);
      const PALETTE = [
        [250, 249, 245],
        [232, 230, 220],
        [20, 20, 19],
        [178, 63, 22],
        [217, 119, 87],
        [176, 174, 165],
        [255, 255, 255],
      ];
      const hors: string[] = [];
      for (const m of html.matchAll(/\b(rgba?|hsla?)\(([^)]*)\)/gi)) {
        const fn = m[1]!.toLowerCase();
        const n = m[2]!
          .split(/[ ,/]+/)
          .filter(Boolean)
          .slice(0, 3)
          .map(Number);
        const ok = fn.startsWith("rgb") && PALETTE.some((p) => p.every((v, i) => v === n[i]));
        if (!ok) hors.push(m[0]);
      }
      expect(hors, `${nom} : couleurs hors palette`).toEqual([]);
    });

    it(`${nom} : sombre, les liens du pied sont orange sur noir`, async () => {
      const html = await rendre(nom);
      expect(html).toContain("ax-link");
      expect(blocSombre(html).toLowerCase()).toMatch(/\.ax-link[^}]*color: #d97757/);
    });

    it(`${nom} : HTML sous 100 Ko`, async () => {
      expect(Buffer.byteLength(await rendre(nom), "utf8")).toBeLessThan(100 * 1024);
    });

    it(`⛔ ${nom} : la signature ne porte pas le téléphone`, async () => {
      const html = await rendre(nom);
      expect(html).not.toContain(EMAIL_LEGAL.phone);
      expect(html).not.toContain(EMAIL_LEGAL.phoneTel);
    });
  }
});
