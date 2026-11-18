/**
 * Fiches locales des villes (lot 1) : garde-fous du PLAN-VILLES §3.1.
 *
 *   - chaque source appartient à une liste blanche de domaines officiels ;
 *   - date de consultation au 2026-11-01 ou après ;
 *   - catégories d'institutions fermées (aucune entreprise privée) ;
 *   - aucun chiffre orphelin dans la prose et la FAQ ;
 *   - aucun mot interdit ; 3 questions locales de 40 à 80 mots ;
 *   - ressemblance entre deux fiches : moins de 30 % de suites de 6 mots communes.
 */

import { describe, expect, it } from "vitest";

import { FICHES_LOCALES } from "@/content/villes/fiches-locales";
import type { FicheLocale } from "@/content/villes/fiches-locales/types";
import { VILLES_CORE } from "@/content/villes/core";

const FICHES = Object.values(FICHES_LOCALES);

/** Domaines autorisés (sources officielles : Urssaf, geo.api.gouv.fr, institutions publiques). */
const HOTES_AUTORISES = new Set([
  "open.urssaf.fr",
  "geo.api.gouv.fr",
  "www.univ-amu.fr",
  "polemermediterranee.com",
  "www.aktantis.com",
  "www.marseille.aeroport.fr",
  "www.univ-lyon1.fr",
  "www.univ-lyon2.fr",
  "www.axelera.org",
  "www.lyonaeroports.com",
  "www.univ-toulouse.fr",
  "www.aerospace-valley.com",
  "www.toulouse.aeroport.fr",
  "univ-cotedazur.fr",
  "www.nice.aeroport.fr",
  "www.univ-nantes.fr",
  "www.pole-emc2.fr",
  "www.atlanpole.fr",
  "www.umontpellier.fr",
  "www.montpellier.aeroport.fr",
  "www.unistra.fr",
  "www.strasbourg.aeroport.fr",
  "www.u-bordeaux.fr",
  "www.alpha-rlh.com",
  "www.bordeaux.aeroport.fr",
  "www.univ-lille.fr",
  "www.euratechnologies.com",
  "www.lille.aeroport.fr",
  "www.pole-valorial.fr",
  "www.rennes.aeroport.fr",
]);

const CATEGORIES = new Set([
  "pole",
  "technopole",
  "zone",
  "universite",
  "ecole",
  "french-tech",
  "gare",
  "aeroport",
  "cci",
]);

const MOTS_INTERDITS: ReadonlyArray<RegExp> = [
  /grenoble/i,
  /qualiopi/i,
  /\bOPCO\b/i,
  /financement/i,
  /prise en charge/i,
  /aucun gain garanti/i,
  /faites-le vous-m/i,
  /certifi/i,
  /t[ée]moignage/i,
  /nous avons accompagn/i,
  /nous sommes pr[ée]sents/i,
  /willi/i,
];

/** Jetons communs permis dans la prose sans figurer dans un champ chiffré. */
const NOMBRES_COMMUNS = new Set(["2", "3", "4", "15", "45", "2025", "31"]);

const nbMots = (t: string) => t.trim().split(/\s+/).length;

function textesEcrits(f: FicheLocale): string[] {
  return [
    f.prose.tissu,
    f.prose.ecosysteme,
    f.prose.zone,
    ...f.faqLocale.flatMap((q) => [q.q, q.a]),
  ];
}

