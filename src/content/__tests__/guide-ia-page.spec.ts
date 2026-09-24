/**
 * Verrou — la page `/guide-ia` refondue (lot L1, 2026-09-25).
 *
 * Ce qui est figé ici, et pourquoi :
 *   · les ordres de marque sur TOUT texte de la page (aucun téléphone, jamais
 *     Zoom, jamais « mensuel », appel = 45 minutes, téléphone ou visio, gratuit
 *     et sans engagement) et le jargon interne retiré (« Lead magnet », « pSEO »,
 *     « quick-wins ») ;
 *   · la page MONTRE le guide : couverture et aperçus existent sur le disque,
 *     et ce sont eux que le manifeste d'images déclare (plus aucune photo
 *     Unsplash) ;
 *   · le sommaire et les 13 outils collent au PDF (pages dans 1..40, ordre) ;
 *   · deux formulaires, deux provenances distinctes, toutes deux « guide » ;
 *   · la sortie de page suit le guide (p. 40) : `/diagnostic` puis `/appel` ;
 *   · un seul nom pour le guide dans la navigation et `llms.txt`.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GUIDE_IA_PAGES } from "@/content/guide-ia";
import { COUVERTURE_GUIDE, NOM_GUIDE, textesPageGuide } from "@/content/guide-ia-page";
import { SOURCES_GUIDE, varianteDeSource } from "@/content/guide-ia-formulaire";
import { PAGE_IMAGES_MANIFEST } from "@/lib/seo/page-images";

const RACINE = process.cwd();
const lire = (relatif: string) => readFileSync(path.join(RACINE, relatif), "utf8");
const PAGE = lire("src/app/[locale]/guide-ia/page.tsx");
const sansCommentaires = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");

describe("ordres de marque, sur tous les textes de la page", () => {
  for (const locale of ["fr", "en"] as const) {
    const tout = JSON.stringify(textesPageGuide(locale));

    it(`${locale} : aucun numéro de téléphone, jamais Zoom, jamais « mensuel »`, () => {
      expect(tout).not.toMatch(/\b0[1-9](?:[ .]?\d{2}){4}\b|\+33/);
      expect(tout).not.toMatch(/zoom/i);
      expect(tout).not.toMatch(/mensuel|monthly/i);
    });

    it(`${locale} : le jargon interne a disparu`, () => {
      expect(tout).not.toMatch(/lead magnet|pseo|quick-?win|\bMAJ\b/i);
    });

    it(`${locale} : jamais « nous démarrons » ni « nouveau venu »`, () => {
      expect(tout).not.toMatch(/d[ée]marr|lancement d'Axion|just launched|newcomer/i);
    });
  }

  it("fr : l'appel est de 45 minutes, par téléphone ou en visio, gratuit et sans engagement", () => {
    const { appel } = textesPageGuide("fr").suite;
    expect(appel.texte).toContain("45 minutes");
    expect(appel.texte).toContain("par téléphone ou en visio");
    expect(appel.texte).toContain("gratuit et sans engagement");
  });

  it("la page n'écrit aucun texte public en dur hors des deux sources", () => {
    // Heuristique : aucune chaîne française longue dans le JSX de la page.
    expect(sansCommentaires(PAGE)).not.toMatch(/>\s*[A-ZÀ-Ý][a-zà-ÿ]+ [a-zà-ÿ]+ [a-zà-ÿ]+[^<{]*</);
  });
});

describe("la page montre le guide, et seulement lui", () => {
  const t = textesPageGuide("fr");

  it("🔴 couverture et aperçus existent sur le disque (AVIF)", () => {
    for (const src of [COUVERTURE_GUIDE.src, ...t.apercu.pages.map((p) => p.src)]) {
      expect(src.endsWith(".avif"), src).toBe(true);
      expect(existsSync(path.join(RACINE, "public", src)), `${src} absent de public/`).toBe(true);
    }
  });

  it("🔴 le manifeste d'images déclare exactement la couverture et les aperçus (plus d'Unsplash)", () => {
    const page = PAGE_IMAGES_MANIFEST.find((p) => p.path === "/guide-ia");
    expect(page).toBeDefined();
    const declarees = page!.images.map((i) => i.src);
    expect(declarees).toEqual([COUVERTURE_GUIDE.src, ...t.apercu.pages.map((p) => p.src)]);
    expect(page!.images.every((i) => (i.origin ?? "own") === "own")).toBe(true);
    expect(page!.images.filter((i) => i.representativeOfPage)).toHaveLength(1);
    const code = sansCommentaires(PAGE);
    expect(code).not.toMatch(/unsplash|EditorialPhotoCredit|<Illustration/i);
  });

  it("🔴 alt déclaré = alt rendu (la page lit les mêmes textes)", () => {
    const page = PAGE_IMAGES_MANIFEST.find((p) => p.path === "/guide-ia")!;
    expect(page.images[0]!.altFr).toBe(t.hero.altCouverture);
    expect(PAGE).toContain("alt={t.hero.altCouverture}");
    expect(PAGE).toContain("alt={p.alt}");
  });

  it("seule la couverture est préchargée (élément LCP du premier écran)", () => {
    expect(PAGE.match(/\bpreload\b(?!=\{false\})/g) ?? []).toHaveLength(1);
    expect(PAGE).not.toMatch(/\bpriority\b/);
  });
});

describe("le contenu colle au PDF", () => {
  const t = textesPageGuide("fr");

  it("13 outils à recopier, chacun avec une page du guide", () => {
    expect(t.outils.liste).toHaveLength(13);
    expect(t.outils.titre).toBe("13 outils à recopier");
    for (const [, page] of t.outils.liste) {
      expect(page).toBeGreaterThanOrEqual(1);
      expect(page).toBeLessThanOrEqual(GUIDE_IA_PAGES);
    }
  });

  it("le sommaire est ordonné, sans trou ni chevauchement, et finit à la dernière page", () => {
    const ch = t.sommaire.chapitres;
    expect(ch[0]!.page).toBe(6);
    for (let i = 1; i < ch.length; i++) {
      expect(ch[i]!.page, ch[i]!.titre).toBe(ch[i - 1]!.fin + 1);
    }
    expect(ch.at(-1)!.fin).toBe(GUIDE_IA_PAGES);
    for (const c of ch) {
      for (const [, page] of c.parties) {
        expect(page).toBeGreaterThanOrEqual(c.page);
        expect(page).toBeLessThanOrEqual(c.fin);
      }
    }
  });

  it("les aperçus sont des pages réelles du guide", () => {
    for (const p of t.apercu.pages) {
      expect(p.src).toContain(`page-${String(p.page).padStart(2, "0")}`);
    }
  });

  it("les chapitres EN ont les mêmes pages que les FR", () => {
    const en = textesPageGuide("en").sommaire.chapitres;
    expect(en.map((c) => [c.page, c.fin])).toEqual(
      t.sommaire.chapitres.map((c) => [c.page, c.fin]),
    );
  });
});

describe("deux formulaires, deux provenances", () => {
  it("🔴 le haut pose « guide-ia », le bas « guide-ia-bas », et tous deux sont la variante « guide »", () => {
    expect(PAGE).toContain('<NewsletterForm source="guide-ia" ');
    expect(PAGE).toContain('<NewsletterForm source="guide-ia-bas" ');
    expect(SOURCES_GUIDE).toContain("guide-ia-bas");
    expect(varianteDeSource("guide-ia")).toBe("guide");
    expect(varianteDeSource("guide-ia-bas")).toBe("guide");
    expect(varianteDeSource("blog-fin-article")).toBe("article");
  });

  it("le premier formulaire porte l'ancre visée par la barre collante", () => {
    expect(PAGE).toContain('const ANCRE_FORMULAIRE = "recevoir";');
    expect(PAGE).toContain("id={ANCRE_FORMULAIRE}");
    expect(PAGE).toContain("cible={ANCRE_FORMULAIRE}");
  });
});

describe("sortie de page : celle du guide (p. 40)", () => {
  it("🔴 /diagnostic puis /appel ; plus de renvoi « formations » en fin de page", () => {
    const iDiag = PAGE.indexOf('href: "/diagnostic"');
    const iAppel = PAGE.indexOf('href: "/appel"');
    expect(iDiag).toBeGreaterThan(-1);
    expect(iAppel).toBeGreaterThan(iDiag);
    expect(PAGE).not.toContain('href="/formations"');
  });

  it("la FAQ est balisée FAQPage avec les questions affichées", () => {
    expect(PAGE).toContain("buildFaqJsonLd({");
    expect(PAGE).toContain("items: t.faq.items");
    expect(textesPageGuide("fr").faq.items.length).toBeGreaterThanOrEqual(5);
  });
});

describe("un seul nom pour le guide", () => {
  it("menu, pied de page et llms.txt disent « Guide IA entreprise »", () => {
    expect(NOM_GUIDE.fr).toBe("Guide IA entreprise");
    expect(lire("src/components/nav/Footer.tsx")).toContain('"Guide IA entreprise"');
    expect(lire("src/components/nav/HeaderResourcesMenu.tsx")).toContain(
      'labelFr: "Guide IA entreprise"',
    );
    expect(lire("src/app/llms.txt/route.ts")).toContain("[Guide IA entreprise 2026]");
    for (const f of [
      "src/components/nav/Footer.tsx",
      "src/components/nav/HeaderResourcesMenu.tsx",
    ]) {
      expect(lire(f)).not.toMatch(/Guide IA opérationnelle|Guide de l'IA/);
    }
  });
});
