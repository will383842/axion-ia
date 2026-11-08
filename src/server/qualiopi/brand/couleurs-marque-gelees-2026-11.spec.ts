import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  QUALIOPI_BRAND_COLORS,
  QUALIOPI_BRAND_FONTS,
  QUALIOPI_PDF_SPACE,
  QUALIOPI_PDF_TYPE,
} from "@/server/qualiopi/brand/brand-tokens";
import { COULEURS_MARQUE_GELEES_2026_11 as GELE } from "@/lib/brand/couleurs-marque-gelees-2026-11";

// ⛔ Constantes relevées AVANT le gel, sur le code d'origine. Rouge = annuler, jamais « mettre à jour ».
const EMPREINTE_AVANT = "24af1bdebf79c46521d336d6b8e09194b9974917b8d179337359088dc8320306";
const EMPREINTE_TTF_AVANT = "90b31fd8c4c52d8b0e9f88a13f098a1c0bb3a30cd9713b2f772cadde01477b64";
const TTF_PDF = [
  "Fraunces-Regular",
  "Fraunces-Italic",
  "Fraunces-Bold",
  "Manrope-Regular",
  "Manrope-Medium",
  "Manrope-Bold",
  "Manrope-ExtraBold",
  "Inconsolata-Regular",
  "Inconsolata-Bold",
];

const sha = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
const trie = (o: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
const empreinte = (c: Record<string, string>) =>
  sha(
    JSON.stringify({
      c: trie(c),
      t: QUALIOPI_PDF_TYPE,
      s: QUALIOPI_PDF_SPACE,
      f: QUALIOPI_BRAND_FONTS,
    }),
  );

describe("🔴 V8-P0 — couleurs, échelles et polices gelées à la source", () => {
  it("les 21 valeurs littérales", () => {
    expect(GELE).toEqual({
      bg: "#faf8f3",
      paper: "#ffffff",
      sand: "#f0e9da",
      "sand-deep": "#e6dcc4",
      mocha: "#2a2520",
      "mocha-soft": "#3d362f",
      "mocha-fg": "#f7f3ea",
      fg: "#1a1815",
      "fg-soft": "#524b41",
      "fg-muted": "#5a4f44",
      primary: "#1a4dd9",
      "primary-hover": "#0f3aae",
      "primary-fg": "#ffffff",
      "primary-soft": "#e8efff",
      terracotta: "#b23f16",
      "terracotta-soft": "#f5e3d8",
      "terracotta-deep": "#8c3010",
      sage: "#5e6c54",
      "sage-soft": "#e6ebe2",
      border: "#e5ddc8",
      "border-strong": "#c8bda0",
    });
    expect(Object.keys(GELE)).toHaveLength(21);
  });

  it("empreinte sha256 couleurs + QUALIOPI_PDF_TYPE + QUALIOPI_PDF_SPACE + polices", () => {
    expect(empreinte(GELE)).toBe(EMPREINTE_AVANT);
  });

  it("contre-témoin : une valeur changée produit une autre empreinte", () => {
    expect(empreinte({ ...GELE, terracotta: "#c24a1b" })).not.toBe(EMPREINTE_AVANT);
  });

  it("empreinte des .ttf embarqués dans les PDF", () => {
    const lignes = TTF_PDF.map(
      (n) => `${n}:${sha(readFileSync(path.join(process.cwd(), "public/fonts", `${n}.ttf`)))}`,
    );
    expect(sha(lignes.join("\n"))).toBe(EMPREINTE_TTF_AVANT);
  });

  it("objets gelés, et QUALIOPI_BRAND_COLORS EST la copie gelée", () => {
    expect(Object.isFrozen(GELE)).toBe(true);
    expect(Object.isFrozen(QUALIOPI_PDF_TYPE)).toBe(true);
    expect(Object.isFrozen(QUALIOPI_PDF_SPACE)).toBe(true);
    expect(QUALIOPI_BRAND_COLORS).toBe(GELE);
  });

  it("archives, base-layout et apercu-filigrane n'importent pas la charte vivante", () => {
    const doc = path.join(process.cwd(), "src/server/qualiopi/documents");
    const fichiers = [
      ...readdirSync(path.join(doc, "templates/archives"))
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => path.join(doc, "templates/archives", f)),
      path.join(doc, "base-layout.tsx"),
      path.join(doc, "apercu-filigrane.tsx"),
    ];
    expect(fichiers.length).toBeGreaterThan(2);
    for (const f of fichiers)
      expect(readFileSync(f, "utf8"), f).not.toMatch(/couleurs-marque["']|couleurs-pieces/);
  });
});
