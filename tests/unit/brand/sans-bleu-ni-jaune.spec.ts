import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COULEURS_MARQUE } from "@/lib/brand/couleurs-marque";

/**
 * V4-02 — tableau B : plus de bleu ni de jaune dans les jetons, et contraste de la palette définitive.
 * Les hex ci-dessous sont ceux de couleurs-marque.json (palette définitive).
 */
const lire = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

function teinte(hex: string): { h: number; chroma: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r!, g!, b!);
  const min = Math.min(r!, g!, b!);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g! - b!) / d) % 6;
    else if (max === g) h = (b! - r!) / d + 2;
    else h = (r! - g!) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, chroma: d };
}

// Une teinte n'existe que si l'écart de canaux dépasse 20/255 (sinon : gris chaud).
const interdite = (hex: string) => {
  const { h, chroma } = teinte(hex);
  return chroma > 20 && ((h >= 190 && h <= 260) || (h >= 40 && h <= 70));
};

const hexDe = (src: string) =>
  [...src.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());

const versHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((c) => Math.min(255, c).toString(16).padStart(2, "0")).join("");

/** Remplace chaque commentaire CSS par des espaces (mêmes index) : leurs « ; » ou « { » ne faussent pas le sélecteur. */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));

/** TOUS les sélecteurs de la règle qui contient l'index (liste séparée par des virgules, pas le dernier nom seul). */
const selecteursDe = (src: string, index: number): string[] => {
  const avant = sansCommentaires(src).slice(0, index);
  const accolade = avant.lastIndexOf("{");
  if (accolade < 0) return [];
  const debut = Math.max(
    avant.lastIndexOf("{", accolade - 1),
    avant.lastIndexOf("}", accolade),
    avant.lastIndexOf(";", accolade),
  );
  return avant
    .slice(debut + 1, accolade)
    .split(",")
    .map((x) => x.trim().replace(/\s+/g, " "))
    .filter(Boolean);
};

/** hsl → RVB (s et l en %, h en degrés). */
const hslVersRvb = (h: number, s: number, l: number): [number, number, number] => {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as [number, number, number];
};

const SEP = String.raw`(?:\s*,\s*|\s+)`;
const FIN = String.raw`\s*(?:[,/][^)]*)?\)`;
const RGB_RE = new RegExp(String.raw`rgba?\(\s*(\d{1,3})${SEP}(\d{1,3})${SEP}(\d{1,3})${FIN}`, "g");
const HSL_RE = new RegExp(
  String.raw`hsla?\(\s*(-?[\d.]+)(?:deg)?${SEP}([\d.]+)%${SEP}([\d.]+)%${FIN}`,
  "g",
);

/** Couleurs rgb()/rgba()/hsl()/hsla() (avec ou sans virgules), converties en hex, avec les sélecteurs de leur règle. */
const rgbDe = (src: string) => [
  ...[...src.matchAll(RGB_RE)].map((m) => ({
    hex: versHex(Number(m[1]), Number(m[2]), Number(m[3])),
    selecteurs: selecteursDe(src, m.index!),
  })),
  ...[...src.matchAll(HSL_RE)].map((m) => ({
    hex: versHex(...hslVersRvb(((Number(m[1]) % 360) + 360) % 360, Number(m[2]), Number(m[3]))),
    selecteurs: selecteursDe(src, m.index!),
  })),
];

/**
 * Halos bleus restants : décision de Williams requise (lot V4 suivant).
 * Exceptions NOMMÉES, limitées à ces trois sélecteurs et à ce seul bleu rgba(26, 77, 217, …) :
 * tout NOUVEAU rgba bleu ou jaune, ailleurs, fait échouer le test.
 */
const HALOS_BLEUS_RESTANTS = {
  selecteurs: [".bg-halo-warm", ".bg-halo-cool", ".bg-mocha-rich"],
  hex: versHex(26, 77, 217),
};

