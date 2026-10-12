/**
 * La coquille de l'espace formateur n'embarque AUCUN module client.
 *
 * ## Le défaut
 *
 * Mesuré le 2026-10-12 (PR 1509, build de compilation puis `pnpm bundle:check`) :
 * chaque page de l'espace portait un chunk client de 3,5 ko, IDENTIQUE d'une page à
 * l'autre — la base d'icône de `lucide-react` (un composant `"use client"` depuis la
 * v1, à cause de son contexte) et le bouton de déconnexion (`useTransition` +
 * `useRouter`). Rendus par la coquille, que chaque page compose, ils étaient copiés
 * dans le chunk de CHAQUE page : la nouvelle page « Mon dossier » a suffi à faire
 * passer le cliquet « SOMME des page chunks PUBLICS » au-dessus de 280 kB.
 *
 * Ce test regarde le CODE : la coquille ne rend que des composants serveur.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function code(chemin: string): string {
  return readFileSync(chemin, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("coquille de l'espace formateur — zéro JavaScript copié dans chaque page", () => {
  it("n'importe aucune icône de lucide-react (composant client)", () => {
    expect(code("src/app/[locale]/espace-formateur/_coquille.tsx")).not.toMatch(
      /from\s+["']lucide-react["']/,
    );
  });

  it("les icônes de navigation sont des SVG rendus par le serveur", () => {
    const icones = code("src/components/espace-formateur/icones-navigation.tsx");
    expect(icones).not.toMatch(/["']use client["']/);
    expect(icones).not.toMatch(/lucide-react/);
  });

  it("le bouton de déconnexion est un formulaire serveur, pas un composant client", () => {
    const bouton = code("src/components/espace-formateur/FormateurLogoutButton.tsx");
    expect(bouton).not.toMatch(/["']use client["']/);
    expect(bouton).toMatch(/<form\b/);
    expect(bouton).toMatch(/action=\{logoutFormateurAction\}/);
  });
});
