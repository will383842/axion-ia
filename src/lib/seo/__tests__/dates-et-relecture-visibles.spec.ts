// @vitest-environment node
/**
 * GEO V2-11 + V2-17 — garde.
 *
 * V2-11 : « Mis à jour le … » vient du contenu, à la même source que le `dateModified`
 * JSON-LD et le `<lastmod>` du sitemap ; jamais de la date du jour ; rien si la date manque.
 * V2-17 : aucune mention de relecture humaine sans donnée qui l'atteste (aucun champ de
 * relecture n'existe en base pour ces pages : on n'affiche donc rien).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MisAJourLe } from "@/components/marketing/MisAJourLe";
import { dateAfficheeDeChemin } from "@/lib/seo/date-affichee";
import { dateModifiedDeChemin } from "@/lib/seo/fraicheur";

const lire = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, "$1");

describe("V2-11 — la date affichée est la date du contenu", () => {
  it("la date affichée d'une route = le dateModified JSON-LD (même source)", () => {
    for (const chemin of ["/implementation", "/sites-web-augmentes", "/a-propos"]) {
      const jsonld = dateModifiedDeChemin(chemin, "fr");
      expect(jsonld, chemin).toBeDefined();
      expect(dateAfficheeDeChemin(chemin, "fr")).toBe(jsonld!.slice(0, 10));
    }
  });

  it("une route inconnue ne rend aucune date (rien d'inventé)", () => {
    expect(dateAfficheeDeChemin("/route-qui-n-existe-pas", "fr")).toBeUndefined();
    expect(renderToStaticMarkup(createElement(MisAJourLe, { locale: "fr", chemin: "/nope" }))).toBe(
      "",
    );
  });

  it("rend « Mis à jour le » + <time dateTime> pour une date du contenu", () => {
    const html = renderToStaticMarkup(
      createElement(MisAJourLe, { locale: "fr", date: "2026-11-11T07:55:08.000Z", contenu: false }),
    );
    expect(html).toContain("Mis à jour le");
    expect(html).toContain('<time dateTime="2026-11-11">11 novembre 2026</time>');
  });

  it("une date illisible ne rend rien", () => {
    expect(
      renderToStaticMarkup(createElement(MisAJourLe, { locale: "fr", date: "pas-une-date" })),
    ).toBe("");
  });

  it("jamais la date du jour : aucun `new Date()` sans argument, aucun Date.now()", () => {
    for (const f of ["src/components/marketing/MisAJourLe.tsx", "src/lib/seo/date-affichee.ts"]) {
      const src = sansCommentaires(lire(f));
      expect(src, f).not.toMatch(/new Date\(\s*\)/);
      expect(src, f).not.toMatch(/Date\.now\(/);
    }
  });

  it("le composant est un Server Component (aucun JS client)", () => {
    expect(lire("src/components/marketing/MisAJourLe.tsx")).not.toMatch(/["']use client["']/);
  });

  it.each([
    "src/components/services/sites-web/SitesWebLandingPage.tsx",
    "src/components/services/implementation/ImplementationSubPageExtras.tsx",
    "src/app/[locale]/implementation/page.tsx",
    "src/app/[locale]/sites-web-augmentes/page.tsx",
  ])("%s affiche « Mis à jour le »", (f) => {
    expect(lire(f)).toContain("<MisAJourLe");
  });
});

describe("V2-17 — aucune relecture humaine non attestée", () => {
  const HUBS = [
    "src/app/[locale]/blog/categorie/page.tsx",
    "src/app/[locale]/blog/categorie/[slug]/page.tsx",
    "src/app/[locale]/blog/_views/BlogListingView.tsx",
    "src/app/[locale]/actualites/page.tsx",
  ];

  it.each(HUBS)("%s ne déclare ni reviewedBy ni lastReviewed", (f) => {
    const src = sansCommentaires(lire(f));
    expect(src).not.toMatch(/reviewedBy/);
    expect(src).not.toMatch(/lastReviewed/);
  });

  it.each(HUBS.slice(0, 2))("%s n'affiche plus « supervisée par le fondateur »", (f) => {
    expect(lire(f)).not.toMatch(/supervisée par|overseen by/);
  });

  it("aucun nouveau texte ne nomme le fondateur dans une mention « Relu par »", () => {
    for (const f of [...HUBS, "src/components/marketing/MisAJourLe.tsx"]) {
      expect(lire(f)).not.toMatch(/Relu(e)? par/);
    }
  });

  it("les articles d'actualité et de blog disent « Mis à jour le », pas « Dernière révision »", () => {
    for (const f of [
      "src/app/[locale]/blog/[slug]/page.tsx",
      "src/app/[locale]/actualites/[slug]/page.tsx",
    ]) {
      const src = sansCommentaires(lire(f));
      expect(src, f).not.toMatch(/Dernière révision|Last reviewed/);
      expect(src, f).toContain("Mis à jour le");
    }
  });
});
