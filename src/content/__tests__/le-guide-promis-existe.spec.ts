/**
 * Verrou — le guide que promet `/guide-ia` EXISTE, et la page dit comment l'avoir.
 *
 * ## Le constat (2026-09-23)
 *
 * La page promettait un « Guide IA entreprise · 40 pages », un « téléchargement
 * immédiat après inscription » et, après envoi du formulaire, « Guide envoyé.
 * Vérifiez votre boîte ». Il n'existait AUCUN PDF : le formulaire ne pose que
 * l'e-mail de double opt-in, et la page de confirmation ne parlait d'aucun guide.
 * Trois phrases fausses, qu'aucun test ne lisait.
 *
 * ## Ce que ce verrou fige
 *
 *   1. le PDF est servi, et il a le nombre de pages que la page annonce ;
 *   2. la page ne promet plus un envoi ni un téléchargement « immédiat » ;
 *   3. la page de confirmation porte le lien de téléchargement ;
 *   4. l'e-mail de double opt-in annonce le guide sans ajouter de lien (famille A) ;
 *   5. (lot L2, 2026-09-24) la page dit que le guide part TOUT DE SUITE par
 *      e-mail — c'est désormais vrai — et l'e-mail « Votre guide » porte le lien
 *      PERSONNEL, jamais le PDF direct.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GUIDE_IA_CHEMIN, GUIDE_IA_PAGES, urlGuideIa } from "@/content/guide-ia";
import { IMPRIMES } from "@/content/imprimes";
import { textesPageGuide } from "@/content/guide-ia-page";
import { renderEmailTemplate } from "@/lib/email/templates";

const RACINE = process.cwd();
const PDF = path.join(RACINE, "public", GUIDE_IA_CHEMIN);
const PAGE_GUIDE = path.join(RACINE, "src/app/[locale]/guide-ia/page.tsx");
const TEXTES_GUIDE = path.join(RACINE, "src/content/guide-ia-page.ts");
const PAGE_CONFIRMATION = path.join(RACINE, "src/app/[locale]/confirmation/newsletter/page.tsx");

/**
 * Nombre d'objets `/Type /Page` du PDF. Le rendu Chrome/Skia ne compresse pas
 * les objets de page : le décompte brut est exact (contrôlé contre pypdf le
 * 2026-09-23 : 40 = 40). Un PDF réécrit avec des flux d'objets rendrait 0, et
 * ce test rougirait — ce qui est la bonne réponse : il faudrait alors le relire.
 */
function pagesDuPdf(fichier: string): number {
  const brut = readFileSync(fichier, "latin1");
  return (brut.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}

describe("le PDF du guide est servi", () => {
  it("🔴 le fichier existe sous public/ — sinon le bouton de confirmation mène à un 404", () => {
    expect(existsSync(PDF), `${GUIDE_IA_CHEMIN} absent de public/`).toBe(true);
  });

  it("🔴 il a le nombre de pages que la page /guide-ia annonce", () => {
    expect(pagesDuPdf(PDF)).toBe(GUIDE_IA_PAGES);
  });

  it("reste sous 10 Mo — un e-mail y renvoie, souvent ouvert sur mobile", () => {
    expect(statSync(PDF).size).toBeLessThan(10 * 1024 * 1024);
  });

  it("figure dans l'onglet Imprimés, avec le même chemin", () => {
    const chemins = IMPRIMES.flatMap((i) => i.fichiersPublics.map((f) => f.chemin));
    expect(chemins).toContain(GUIDE_IA_CHEMIN);
  });

  it("l'URL absolue ne double pas la barre oblique", () => {
    expect(urlGuideIa("https://axion-ia.com/")).toBe(`https://axion-ia.com/${GUIDE_IA_CHEMIN}`);
  });
});

describe("la page /guide-ia dit vrai sur la façon d'obtenir le guide", () => {
  // Lot L1 (2026-09-25) : les textes de la page vivent dans
  // `content/guide-ia-page.ts`. La promesse se lit donc dans les deux sources
  // — la page (structure, JSON-LD) et son module de textes.
  const source = `${readFileSync(PAGE_GUIDE, "utf8")}
${readFileSync(TEXTES_GUIDE, "utf8")}`;
  const fr = textesPageGuide("fr");

  it("🔴 ne promet plus un envoi qui n'a pas lieu, ni un téléchargement « immédiat »", () => {
    expect(source).not.toContain("Guide envoyé");
    expect(source).not.toContain("Guide sent");
    expect(source).not.toContain("Téléchargement immédiat");
    expect(source).not.toContain("Instant download");
  });

  it("🔴 L2 — dit que le guide part tout de suite par e-mail (et ne promet plus une confirmation préalable)", () => {
    expect(fr.hero.envoi).toBe("Envoyé tout de suite par e-mail, gratuitement.");
    expect(source).toContain("{t.hero.envoi}");
    expect(source).not.toContain("Téléchargement dès la confirmation de votre adresse e-mail.");
  });

  it(`annonce ${GUIDE_IA_PAGES} pages, comme le PDF`, () => {
    expect(fr.hero.titre).toBe(`Guide IA entreprise · ${GUIDE_IA_PAGES} pages`);
    expect(source).toContain("{t.hero.titre}");
    // Le JSON-LD lit la constante recomptée dans le PDF, jamais un nombre recopié.
    expect(source).toContain("numberOfPages: GUIDE_IA_PAGES");
  });

  it("ne propose jamais de « réserver » une formation", () => {
    expect(source).not.toMatch(/R[ée]servez notre formation/i);
  });
});

describe("la page de confirmation porte le téléchargement", () => {
  it("🔴 lie le PDF par le chemin de la source unique, en téléchargement", () => {
    const source = readFileSync(PAGE_CONFIRMATION, "utf8");
    expect(source).toContain("GUIDE_IA_CHEMIN");
    expect(source).toMatch(/href=\{`\/\$\{GUIDE_IA_CHEMIN\}`\}\s+download/);
  });
});

describe("l'e-mail de double opt-in annonce le guide", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : la phrase est là, et AUCUN lien n'est ajouté (famille A, budget 2)`, async () => {
      const r = await renderEmailTemplate("newsletter-confirm-optin", locale, {
        confirmToken: "c".repeat(64),
        unsubscribeToken: "u".repeat(64),
      });
      expect(r.text).toContain(locale === "fr" ? "guide IA entreprise" : "enterprise AI guide");
      expect(r.text).toContain(`${GUIDE_IA_PAGES} pages`);
      expect(r.html).not.toContain(GUIDE_IA_CHEMIN);
    });
  }
});

describe("🔴 L2 — l'e-mail « Votre guide » porte le lien personnel", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`${locale} : lien /api/guide-ia/telecharger, jamais le PDF direct`, async () => {
      const r = await renderEmailTemplate("guide-ia-envoi", locale, {
        downloadToken: "d".repeat(64),
      });
      expect(r.html).toContain(`/api/guide-ia/telecharger?t=${"d".repeat(64)}`);
      expect(r.html).not.toContain(GUIDE_IA_CHEMIN);
      expect(r.text).toContain(`${GUIDE_IA_PAGES} pages`);
    });
  }
});
