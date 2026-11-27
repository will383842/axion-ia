// S6-3 — porte de qualité des villes indexées : aucune ville n'entre dans l'index sans une fiche
// locale sourcée, complète et distincte des autres. Test seul, sans effet sur le site.
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { FICHES_LOCALES } from "@/content/villes/fiches-locales";
import type { FicheLocale } from "@/content/villes/fiches-locales/types";
import {
  CRITERES_DELEGUES,
  FICHES_SOUS_LE_SEUIL,
  motsPropres,
  SEUILS_QUALITE,
  VILLES_INDEXEES_SANS_FICHE,
  estDispenseeDeFiche,
  evaluerQualiteVille,
  partSuitesCommunes,
  villePasseLaPorte,
} from "@/content/villes/qualite-indexation";
import { VILLES_HORS_MAILLAGE, VILLES_INDEXEES_SLUGS } from "@/content/villes/villes-indexees";

const FICHES = Object.values(FICHES_LOCALES);
const base = FICHES_LOCALES.lyon!;

function clone(slug: string, nom: string, patch: Partial<FicheLocale> = {}): FicheLocale {
  return { ...base, slug, nomVille: nom, ...patch };
}
const avec = (...fs: FicheLocale[]) =>
  Object.fromEntries([...FICHES, ...fs].map((f) => [f.slug, f] as const));
const echecs = (slug: string, fiches: Record<string, FicheLocale>) =>
  evaluerQualiteVille(slug, fiches)
    .filter((c) => !c.ok)
    .map((c) => c.critere);

describe("porte de qualité · critères", () => {
  it("une ville sans fiche échoue sur la fiche et rien d'autre", () => {
    const r = evaluerQualiteVille("ville-fictive-sans-fiche");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ critere: "fiche locale présente", ok: false });
    expect(r[0]!.motif).toContain("ville-fictive-sans-fiche");
    expect(villePasseLaPorte("ville-fictive-sans-fiche")).toBe(false);
  });

  it("chaque fiche actuelle ne rate QUE les critères listés au cliquet (ni plus, ni moins)", () => {
    for (const f of FICHES) {
      const attendu = [...(FICHES_SOUS_LE_SEUIL[f.slug] ?? [])].sort();
      expect(echecs(f.slug, FICHES_LOCALES).sort(), f.slug).toEqual(attendu);
    }
  });

  it("l'unicité mesurée par la porte est sous 30 % entre toutes les fiches actuelles", () => {
    for (const a of FICHES)
      for (const b of FICHES)
        if (a.slug !== b.slug)
          expect(partSuitesCommunes(a, b, FICHES), `${a.slug}/${b.slug}`).toBeLessThan(0.3);
  });

  it("une fiche copiée à l'identique échoue sur l'unicité", () => {
    const copie = clone("ville-copie", "Villecopie");
    const fiches = avec(copie);
    expect(partSuitesCommunes(copie, base)).toBeGreaterThan(0.9);
    expect(echecs("ville-copie", fiches)).toEqual(
      expect.arrayContaining([
        "moins de 30 % de suites de 6 mots communes avec chaque autre fiche",
        "au moins 250 mots propres à la ville",
      ]),
    );
  });

  it("seuil de 30 % : un cas à 31 % échoue, un cas à 29 % passe", () => {
    const mot = (i: number) =>
      `m${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + (Math.floor(i / 26) % 26))}${String.fromCharCode(97 + Math.floor(i / 676))}`.replace(
        /\d/g,
        "z",
      );
    const N = 400;
    const texte = (debut: number, n: number) =>
      Array.from({ length: n }, (_, i) => mot(debut + i)).join(" ");
    const synth = (slug: string, nom: string, prose: string): FicheLocale => ({
      ...base,
      slug,
      nomVille: nom,
      prose: { tissu: prose, ecosysteme: "", zone: "" },
      faqLocale: [],
    });
    const A = synth("ville-a", "Villea", texte(0, N));
    // B reprend les m premiers mots de A, puis du texte inédit : part ≈ (m − 5) / (N − 5).
    const partiel = (m: number) =>
      synth("ville-b", "Villeb", `${texte(0, m)} ${texte(5000, N - m)}`);
    const B31 = partiel(Math.round(0.31 * (N - 5) + 5));
    const B29 = partiel(Math.round(0.29 * (N - 5) + 5));
    const p31 = partSuitesCommunes(B31, A);
    const p29 = partSuitesCommunes(B29, A);
    expect(p31).toBeGreaterThan(0.3);
    expect(p31).toBeLessThan(0.33);
    expect(p29).toBeLessThan(0.3);
    expect(p29).toBeGreaterThan(0.27);
    const CRIT = "moins de 30 % de suites de 6 mots communes avec chaque autre fiche";
    expect(echecs("ville-b", { "ville-a": A, "ville-b": B31 })).toContain(CRIT);
    expect(echecs("ville-b", { "ville-a": A, "ville-b": B29 })).not.toContain(CRIT);
  });

  it("« mots propres » : lecture littérale, un mot inédit n'en fait pas onze", () => {
    const copie = clone("ville-copie2", "Villecopie2");
    const un = { ...copie, prose: { ...copie.prose, zone: `${copie.prose.zone} inedit` } };
    expect(motsPropres(un, FICHES)).toBeLessThan(3);
  });

  it("moins de 3 secteurs, 3 institutions ou 3 questions échoue", () => {
    const m = FICHES_LOCALES.nice!;
    const maigre = clone("ville-maigre", "Villemaigre", {
      prose: m.prose,
      faqLocale: m.faqLocale.slice(0, 2),
      institutions: m.institutions.slice(0, 2),
      entreprises: { ...m.entreprises, secteurs: m.entreprises.secteurs.slice(0, 2) },
    });
    expect(echecs("ville-maigre", avec(maigre))).toEqual(
      expect.arrayContaining([
        "au moins 3 secteurs chiffrés",
        "au moins 3 institutions publiques",
        "3 questions locales",
      ]),
    );
  });

  it("le nom de la ville du siège dans le texte fait échouer la porte", () => {
    const siege = [...VILLES_HORS_MAILLAGE][0]!;
    const m = FICHES_LOCALES.rennes!;
    const fautive = clone("ville-fautive", "Villefautive", {
      prose: { ...m.prose, zone: `${m.prose.zone} ${siege}` },
      faqLocale: m.faqLocale,
      entreprises: m.entreprises,
      institutions: m.institutions,
    });
    expect(echecs("ville-fautive", avec(fautive))).toContain("nom de la ville du siège absent");
  });
});

