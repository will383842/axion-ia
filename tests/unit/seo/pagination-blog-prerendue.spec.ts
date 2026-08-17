// @vitest-environment node
//
// Environnement `node` : lecture de fichiers du dépôt.

/**
 * Verrou GEO-061 (famille « segment dynamique ») — les pages de pagination du
 * blog étaient servies sans aucun cache (audit GEO/AEO du 2026-08-14, lot 19).
 *
 * ## Ce qui a été mesuré en production le 2026-08-16
 *
 *   /fr/blog        → x-nextjs-prerender: 1 · x-nextjs-cache: HIT
 *                     Cache-Control: s-maxage=3600
 *   /fr/blog/page/2 → AUCUN de ces en-têtes
 *                     Cache-Control: private, no-store · cf-cache-status: BYPASS
 *
 * Le commentaire du fichier affirmait qu'en l'absence de `generateStaticParams`,
 * « `dynamicParams` rend chaque page à la première requête, l'ISR fait le
 * reste ». C'est faux : un segment dynamique absent du manifeste de pré-rendu
 * n'est pas servi en ISR, il est servi **entièrement dynamiquement**. Chaque
 * passage de crawler traverse l'origine, et Cloudflare ne met rien en cache.
 *
 * ## Le piège que cette garde protège vraiment
 *
 * Pré-rendre ces pages sans précaution est **pire** que le défaut : le build
 * tourne avec les URLs stub, la base rend 0 article, `totalPages` vaut 1, et
 * chaque page ≥ 2 partirait en `notFound()`. On figerait un **404 statique** là
 * où il y avait un 200 dynamique.
 *
 * Trois pièces sont donc indissociables, et cette garde vérifie les trois :
 * le pré-rendu, l'exception de build, et la chauffe post-déploiement qui
 * repeuple immédiatement les coquilles.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const lire = (r: string): string => readFileSync(join(RACINE, r), "utf8");

const PAGE = lire("src/app/[locale]/blog/page/[num]/page.tsx");
const VUE = lire("src/app/[locale]/blog/_views/BlogListingView.tsx");
const WORKFLOW = lire(".github/workflows/deploy-coolify.yml");

/** Extrait une affectation shell `NOM='[…]'` du workflow. */
function listeShell(nom: string): string[] {
  const m = new RegExp(`\\s${nom}='(\\[[^']*\\])'`).exec(WORKFLOW);
  if (!m?.[1]) throw new Error(`affectation ${nom} introuvable`);
  return JSON.parse(m[1]) as string[];
}

describe("GEO-061 — la pagination du blog entre dans le manifeste de pré-rendu", () => {
  it("🔴 `generateStaticParams` existe et rend un plancher de pages", () => {
    expect(PAGE).toContain("export function generateStaticParams");
    expect(PAGE).toMatch(/PAGES_PRERENDUES\s*=\s*\[2,\s*3,\s*4,\s*5\]/);
  });

  it("🔴 il ne lit PAS la base — le build tourne sous URLs stub", () => {
    // `generateStaticParams` doit rendre le meme resultat au build et en prod.
    // Une lecture DB rendrait une liste vide au build : zero page pre-rendue,
    // donc le defaut intact, sans que rien ne rougisse.
    const corps = PAGE.slice(PAGE.indexOf("export function generateStaticParams"));
    expect(corps).not.toMatch(/prisma|await\s+load|await\s+get/);
  });
});

describe("🔴 l'exception de build — sans elle on figerait des 404", () => {
  it("la vue ne 404 pas quand la base est stubée", () => {
    expect(VUE).toContain("stub.invalid");
    expect(
      VUE,
      "le `notFound()` hors bornes doit etre desarme au build, sinon les pages " +
        "pre-rendues deviennent des 404 STATIQUES — pire que le defaut corrige",
    ).toMatch(/currentPageRequested > totalPages && !auBuildStub/);
  });

  it("hors build, une page hors bornes reste un 404 franc", () => {
    // On ne relache pas la regle en production : une URL de chemin hors bornes
    // ne doit pas creer d'alias indexable.
    expect(VUE).toContain("notFound()");
  });
});

describe("🔴 la chauffe post-déploiement repeuple les coquilles", () => {
  const ATTENDUS = ["/fr/blog/page/2", "/fr/blog/page/3", "/fr/blog/page/4", "/fr/blog/page/5"];

  it("les pages pré-rendues sont revalidées après l'atterrissage", () => {
    const paths = listeShell("PATHS");
    for (const p of ATTENDUS) {
      expect(paths, `${p} absent de PATHS : la coquille vide resterait 1 h`).toContain(p);
    }
  });

  it("et purgées de l'edge — les deux listes décrivent le MÊME ensemble", () => {
    // 🔑 Revalider sans purger laisse Cloudflare servir la version vide pendant
    // `s-maxage` ; purger sans revalider fait re-cacher l'origine encore vide.
    const files = listeShell("FILES");
    for (const p of ATTENDUS) {
      expect(files).toContain(`https://axion-ia.com${p}`);
    }
  });

  it("le plancher pré-rendu et la liste de chauffe restent alignés", () => {
    // Si quelqu'un etend PAGES_PRERENDUES sans etendre la chauffe, les pages
    // ajoutees resteront vides une heure apres chaque deploiement.
    const m = /PAGES_PRERENDUES\s*=\s*\[([^\]]*)\]/.exec(PAGE);
    const pages = (m?.[1] ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const paths = listeShell("PATHS");
    for (const n of pages) {
      expect(paths, `page ${n} pre-rendue mais jamais chauffee`).toContain(`/fr/blog/page/${n}`);
    }
  });
});
