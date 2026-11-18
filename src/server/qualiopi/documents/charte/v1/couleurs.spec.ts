// @vitest-environment node

/**
 * Charte v1 — valeurs figées et contraste des couples texte / fond réellement utilisés.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHARTE_COULEURS,
  CHARTE_COUPLES_TEXTE,
  CHARTE_ESPACES,
  CHARTE_PIED,
  CHARTE_RAYONS,
  CHARTE_TYPO,
} from "./couleurs";

/** Luminance relative WCAG 2.x d'une couleur `#RRGGBB`. */
function luminance(hex: string): number {
  const canal = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair! + 0.05) / (sombre! + 0.05);
}

describe("charte v1 — valeurs figées", () => {
  it("couleurs exactes", () => {
    expect(CHARTE_COULEURS).toEqual({
      fond: "#FAF9F5",
      texte: "#141413",
      grisChaud: "#E8E6DC",
      carte: "#FFFFFF",
      bordureCarte: "#E8E6DC",
      terracotta: "#B23F16",
      sombre: "#141413",
      sombreTexte: "#FAF9F5",
      sombreSurTitre: "#D97757",
      sombreSecondaire: "#B0AEA5",
      bleuDoux: "#E8F0FA",
      bleu: "#1F5FA8",
      lisere: ["#2F7FC8", "#F0B323", "#C2185B", "#A8C93A"],
    });
  });

  it("rayons exacts", () => {
    expect(CHARTE_RAYONS).toEqual({ carte: 11, tuile: 10, ligneTableau: 7.5, pastille: 99 });
  });

  it("typographie exacte, graisses 400/500/700 seulement", () => {
    expect(CHARTE_TYPO.police).toBe("Manrope");
    expect(CHARTE_TYPO.graisses).toEqual({ normale: 400, moyenne: 500, grasse: 700 });
    expect(CHARTE_TYPO.corps).toEqual({ taille: 10, interligne: 1.4 });
    expect(CHARTE_TYPO.petit).toEqual({ taille: 8.8 });
    expect(CHARTE_TYPO.pied).toEqual({ taille: 8 });
    expect(CHARTE_TYPO.surTitre).toEqual({ taille: 7.8, interlettrage: 0.9 });
    expect(CHARTE_TYPO.marque).toEqual({ taille: 12.5 });
    expect(CHARTE_TYPO.titre1).toEqual({ taille: 26, interligne: 1.05, interlettrage: -0.75 });
    expect(CHARTE_TYPO.titre2).toEqual({ taille: 14, interlettrage: -0.3 });
    expect(CHARTE_TYPO.titreCarte).toEqual({ taille: 11 });
    expect(CHARTE_TYPO.montantTotal).toEqual({ taille: 26 });
  });

  it("espaces exacts", () => {
    expect(CHARTE_ESPACES).toEqual({
      margeHaut: 37,
      margeCote: 40,
      basReserve: 76,
      ecartCartes: 7,
      carteV: 11,
      carteH: 13,
      hauteurLisere: 5,
    });
  });
});