describe("porte de qualité · villes indexées et cliquet", () => {
  it("toute ville indexée a une fiche qui passe la porte, ou figure dans la liste transitoire", () => {
    const fautives = VILLES_INDEXEES_SLUGS.filter(
      (s) => !villePasseLaPorte(s) && !estDispenseeDeFiche(s),
    );
    expect(fautives).toEqual([]);
  });

  it("ajouter une ville sans fiche à l'index ferait échouer le test", () => {
    const simulee = [...VILLES_INDEXEES_SLUGS, "ville-ajoutee-sans-fiche"];
    const fautives = simulee.filter((s) => !villePasseLaPorte(s) && !estDispenseeDeFiche(s));
    expect(fautives).toEqual(["ville-ajoutee-sans-fiche"]);
  });

  it("la liste transitoire ne contient que des villes indexées SANS fiche (rien d'obsolète)", () => {
    for (const s of VILLES_INDEXEES_SANS_FICHE) {
      expect(VILLES_INDEXEES_SLUGS, s).toContain(s);
      expect(
        FICHES_LOCALES[s],
        `${s} a désormais une fiche : la retirer de la liste`,
      ).toBeUndefined();
    }
    expect(new Set(VILLES_INDEXEES_SANS_FICHE).size).toBe(VILLES_INDEXEES_SANS_FICHE.length);
  });

  it("cliquet par contenu : fiches sous le seuil = sous-ensemble de la liste initiale (slugs et critères)", () => {
    const INITIALE: Record<string, string[]> = {
      marseille: ["M"],
      lyon: ["M"],
      toulouse: ["M"],
      nice: ["I", "M"],
      nantes: ["M"],
      montpellier: ["I", "M"],
      strasbourg: ["I", "M"],
      bordeaux: ["M"],
      lille: ["M"],
      rennes: ["I", "M"],
    };
    const LIB: Record<string, string> = {
      M: "au moins 250 mots propres à la ville",
      I: "au moins 3 institutions publiques",
    };
    for (const [slug, criteres] of Object.entries(FICHES_SOUS_LE_SEUIL)) {
      expect(INITIALE[slug], `${slug} : ajout interdit`).toBeDefined();
      const permis = INITIALE[slug]!.map((c) => LIB[c]);
      for (const c of criteres) expect(permis, `${slug} : ${c}`).toContain(c);
      expect(criteres.length, `${slug} : liste vide, retirer l'entrée`).toBeGreaterThan(0);
    }
  });

  it("cliquet par nombre : jamais plus de 29 sans fiche, plus la seule ville du siège", () => {
    expect(VILLES_HORS_MAILLAGE.size).toBe(1);
    expect(VILLES_INDEXEES_SANS_FICHE.length).toBeLessThanOrEqual(29);
    const sansFiche = VILLES_INDEXEES_SLUGS.filter((s) => !FICHES_LOCALES[s]);
    expect(sansFiche.sort()).toEqual(
      [...VILLES_INDEXEES_SANS_FICHE, ...VILLES_HORS_MAILLAGE].sort(),
    );
  });

  it("cliquet par contenu : tout slug de la liste figurait dans la liste du 27/11/2026", () => {
    const INITIALE = new Set(
      [
        "paris saint-denis boulogne-billancourt montreuil argenteuil toulon aix-en-provence",
        "saint-etienne villeurbanne clermont-ferrand annecy nimes perpignan angers le-mans",
        "reims metz mulhouse nancy limoges amiens brest le-havre rouen caen dijon besancon",
        "tours orleans",
      ]
        .join(" ")
        .split(" "),
    );
    for (const s of VILLES_INDEXEES_SANS_FICHE) expect(INITIALE.has(s), s).toBe(true);
  });

  it("critères délégués : les tests qui les portent existent", () => {
    for (const f of Object.values(CRITERES_DELEGUES)) expect(existsSync(f), f).toBe(true);
  });

  it("le module est pur : liste blanche exacte de ses imports (aucun barrel de 29 Mo)", () => {
    const src = readFileSync("src/content/villes/qualite-indexation.ts", "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/gu)].map((m) => m[1]).sort();
    expect(imports).toEqual(
      [
        "@/content/villes/core",
        "@/content/villes/fiches-locales",
        "@/content/villes/fiches-locales/types",
        "@/content/villes/villes-indexees",
      ].sort(),
    );
  });
});
