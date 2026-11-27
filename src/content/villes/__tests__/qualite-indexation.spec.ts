// S6-3 — porte de qualité des villes indexées : aucune ville n'entre dans l'index sans une fiche
// locale sourcée, complète et distincte des autres. Test seul, sans effet sur le site.
import { describe, expect, it } from "vitest";

import { FICHES_LOCALES } from "@/content/villes/fiches-locales";
import type { FicheLocale } from "@/content/villes/fiches-locales/types";
import {
  FICHES_SOUS_LE_SEUIL,
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

  it("chaque fiche locale actuelle passe la porte, critère par critère (hors cliquet transitoire)", () => {
    for (const f of FICHES) {
      if (FICHES_SOUS_LE_SEUIL.includes(f.slug)) continue;
      const rate = evaluerQualiteVille(f.slug).filter((c) => !c.ok);
      expect(
        rate.map((c) => `${c.critere} (${c.motif})`),
        f.slug,
      ).toEqual([]);
    }
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

  it("une fiche qui reprend ~un tiers d'une autre échoue (seuil 30 %)", () => {
    const m = FICHES_LOCALES.marseille!;
    // texte propre de Marseille, sauf la prose « tissu » et « zone » reprises de Lyon.
    const mixte = clone("ville-mixte", "Villemixte", {
      prose: { tissu: base.prose.tissu, ecosysteme: m.prose.ecosysteme, zone: base.prose.zone },
      faqLocale: m.faqLocale,
    });
    const part = partSuitesCommunes(mixte, base);
    expect(part).toBeGreaterThan(SEUILS_QUALITE.partCommuneMax);
    expect(echecs("ville-mixte", avec(mixte))).toContain(
      "moins de 30 % de suites de 6 mots communes avec chaque autre fiche",
    );
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

  it("les fiches sous le seuil n'échouent QUE sur le nombre d'institutions (cliquet à jour)", () => {
    expect(FICHES_SOUS_LE_SEUIL.length).toBeLessThanOrEqual(4);
    for (const s of FICHES_SOUS_LE_SEUIL) {
      expect(FICHES_LOCALES[s], s).toBeDefined();
      expect(
        echecs(s, FICHES_LOCALES),
        `${s} passe désormais la porte : le retirer de la liste`,
      ).toEqual(["au moins 3 institutions publiques"]);
    }
  });

  it("cliquet par nombre : jamais plus de 29 (+ la ville du siège suivie à part)", () => {
    expect(VILLES_INDEXEES_SANS_FICHE.length).toBeLessThanOrEqual(29);
    const sansFiche = VILLES_INDEXEES_SLUGS.filter((s) => !FICHES_LOCALES[s]);
    expect(sansFiche.length).toBeLessThanOrEqual(30);
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

  it("le module est pur : aucun import du barrel de contenu des villes", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/content/villes/qualite-indexation.ts", "utf8");
    const imports = [...src.matchAll(/^import .* from "([^"]+)"/gmu)].map((m) => m[1]);
    for (const i of imports) expect(["@/content/villes", "@/content/villes/core"]).not.toContain(i);
  });
});
