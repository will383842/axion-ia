/**
 * La Journée IA, ville par ville (audit SEO/GEO du 2026-11-11).
 *
 * Verrouille, sur TOUTES les villes et TOUTES les régions :
 *   - title ≤ 60 caractères TEL QUE SERVI (marque comprise), description ≤ 155 ;
 *   - unicité des titles et des descriptions ;
 *   - aucun code INSEE, aucun prix en dur (le prix vient de `JOURNEE_IA_TIER`) ;
 *   - la garantie reprise mot pour mot ;
 *   - aucun mot interdit dans les textes visibles ;
 *   - des emplacements `depuis=` que la page `/appel` accepte.
 */

import { describe, expect, it } from "vitest";

import { VILLES_CORE } from "@/content/villes/core";
import { REGIONS } from "@/content/regions";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { CONDITION_GARANTIE, GARANTIE_PHRASE, RAPPORT_COMPLET } from "@/content/journee-ia-commun";
import { lireDepuis } from "@/server/calendly/choix-rendez-vous";
import {
  DESCRIPTION_MAX,
  NOMS_HOMONYMES,
  TITRE_HUB,
  TITRE_MAX,
  aVille,
  depuisRegion,
  depuisVille,
  descriptionHub,
  descriptionRegion,
  descriptionVille,
  enBrefVille,
  enRegion,
  faqRegion,
  faqVille,
  h1Region,
  h1Ville,
  paragrapheRegion,
  secteursLisibles,
  titreRegion,
  titreVille,
  wikidataVilleUrl,
} from "@/content/villes/journee-ia-locale";

const PRIX = formatTierPrice(JOURNEE_IA_TIER, "fr");

/** Mots interdits dans tout texte public de ces pages (règles de fer du chantier). */
const MOTS_INTERDITS: ReadonlyArray<RegExp> = [
  /conform/i,
  /certifi/i,
  /qualiopi/i,
  /\bCPF\b/,
  /\bOPCO\b/i,
  /financement/i,
  /\bamende/i,
  /\boffert/i,
  /\bETI\b/,
  /TPE\s?\/\s?PME|PME\s?\/\s?TPE/,
  /\bSaaS\b/i,
  /no-?code/i,
  /grenoble/i,
  /adresse postale/i,
  /architectes? (IA )?seniors?/i,
  /freelance/i,
  /grands? (groupes?|comptes?)/i,
];

function sansMotInterdit(texte: string): string[] {
  return MOTS_INTERDITS.filter((m) => m.test(texte)).map(String);
}

const REGION_PAR_SLUG = new Map(REGIONS.map((r) => [r.slug, r] as const));