describe("fiches locales : sources et dates", () => {
  it("couvre dix villes qui existent dans le catalogue", () => {
    expect(FICHES).toHaveLength(10);
    const slugs = new Set(VILLES_CORE.map((v) => v.slug));
    for (const f of FICHES) expect(slugs.has(f.slug), f.slug).toBe(true);
  });

  it("chaque URL de source est sur un domaine de la liste blanche", () => {
    for (const f of FICHES) {
      const urls = [
        f.population.url,
        f.epci.url,
        f.entreprises.urlTotal,
        f.entreprises.urlSecteurs,
        ...f.institutions.map((i) => i.url),
      ];
      for (const u of urls) {
        expect(HOTES_AUTORISES.has(new URL(u).hostname), `${f.slug} : ${u}`).toBe(true);
      }
    }
  });

  it("chaque consulteLe est au 2026-11-01 ou après", () => {
    for (const f of FICHES) {
      const dates = [
        f.dateFiche,
        f.population.consulteLe,
        f.epci.consulteLe,
        f.entreprises.consulteLe,
        ...f.institutions.map((i) => i.consulteLe),
      ];
      for (const d of dates) expect(d >= "2026-11-01", `${f.slug} : ${d}`).toBe(true);
    }
  });

  it("les catégories d'institutions sont fermées (aucune entreprise privée)", () => {
    for (const f of FICHES) {
      for (const i of f.institutions) expect(CATEGORIES.has(i.categorie), i.nom).toBe(true);
    }
  });

  it("le nombre de communes annoncé est celui de la liste", () => {
    for (const f of FICHES) {
      expect(f.epci.communes).toHaveLength(f.epci.nombreCommunes);
      expect(f.epci.communes).toContain(f.nomVille);
    }
  });
});

describe("fiches locales : texte", () => {
  it("aucun mot interdit", () => {
    for (const f of FICHES) {
      for (const t of textesEcrits(f)) {
        for (const m of MOTS_INTERDITS)
          expect(m.test(t), `${f.slug} : ${m} dans « ${t.slice(0, 50)} »`).toBe(false);
      }
    }
  });

  it("aucun chiffre orphelin : tout nombre écrit figure dans un champ chiffré", () => {
    for (const f of FICHES) {
      const champs = JSON.stringify({ ...f, prose: null, faqLocale: null });
      for (const t of textesEcrits(f)) {
        const nombres = t.replace(/[  ]/g, "").match(/\d+/g) ?? [];
        for (const n of nombres) {
          expect(NOMBRES_COMMUNS.has(n) || champs.includes(n), `${f.slug} : ${n}`).toBe(true);
        }
      }
    }
  });

  it("3 questions locales, réponses de 40 à 80 mots", () => {
    for (const f of FICHES) {
      expect(f.faqLocale).toHaveLength(3);
      for (const q of f.faqLocale) {
        const n = nbMots(q.a);
        expect(n >= 40 && n <= 80, `${f.slug} : ${n} mots`).toBe(true);
      }
    }
  });

  it("chaque bloc de prose fait 45 à 140 mots", () => {
    for (const f of FICHES) {
      for (const t of [f.prose.tissu, f.prose.ecosysteme, f.prose.zone]) {
        const n = nbMots(t);
        expect(n >= 45 && n <= 140, `${f.slug} : ${n} mots`).toBe(true);
      }
    }
  });
});

function suites(f: FicheLocale): Set<string> {
  let t = textesEcrits(f).join(" ").toLowerCase();
  for (const g of FICHES) {
    for (const nom of [g.nomVille, g.epci.nom]) t = t.split(nom.toLowerCase()).join("x");
  }
  t = t.replace(/[  ]/g, " ").replace(/\d+/g, "n");
  const mots = t.split(/[^\p{L}'’]+/u).filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + 6 <= mots.length; i++) s.add(mots.slice(i, i + 6).join(" "));
  return s;
}

describe("fiches locales : unicité", () => {
  it("moins de 30 % de suites de 6 mots communes entre deux fiches (noms et nombres masqués)", () => {
    const S = new Map(FICHES.map((f) => [f.slug, suites(f)] as const));
    let max = 0;
    for (const [a, sa] of S) {
      for (const [b, sb] of S) {
        if (a === b) continue;
        let communs = 0;
        for (const g of sa) if (sb.has(g)) communs++;
        const part = communs / sa.size;
        max = Math.max(max, part);
        expect(part, `${a} / ${b}`).toBeLessThan(0.3);
      }
    }
    expect(max).toBeLessThan(0.3);
  });
});