describe("charte v1 — contraste des couples réellement utilisés", () => {
  it("la liste des couples n'est pas vide", () => {
    expect(CHARTE_COUPLES_TEXTE.length).toBeGreaterThanOrEqual(8);
  });

  it.each(CHARTE_COUPLES_TEXTE.map((c) => [c.nom, c.texte, c.fond] as const))(
    "%s : %s sur %s ≥ 4,5",
    (_nom, texte, fond) => {
      expect(contraste(texte, fond)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("toute couleur de texte utilisée est une couleur de la charte", () => {
    const valeurs = new Set<string>(
      Object.values(CHARTE_COULEURS).flatMap((v) => (Array.isArray(v) ? v : [v])),
    );
    for (const c of CHARTE_COUPLES_TEXTE) {
      expect(valeurs.has(c.texte)).toBe(true);
      expect(valeurs.has(c.fond)).toBe(true);
    }
  });
});

describe("charte v1 — le pied de page", () => {
  it("géométrie figée", () => {
    expect(CHARTE_PIED).toEqual({
      bas: 20,
      filet: 1,
      espaceHaut: 6,
      espaceEntreLignes: 1,
      lignesMax: 4,
    });
  });
});

/**
 * 🔑 `CHARTE_COUPLES_TEXTE` est tenu à la main : sans ce lien, un composant qui pose une
 * nouvelle couleur de texte ou de fond échapperait au contrôle de contraste en silence.
 * On lit donc les sources qui posent des couleurs (les composants et tout gabarit qui
 * importe la charte) et on exige la correspondance dans les DEUX sens.
 */
describe("charte v1 — CHARTE_COUPLES_TEXTE est relié aux couleurs réellement utilisées", () => {
  const RACINE_DOCUMENTS = join(__dirname, "..", "..");
  const nettoyer = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const sources = [
    join(__dirname, "composants.tsx"),
    ...readdirSync(join(RACINE_DOCUMENTS, "templates"))
      .filter((f) => f.endsWith(".tsx") && !f.endsWith(".spec.tsx"))
      .map((f) => join(RACINE_DOCUMENTS, "templates", f))
      .filter((f) => readFileSync(f, "utf8").includes("charte/v1")),
  ];
  const code = sources.map((f) => nettoyer(readFileSync(f, "utf8"))).join("\n");

  const noms = (motif: RegExp): Set<string> =>
    new Set([...code.matchAll(motif)].map((m) => m[1] as string));

  /** Couleurs de TEXTE posées via `color: C.xxx` (le `backgroundColor`/`borderColor` ne comptent pas). */
  const textesUtilises = noms(/(?<![A-Za-z])color:\s*C\.(\w+)/g);
  /** Fonds posés via `backgroundColor: C.xxx`. */
  const fondsUtilises = noms(/backgroundColor:\s*C\.(\w+)/g);
  /** Aplat décoratif sans texte dessus : la puce des listes. */
  const FONDS_SANS_TEXTE = new Set(["terracotta"]);

  /**
   * Valeur hexadécimale d'une couleur nommée. ⚠️ On compare des VALEURS, jamais des noms :
   * `texte` et `sombre` valent le même `#141413`, un nom retrouvé à partir de la valeur serait
   * ambigu.
   */
  const valeur = (nom: string): string => {
    const v = (CHARTE_COULEURS as Record<string, unknown>)[nom];
    if (typeof v !== "string") throw new Error(`couleur hors charte : ${nom}`);
    return v;
  };
  const textesHex = new Set([...textesUtilises].map(valeur));
  const fondsHex = new Set([...fondsUtilises].filter((n) => !FONDS_SANS_TEXTE.has(n)).map(valeur));
  fondsHex.add(CHARTE_COULEURS.fond);

  it("les sources scannées comprennent les composants et au moins un gabarit", () => {
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(textesUtilises.size).toBeGreaterThanOrEqual(4);
    expect(fondsUtilises.size).toBeGreaterThanOrEqual(4);
  });

  it("toute couleur de texte posée figure comme texte dans au moins un couple", () => {
    const couples = new Set(CHARTE_COUPLES_TEXTE.map((c) => c.texte));
    const manquantes = [...textesHex].filter((h) => !couples.has(h));
    expect(manquantes, `couleurs de texte sans couple : ${manquantes.join(", ")}`).toEqual([]);
  });

  it("tout fond posé sous du texte figure comme fond dans au moins un couple", () => {
    const couples = new Set(CHARTE_COUPLES_TEXTE.map((c) => c.fond));
    const manquants = [...fondsHex].filter((h) => !couples.has(h));
    expect(manquants, `fonds sans couple : ${manquants.join(", ")}`).toEqual([]);
  });

  it("réciproquement : aucun couple ne décrit une couleur que personne n'utilise", () => {
    const orphelins = CHARTE_COUPLES_TEXTE.filter(
      (c) => !textesHex.has(c.texte) || !fondsHex.has(c.fond),
    ).map((c) => c.nom);
    expect(orphelins, `couples orphelins : ${orphelins.join(", ")}`).toEqual([]);
  });

  it("CONTRE-TÉMOIN : une couleur de texte absente des couples serait vue", () => {
    const couples = new Set(CHARTE_COUPLES_TEXTE.map((c) => c.texte));
    expect(couples.has(CHARTE_COULEURS.grisChaud)).toBe(false);
    expect(couples.has(CHARTE_COULEURS.bleu)).toBe(true);
  });
});