describe("titles et descriptions des villes", () => {
  const titres = VILLES_CORE.map((v) => titreVille(v));
  const descriptions = VILLES_CORE.map((v) => descriptionVille(v));

  it("title ≤ 60 caractères (tel que servi, marque comprise)", () => {
    const tropLongs = VILLES_CORE.filter((v, i) => titres[i]!.length > TITRE_MAX).map(
      (v) => v.slug,
    );
    expect(tropLongs).toEqual([]);
  });

  it("description ≤ 155 caractères", () => {
    const tropLongues = VILLES_CORE.filter((v, i) => descriptions[i]!.length > DESCRIPTION_MAX).map(
      (v) => v.slug,
    );
    expect(tropLongues).toEqual([]);
  });

  it("titles uniques sur l'ensemble des villes (homonymes départagés)", () => {
    expect(new Set(titres).size).toBe(titres.length);
    expect(NOMS_HOMONYMES.size).toBeGreaterThan(0);
  });

  it("descriptions uniques sur l'ensemble des villes", () => {
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("le prix vient du palier Journée IA ; ni code INSEE ni jeton résiduel", () => {
    for (const [i, v] of VILLES_CORE.entries()) {
      const d = descriptions[i]!;
      expect(d, v.slug).toContain(PRIX);
      expect(d, v.slug).not.toContain(v.inseeCode);
      expect(titres[i], v.slug).not.toContain(v.inseeCode);
      expect(d, v.slug).not.toMatch(/\{\{/);
    }
  });

  it("Brest : title, description et h1 attendus", () => {
    const brest = VILLES_CORE.find((v) => v.slug === "brest")!;
    expect(titreVille(brest)).toBe("Journée IA à Brest : audit et formation IA · Axion-IA");
    expect(descriptionVille(brest)).toMatch(/^La Journée IA à Brest \(Finistère\) : audit dans vos locaux/);
    expect(h1Ville(brest)).toBe("La Journée IA à Brest : audit et formation IA dans vos locaux");
  });

  it("Sarcelles (ancien title de 95 caractères) tient sous 60", () => {
    const sarcelles = VILLES_CORE.find((v) => v.slug === "sarcelles")!;
    expect(titreVille(sarcelles).length).toBeLessThanOrEqual(TITRE_MAX);
  });
});

describe("textes visibles d'une ville", () => {
  it("En bref : contexte local factuel, garantie mot pour mot, aucun code INSEE", () => {
    const brest = VILLES_CORE.find((v) => v.slug === "brest")!;
    const region = REGION_PAR_SLUG.get(brest.region)!;
    const paragraphes = enBrefVille(brest, region, ["sciences de la mer"]);
    const tout = paragraphes.join(" ");
    expect(tout).toContain("Finistère (29)");
    expect(tout).toContain("Bretagne");
    expect(tout).toContain("sciences de la mer");
    expect(tout).toContain(RAPPORT_COMPLET);
    expect(tout).toContain(GARANTIE_PHRASE);
    expect(tout).toContain(CONDITION_GARANTIE);
    expect(tout).toContain(PRIX);
    expect(tout).toContain("Nous n’avons pas de bureau à Brest");
    expect(tout).not.toContain(brest.inseeCode);
  });

  it("aucun mot interdit dans les textes générés, pour toutes les villes", () => {
    const fautes: string[] = [];
    for (const v of VILLES_CORE) {
      const region = REGION_PAR_SLUG.get(v.region)!;
      const textes = [
        titreVille(v),
        descriptionVille(v),
        h1Ville(v),
        ...enBrefVille(v, region, []),
        ...faqVille(v).flatMap((f) => [f.q, f.a]),
      ].join(" ");
      // Le nom de la commune est une donnée : on ne le juge pas (une ville peut s'appeler…).
      const sansNom = textes.replaceAll(v.nameFr, "");
      const motifs = sansMotInterdit(sansNom);
      if (motifs.length > 0) fautes.push(`${v.slug}: ${motifs.join(", ")}`);
    }
    expect(fautes).toEqual([]);
  });

  it("FAQ : quatre questions, prix et garantie identiques au texte visible", () => {
    const v = VILLES_CORE.find((x) => x.slug === "brest")!;
    const faq = faqVille(v);
    expect(faq).toHaveLength(4);
    const prix = faq.find((f) => f.q.startsWith("Combien"))!;
    expect(prix.a).toContain(PRIX);
    expect(prix.a).toContain(GARANTIE_PHRASE);
  });

  it("secteurs : sans parenthèse technique, trois au plus, sans doublon", () => {
    expect(
      secteursLisibles([
        "Commerce, transports, hébergement et restauration (sections G+H+I)",
        "Industrie",
        "industrie",
        "Construction",
        "Santé",
      ]),
    ).toEqual(["commerce, transports, hébergement et restauration", "industrie", "construction"]);
  });

  it("prépositions : au Havre, aux Mureaux, à Brest", () => {
    expect(aVille("Le Havre")).toBe("au Havre");
    expect(aVille("Les Mureaux")).toBe("aux Mureaux");
    expect(aVille("Brest")).toBe("à Brest");
  });

  it("emplacements depuis= acceptés par /appel", () => {
    for (const v of VILLES_CORE) {
      for (const e of ["haut", "bas", "faq"] as const) {
        expect(lireDepuis(depuisVille(v.slug, e)), v.slug).not.toBeNull();
      }
    }
    for (const r of REGIONS) {
      expect(lireDepuis(depuisRegion(r.slug, "haut"))).not.toBeNull();
    }
  });

  it("Wikidata : URL de résolution par l'article Wikipédia FR", () => {
    expect(wikidataVilleUrl("Saint-Malo")).toBe(
      "https://www.wikidata.org/wiki/Special:GoToLinkedPage?site=frwiki&page=Saint-Malo",
    );
  });
});

describe("régions et hub", () => {
  it("titles ≤ 60 et descriptions ≤ 155, uniques", () => {
    const titres = REGIONS.map(titreRegion);
    const descriptions = REGIONS.map(descriptionRegion);
    for (const t of titres) expect(t.length, t).toBeLessThanOrEqual(TITRE_MAX);
    for (const d of descriptions) expect(d.length, d).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(new Set(titres).size).toBe(REGIONS.length);
    expect(new Set(descriptions).size).toBe(REGIONS.length);
    expect(TITRE_HUB.length).toBeLessThanOrEqual(TITRE_MAX);
    expect(descriptionHub().length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(descriptionHub()).toContain(PRIX);
  });

  it("prépositions de région", () => {
    const r = (slug: string) => REGION_PAR_SLUG.get(slug)!;
    expect(enRegion(r("bretagne"))).toBe("en Bretagne");
    expect(enRegion(r("hauts-de-france"))).toBe("dans les Hauts-de-France");
    expect(enRegion(r("grand-est"))).toBe("dans le Grand Est");
    expect(enRegion(r("la-reunion"))).toBe("à La Réunion");
  });

  it("paragraphe « La Journée IA en {Région} » : faits, honnêteté, mots permis", () => {
    for (const r of REGIONS) {
      const p = paragrapheRegion(r, { communes: 120, departements: 4, principales: ["A", "B"] });
      expect(p).toContain(`Journée IA ${enRegion(r)}`);
      expect(p).toContain("Nous n’avons pas de bureau dans chaque ville");
      const textes = [titreRegion(r), descriptionRegion(r), h1Region(r), p]
        .concat(faqRegion(r).flatMap((f) => [f.question, f.answer]))
        .join(" ");
      expect(sansMotInterdit(textes), r.slug).toEqual([]);
    }
  });
});
