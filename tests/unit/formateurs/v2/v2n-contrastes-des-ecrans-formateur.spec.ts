/**
 * Vérification n° 2 — regard du FORMATEUR NOVICE : les CONTRASTES des couleurs que ses
 * écrans emploient (dossier en ligne, espace, connexion), lus dans les jetons de
 * `src/app/globals.css` — pas recopiés. Seuils WCAG 2.2 AA : 4,5:1 pour le texte courant,
 * 3:1 pour le contour qui permet de repérer un champ (critère 1.4.11).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../../..");
const CSS = readFileSync(path.join(RACINE, "src/app/globals.css"), "utf8");
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");

function jeton(nom: string): string {
  const m = new RegExp(`--color-${nom}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(CSS);
  if (!m?.[1]) throw new Error(`jeton --color-${nom} absent de globals.css`);
  return m[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminance(jeton(a)), luminance(jeton(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("V2-N · contrastes des écrans du formateur", () => {
  // Les paires lues dans les composants : texte / fond.
  const TEXTE: ReadonlyArray<readonly [string, string, string]> = [
    ["fg", "paper", "texte des cartes du dossier"],
    ["fg-soft", "paper", "aides sous les champs"],
    ["fg-soft", "sand", "encadrés « Trouvé », « registre »"],
    ["fg-muted", "bg", "légendes de l'espace"],
    ["error", "terracotta-soft", "message d'erreur du dossier"],
    ["error", "paper", "message d'erreur de la connexion"],
    ["paper", "terracotta", "texte blanc des gros boutons"],
    ["terracotta-deep", "paper", "liens « Une erreur ? Écrivez-nous »"],
    ["mocha-fg-muted", "mocha", "onglets inactifs de la barre du bas"],
    ["terracotta-on-mocha", "mocha", "onglet actif de la barre du bas"],
    ["success", "paper", "messages de réussite"],
  ];

  for (const [texte, fond, ou] of TEXTE) {
    it(`${ou} : ${texte} sur ${fond} ≥ 4,5:1`, () => {
      expect(contraste(texte, fond)).toBeGreaterThanOrEqual(4.5);
    });
  }

  // V2-N-13 (mineur, accessibilité) — le contour des champs du dossier (`border-border-
  // strong`, #c8bda0) sur la carte blanche fait 1,9:1 : sous le 3:1 qui permet de voir où
  // taper (WCAG 1.4.11). Les champs ne se distinguent de la carte que par ce filet.
  // `DossierFormateur.tsx` (classe `champ`).
  it.fails("V2-N-13 — le contour d'un champ du dossier se voit sur la carte (≥ 3:1)", () => {
    expect(lire("src/app/formateur/dossier/[id]/[jeton]/DossierFormateur.tsx")).toContain(
      "border-border-strong bg-paper",
    );
    expect(contraste("border-strong", "paper")).toBeGreaterThanOrEqual(3);
  });

  // V2-N-14 (mineur) — `text-sage-deep` (« Trouvé · active », « Code enregistré ») n'est
  // défini par aucun jeton : Tailwind ne produit pas la classe, la confirmation verte
  // s'affiche dans la couleur du texte courant. Classe morte.
  it.fails("V2-N-14 — les couleurs employées par le dossier existent dans les jetons", () => {
    const source = lire("src/app/formateur/dossier/[id]/[jeton]/DossierFormateur.tsx");
    const couleurs = new Set(
      [...source.matchAll(/(?:^|[\s"`])(?:text|bg|border)-([a-z]+(?:-[a-z]+)*)(?=[\s"`])/g)]
        .map((m) => m[1]!)
        .filter((c) => /^(sage|sand|terracotta|fg|error|paper|mocha|success)/.test(c)),
    );
    const absentes = [...couleurs].filter((c) => !new RegExp(`--color-${c}:`).test(CSS));
    expect(absentes).toEqual([]);
  });
});
