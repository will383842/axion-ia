/**
 * CLIQUET — plus aucun test ne vise le mot de passe par son LIBELLÉ.
 *
 * 🔴 2026-08-21 — `getByLabel(/mot de passe/i)` résout DEUX éléments depuis
 * l'ajout du bouton « Afficher le mot de passe » : le champ, et le bouton. La
 * strict mode violation qui en découle a rendu inerte toute la couverture E2E
 * de la console admin (PR 775).
 *
 * 🔑 Et le correctif a d'abord été INCOMPLET. J'ai balayé les fichiers qui
 * appellent `loginAsAdmin` — pas ceux qui recopient le sélecteur. Un fichier
 * l'avait recopié, `tests/e2e/flows/admin-auth.spec.ts`, et il a continué à
 * rougir seul dans le journal de Gate B, six fois par exécution.
 *
 * Après un correctif de sélecteur, ce qu'il faut balayer, ce sont les USAGES du
 * sélecteur. Un prédicat recopié diverge toujours ; ce test empêche la copie
 * suivante.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "tests", "e2e");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return chemin.endsWith(".ts") ? [chemin] : [];
  });
}

describe("le champ mot de passe ne se vise pas par son libellé", () => {
  it("aucun test ne cible le mot de passe avec getByLabel", () => {
    const fautifs: string[] = [];
    for (const chemin of fichiers(RACINE)) {
      const lignes = readFileSync(chemin, "utf8").split("\n");
      lignes.forEach((ligne, i) => {
        // Les commentaires expliquent justement pourquoi c'est interdit : ils ne
        // sont pas des usages. Sans cette exclusion, le test se trouverait
        // lui-même — piège déjà payé ailleurs dans ce dépôt.
        const nu = ligne.trim();
        if (nu.startsWith("//") || nu.startsWith("*")) return;
        if (/getByLabel\(\s*\/[^/]*mot de passe/i.test(ligne)) {
          fautifs.push(`${chemin.replace(process.cwd(), "").replace(/\\/g, "/")}:${i + 1}`);
        }
      });
    }
    expect(
      fautifs,
      "ces fichiers visent le champ mot de passe par son libellé — il en existe DEUX " +
        'porteurs ("Mot de passe" et "Afficher le mot de passe"), et Playwright lève. ' +
        'Cibler le RÔLE : getByRole("textbox", { name: /mot de passe/i })',
    ).toEqual([]);
  });

  it("le fixture partagé cible bien le rôle", () => {
    // Contre-témoin : si le fixture cessait de viser le rôle, le test ci-dessus
    // resterait vert alors que la couverture admin serait de nouveau inerte.
    const fixture = readFileSync(join(RACINE, "fixtures", "admin-auth.ts"), "utf8");
    expect(fixture).toMatch(/getByRole\(\s*"textbox"\s*,\s*\{\s*name:\s*\/mot de passe/);
  });
});
