/**
 * GARDE V2-21 — aucune image publique sans `alt` (hors décorative explicite).
 *
 * Une image porteuse d'information doit avoir un texte alternatif descriptif ;
 * une image décorative s'écrit `alt=""` EXPLICITEMENT (jamais un `alt` absent,
 * que les IA et les lecteurs d'écran lisent comme « nom de fichier »).
 * Le scan couvre `<img>`, `<Image>` de next/image, hors console, portail et PDF.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src");
const EXCLUS =
  /(\(admin\)|[\\/]components[\\/]admin[\\/]|[\\/]portail[\\/]|[\\/]server[\\/]|__tests__|\.(test|spec)\.)/;
// Composants qui transmettent `alt` par un objet de props (vérifié : `alt` y est obligatoire).
const PROPS_DEJA_TYPEES = new Set(["src/components/marketing/ZoomableImage.tsx"]);

function fichiers(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (EXCLUS.test(p)) continue;
    if (e.isDirectory()) fichiers(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function sansCommentaires(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, (m) => " ".repeat(m.length));
}

export function imagesSansAlt(source: string): number[] {
  const s = sansCommentaires(source);
  const lignes: number[] = [];
  const re = /<(img|Image)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    let depth = 0;
    let j = m.index;
    for (; j < s.length; j++) {
      const c = s[j];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && s[j - 1] !== "=") break;
    }
    const balise = s.slice(m.index, j + 1);
    if (!/\balt\s*=/.test(balise)) lignes.push(s.slice(0, m.index).split("\n").length);
  }
  return lignes;
}

describe("images publiques : alt explicite", () => {
  it('détecte une image sans alt et accepte alt="" décoratif', () => {
    expect(imagesSansAlt('<img src="/a.png" />')).toEqual([1]);
    expect(imagesSansAlt('<Image src="/a.png" alt="" />')).toEqual([]);
    expect(imagesSansAlt('// <img src="x">\n<img alt="Schéma" src="/a.png" />')).toEqual([]);
  });

  it("aucune image publique sans attribut alt", () => {
    const fautes: string[] = [];
    for (const f of fichiers(RACINE)) {
      const rel = f.slice(process.cwd().length + 1).replace(/\\/g, "/");
      if (PROPS_DEJA_TYPEES.has(rel)) continue;
      for (const l of imagesSansAlt(readFileSync(f, "utf8"))) fautes.push(`${rel}:${l}`);
    }
    expect(fautes).toEqual([]);
  });
});
