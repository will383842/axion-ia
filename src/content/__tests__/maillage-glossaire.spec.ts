/**
 * Garde V2-12 : chaque lien de maillage offres ↔ glossaire pointe vers une route qui existe.
 *
 * - offre → glossaire : 3 à 4 termes par page, tous existants et indexables ;
 * - glossaire → offre : chaque offre de `GLOSSARY_OFFERS` vise une page qui existe ;
 * - les familles de pages (formations, implémentation, sites web, audit) sont couvertes
 *   en entier, et chaque page d'offre branche bien le bloc ;
 * - aucune URL `/en` ; rendu serveur (aucun `"use client"`).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import {
  ALL_GLOSSARY_TERMS_EXTENDED,
  GLOSSARY_OFFERS,
  getGlossaryTermBySlug,
  isGlossaryTermIndexable,
} from "@/content/glossary-extension";
import { MAILLAGE_OFFRES, termesPourOffre, termesPourTexte } from "@/content/maillage-glossaire";
import { TermesGlossaireLies } from "@/components/marketing/TermesGlossaireLies";

const RACINE = join(process.cwd(), "src/app/[locale]");

describe("maillage offres → glossaire (V2-12)", () => {
  it("chaque entrée cible 3 ou 4 termes existants et indexables, sans doublon", () => {
    for (const [famille, entrees] of Object.entries(MAILLAGE_OFFRES)) {
      for (const [slug, termes] of Object.entries(entrees)) {
        const nom = `${famille}/${slug}`;
        expect(new Set(termes).size, nom).toBe(termes.length);
        expect(termes.length, nom).toBeGreaterThanOrEqual(3);
        expect(termes.length, nom).toBeLessThanOrEqual(4);
        for (const t of termes) {
          expect(getGlossaryTermBySlug(t), `${nom} → ${t} inconnu`).not.toBeNull();
          expect(isGlossaryTermIndexable(t), `${nom} → ${t} en noindex`).toBe(true);
        }
      }
    }
  });

  it("toutes les formations du catalogue reçoivent 2 à 4 termes", () => {
    for (const f of FORMATIONS_V2) {
      const n = termesPourOffre("formation", f.slugFr).length;
      expect(n, f.slugFr).toBeGreaterThanOrEqual(2);
      expect(n, f.slugFr).toBeLessThanOrEqual(4);
    }
    for (const slug of Object.keys(MAILLAGE_OFFRES.formation)) {
      expect(
        FORMATIONS_V2.some((f) => f.slugFr === slug),
        `formation fantôme : ${slug}`,
      ).toBe(true);
    }
  });

  it("chaque clé implémentation, sites web et audit correspond à une page qui existe", () => {
    const dossiers: Array<[string, string]> = [
      ["implementation", "implementation"],
      ["sites-web", "sites-web-augmentes"],
      ["audit", "audit"],
    ];
    for (const [famille, dir] of dossiers) {
      for (const slug of Object.keys(MAILLAGE_OFFRES[famille as keyof typeof MAILLAGE_OFFRES])) {
        expect(existsSync(join(RACINE, dir, slug, "page.tsx")), `${dir}/${slug}`).toBe(true);
      }
    }
  });

  it("chaque page d'offre listée branche le bloc de termes", () => {
    const pages = [
      ...Object.keys(MAILLAGE_OFFRES.implementation).map((s) => `implementation/${s}`),
      ...Object.keys(MAILLAGE_OFFRES["sites-web"]).map((s) => `sites-web-augmentes/${s}`),
      ...Object.keys(MAILLAGE_OFFRES.audit).map((s) => `audit/${s}`),
      "formations/[slug]",
    ];
    for (const p of pages) {
      const src = readFileSync(join(RACINE, p, "page.tsx"), "utf8");
      expect(src, p).toContain("<TermesGlossaireLies");
    }
    expect(readFileSync(join(RACINE, "guides/[slug]/page.tsx"), "utf8")).toContain(
      "termesPourTexte(",
    );
  });

  it("glossaire → offre : chaque terme vise une offre dont la page existe", () => {
    for (const o of Object.values(GLOSSARY_OFFERS)) {
      expect(o.href.startsWith("/en"), o.href).toBe(false);
      expect(existsSync(join(RACINE, o.href, "page.tsx")), o.href).toBe(true);
    }
    for (const t of ALL_GLOSSARY_TERMS_EXTENDED) {
      expect(GLOSSARY_OFFERS[t.offre], t.slug).toBeDefined();
    }
  });

  it("guides : les termes viennent du texte, avec un repli sûr", () => {
    const termes = termesPourTexte(
      "Un RAG sur vos documents limite les hallucinations du chatbot.",
    );
    const slugs = termes.map((t) => t.slug);
    expect(slugs).toContain("rag");
    expect(slugs).toContain("hallucination");
    expect(termes.length).toBeGreaterThanOrEqual(3);
    expect(termes.length).toBeLessThanOrEqual(4);
    expect(termesPourTexte("").length).toBeGreaterThanOrEqual(3);
  });

  it("le bloc ne rend rien hors FR et ne produit aucune URL /en", () => {
    const termes = termesPourOffre("implementation", "agents");
    expect(TermesGlossaireLies({ locale: "en", termes })).toBeNull();
    const rendu = JSON.stringify(TermesGlossaireLies({ locale: "fr", termes }));
    expect(rendu).not.toContain('"/en');
    expect(rendu).toContain("/fr/glossaire/agent");
  });

  it("le composant et le contenu sont rendus côté serveur (aucun JavaScript client)", () => {
    for (const f of [
      "src/components/marketing/TermesGlossaireLies.tsx",
      "src/content/maillage-glossaire.ts",
    ]) {
      expect(readFileSync(join(process.cwd(), f), "utf8")).not.toMatch(/["']use client["']/);
    }
  });
});
