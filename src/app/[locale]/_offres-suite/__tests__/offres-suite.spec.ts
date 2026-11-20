/**
 * GEO V2-05 / V2-06 : les quatre pages d'offre de la suite. Rougit si un montant autre que
 * 1 490 apparaît, si un mot interdit apparaît, si la définition diffère de celle de llms.txt,
 * ou si un nœud Review / AggregateRating est émis.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { offresLlms } from "@/app/_llms/reference";
import { OFFRES_SUITE, PHRASE_SUR_DEVIS } from "@/content/offres-suite";
import { routing } from "@/i18n/routing";

import { TOUTES_LES_PAGES, TEXTES } from "../contenu";
import { jsonLdOffreSuite } from "../jsonld";

const RACINE = process.cwd();
const MOTS_INTERDITS =
  /Qualiopi|OPCO|\bCPF\b|France Travail|financ|prise en charge|Grenoble|Aucun gain garanti|appel de cadrage|certifi/i;
const MONTANT = /\d[\d  .,]*\s?(€|euros?|EUR|k€)/gi;

const sources = OFFRES_SUITE.map((o) => ({
  o,
  page: readFileSync(path.join(RACINE, `src/app/[locale]${o.path}/page.tsx`), "utf8"),
}));
const gabarit = readFileSync(
  path.join(RACINE, "src/app/[locale]/_offres-suite/PageOffreSuite.tsx"),
  "utf8",
);

describe("pages des offres de la suite", () => {
  it("sont quatre, déclarées dans routing (donc dans le sitemap)", () => {
    expect(OFFRES_SUITE).toHaveLength(4);
    const sitemap = readFileSync(path.join(RACINE, "src/app/sitemap.ts"), "utf8");
    for (const o of OFFRES_SUITE) {
      expect(Object.keys(routing.pathnames)).toContain(o.path);
      expect(sitemap).not.toContain(`"${o.path}"`);
    }
  });

  it("n'affichent aucun montant autre que 1 490 et aucun « à partir de »", () => {
    for (const p of TOUTES_LES_PAGES) {
      const texte = JSON.stringify({ p, TEXTES });
      const montants = (texte.match(MONTANT) ?? []).filter((m) => !/^1[  .]?490\s?€/.test(m));
      expect(montants, p.cle).toEqual([]);
      expect(texte, p.cle).not.toMatch(/à partir de|dès \d/i);
      expect(texte, p.cle).not.toMatch(/\bHT\b|\bTTC\b/);
    }
    expect(gabarit).not.toMatch(/\d[  ]?€/);
  });

  it("ne contiennent aucun mot interdit, témoignage ni chiffre de résultat", () => {
    for (const p of TOUTES_LES_PAGES) {
      const texte = JSON.stringify({ p, TEXTES });
      expect(texte, p.cle).not.toMatch(MOTS_INTERDITS);
      expect(texte, p.cle).not.toMatch(/témoign|\d\s?%|garanti/i);
    }
  });

  it("ouvrent sur la définition, identique à celle de llms.txt", () => {
    const llms = offresLlms("https://axion-ia.com");
    for (const p of TOUTES_LES_PAGES) {
      expect(p.definition.endsWith(".")).toBe(true);
      expect(p.definition.split(". ")).toHaveLength(1);
      expect(llms.find((x) => x.nom === p.nom)?.definition, p.cle).toBe(p.definition);
      expect(p.faq[0]?.reponse).toBeTruthy();
    }
    expect(gabarit.indexOf("{p.definition}")).toBeLessThan(gabarit.indexOf("h-pour-qui"));
  });

  it("portent 4 questions, dont l'obtention du devis « sur devis après Diagnostic IA »", () => {
    for (const p of TOUTES_LES_PAGES) {
      expect(p.faq).toHaveLength(4);
      expect(p.faq[p.faq.length - 1]?.reponse).toContain(PHRASE_SUR_DEVIS);
    }
    expect(PHRASE_SUR_DEVIS).toContain("Diagnostic IA gratuit de 45 minutes");
  });

  it("émettent Service + WebPage + FAQPage valides, sans Review ni AggregateRating ni prix", () => {
    for (const p of TOUTES_LES_PAGES) {
      const [service, webPage, faq] = jsonLdOffreSuite(p);
      expect(service["@type"]).toBe("Service");
      expect(webPage["@type"]).toBe("WebPage");
      expect(faq["@type"]).toBe("FAQPage");
      const questions = (faq as { mainEntity: { name: string }[] }).mainEntity.map((q) => q.name);
      expect(questions).toEqual(p.faq.map((f) => f.question));
      const json = JSON.stringify([service, webPage, faq]);
      expect(json).not.toMatch(/"(Review|AggregateRating)"|"offers"|"price"/);
      expect(json).not.toMatch(MOTS_INTERDITS);
    }
  });

  it("sont des Server Components avec bouton « Réserver un Diagnostic IA » et liens internes", () => {
    expect(TEXTES.cta).toBe("Réserver un Diagnostic IA");
    expect(gabarit).not.toContain("use client");
    expect(gabarit).toContain('href="/journee-ia"');
    expect(gabarit).toContain("lienDiagnostic(");
    expect(gabarit.match(/<JsonLd /g)).toHaveLength(3);
    for (const { page } of sources) expect(page).not.toContain("use client");
  });
});