describe("V4-02 : aucune teinte bleue (190-260°) ni jaune (40-70°)", () => {
  it.each(["src/app/globals.css", "src/lib/brand/couleurs-marque.ts"])("%s", (fichier) => {
    const src = lire(fichier);
    const fautifs = [
      ...new Set(
        [
          ...hexDe(src),
          ...rgbDe(src)
            .filter(
              (c) =>
                !(
                  c.hex === HALOS_BLEUS_RESTANTS.hex &&
                  c.selecteurs.length > 0 &&
                  c.selecteurs.every((x) => HALOS_BLEUS_RESTANTS.selecteurs.includes(x))
                ),
            )
            .map((c) => c.hex),
        ].filter(interdite),
      ),
    ];
    expect(fautifs).toEqual([]);
  });

  it("les halos bleus restants sont bien les trois sélecteurs nommés (rien de plus)", () => {
    const portes = rgbDe(lire("src/app/globals.css"))
      .filter((c) => c.hex === HALOS_BLEUS_RESTANTS.hex)
      .flatMap((c) => c.selecteurs);
    expect([...new Set(portes)].sort()).toEqual([...HALOS_BLEUS_RESTANTS.selecteurs].sort());
  });

  it("les jetons de la table B ont leur valeur cible", () => {
    const css = lire("src/app/globals.css");
    const val = (j: string) =>
      css.match(new RegExp(`--color-${j}\\s*:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
    const cibles: Record<string, string> = {
      primary: "#b23f16",
      "primary-400": "#b23f16",
      "primary-300": "#b23f16",
      "primary-hover": "#8f3412",
      "primary-soft": "#e8e6dc",
      info: "#5e5d59",
      mocha: "#141413",
      "mocha-soft": "#141413",
      "mocha-fg-muted": "#b0aea5",
      "terracotta-on-mocha": "#d97757",
      "fg-soft": "#5e5d59",
      "fg-muted": "#5e5d59",
      "terracotta-soft": "#e8e6dc",
      "terracotta-deep": "#8f3412",
      "sage-soft": "#eef1eb",
      "accent-orange": "#d97757",
      warning: "#8f3412",
    };
    for (const [j, hex] of Object.entries(cibles)) expect(val(j), j).toBe(hex);
  });

  it("le miroir COULEURS_MARQUE suit", () => {
    expect(COULEURS_MARQUE.primary).toBe("#b23f16");
    expect(COULEURS_MARQUE["primary-hover"]).toBe("#8f3412");
    expect(COULEURS_MARQUE.mocha).toBe("#141413");
  });
});

// Palette dérivée des jetons : COULEURS_MARQUE (miroir de @theme) pour ce qu'il couvre,
// globals.css pour le reste (orange, erreur, attention).
const jetonCss = (j: string) =>
  lire("src/app/globals.css")
    .match(new RegExp(`--color-${j}\\s*:\\s*(#[0-9a-fA-F]{6})`))?.[1]
    ?.toLowerCase() as string;
const PALETTE: Record<string, string> = {
  ivoire: COULEURS_MARQUE.bg,
  "gris-chaud": COULEURS_MARQUE.sand,
  noir: COULEURS_MARQUE.mocha,
  blanc: COULEURS_MARQUE.paper,
  terracotta: COULEURS_MARQUE.terracotta,
  "terracotta-survol": COULEURS_MARQUE["primary-hover"],
  orange: jetonCss("terracotta-on-mocha"),
  "gris-moyen": COULEURS_MARQUE["border-strong"],
  "texte-secondaire": COULEURS_MARQUE["fg-soft"],
  reussite: COULEURS_MARQUE.sage,
  erreur: jetonCss("error"),
  attention: jetonCss("warning"),
};
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(PALETTE[a]!), lum(PALETTE[b]!)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

// [texte, fond, seuil]
const AUTORISEES: Array<[string, string, number]> = [
  ["noir", "ivoire", 4.5],
  ["noir", "blanc", 4.5],
  ["noir", "gris-chaud", 4.5],
  ["blanc", "terracotta", 4.5],
  ["terracotta", "ivoire", 4.5],
  ["terracotta", "blanc", 4.5],
  ["terracotta", "gris-chaud", 4.5],
  ["blanc", "terracotta-survol", 4.5],
  ["terracotta-survol", "ivoire", 4.5],
  ["texte-secondaire", "ivoire", 4.5],
  ["texte-secondaire", "gris-chaud", 4.5],
  ["texte-secondaire", "blanc", 4.5],
  ["ivoire", "noir", 4.5],
  ["blanc", "noir", 4.5],
  ["gris-moyen", "noir", 4.5],
  ["orange", "noir", 4.5],
  ["reussite", "ivoire", 4.5],
  ["erreur", "ivoire", 4.5],
  ["attention", "ivoire", 4.5],
];
// Gros texte seulement (≥ 24 px, ou ≥ 18,66 px gras) : seuil WCAG 3, et sous 4,5 par construction.
const GROS_TEXTE_SEULEMENT: Array<[string, string, number]> = [["terracotta", "noir", 3]];
const INTERDITES: Array<[string, string]> = [
  ["orange", "ivoire"],
  ["gris-moyen", "ivoire"],
  ["texte-secondaire", "noir"],
  ["blanc", "orange"],
  ["reussite", "gris-chaud"],
];

describe("V4-02 : contraste de la palette définitive", () => {
  it.each(AUTORISEES)("%s sur %s ≥ %s", (t, f, seuil) => {
    expect(ratio(t, f)).toBeGreaterThanOrEqual(seuil);
  });
  it.each(GROS_TEXTE_SEULEMENT)("%s sur %s : gros texte seulement (≥ %s, < 4,5)", (t, f, seuil) => {
    expect(ratio(t, f)).toBeGreaterThanOrEqual(seuil);
    expect(ratio(t, f)).toBeLessThan(4.5);
  });
  it.each(INTERDITES)("%s sur %s reste < 4,5", (t, f) => {
    expect(ratio(t, f)).toBeLessThan(4.5);
  });
});
