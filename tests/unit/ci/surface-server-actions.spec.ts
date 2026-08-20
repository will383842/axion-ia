/**
 * 🔴 La surface HTTP réelle des modules `"use server"`.
 *
 * Next.js expose **tout export d'un module `"use server"` comme point d'entrée
 * HTTP** : un `POST` portant l'en-tête `Next-Action: <id>` l'appelle, sans
 * cookie, sans session, depuis n'importe où. La protection du groupe de routes
 * `(admin)` ne s'y applique pas — elle protège des PAGES, pas des actions.
 *
 * Le raisonnement qui produit la faille est toujours le même, et il paraît
 * raisonnable : « cette fonction n'est appelée que depuis une page admin déjà
 * protégée, donc elle n'a pas besoin de garde ». La surface Server Action
 * invalide cette prémisse.
 *
 * ## Pourquoi l'identifiant d'action n'est pas un secret
 *
 * L'image de production est poussée sur **GHCR en visibilité publique**
 * (`.github/workflows/deploy-coolify.yml`). Un `docker pull` rend
 * `.next/server/server-reference-manifest.json`, c'est-à-dire l'identifiant
 * exact de chaque action. Il n'y a pas d'obscurité à invoquer.
 *
 * ## Ce que ce fichier garde
 *
 * Une règle STRUCTURELLE, pas une liste de cas : un module `"use server"` ne
 * doit pas contenir de **ré-export par spécificateur** (`export { … }`).
 *
 * C'est le piège le plus discret du lot, parce qu'il ne ressemble pas à du
 * code exécutable. Le dépôt le savait déjà pour une autre raison —
 * `src/server/actions/qualiopi/_guards.ts` porte un commentaire expliquant
 * qu'un `export type { … }` dans un module `"use server"` était transformé par
 * Turbopack en `registerServerReference` et produisait un 500 sur toute la
 * console. La même transformation appliquée à une fonction de LECTURE ne
 * produit pas d'erreur : elle produit un point d'entrée public silencieux.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const RACINE = process.cwd();

function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

let memo: Array<{ fichier: string; source: string }> | null = null;
function modulesUseServer(): Array<{ fichier: string; source: string }> {
  if (memo !== null) return memo;
  const liste = execFileSync("git", ["ls-files", "src"], {
    cwd: RACINE,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .trim()
    .split(/\r?\n/)
    .filter((f) => /\.tsx?$/.test(f) && !/\.(spec|test)\.tsx?$/.test(f));
  memo = [];
  for (const fichier of liste) {
    const brut = readFileSync(path.join(RACINE, fichier), "utf8");
    if (!/^\s*["']use server["'];/m.test(brut)) continue;
    memo.push({ fichier, source: sansCommentaires(brut) });
  }
  return memo;
}

describe("🔴 surface HTTP des modules `use server`", () => {
  it("le recensement trouve les modules — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ. Une regex qui cesse de reconnaître la directive
    // rendrait ce fichier entièrement vert, et l'absence d'alerte se lirait
    // comme une absence de problème.
    expect(modulesUseServer().length).toBeGreaterThanOrEqual(200);
  });

  it("aucun module `use server` ne contient de ré-export `export { … }`", () => {
    // Deux fuites réelles trouvées par cette règle le 2026-08-19 :
    //
    //  · `qualiopi/appreciations.ts` ré-exportait `listAppreciations` — une
    //    lecture SANS garde et SANS limite obligatoire, qui rend toute la table
    //    des appréciations : nom et fonction du répondant, verbatims libres,
    //    notes, identifiants de stagiaire et de client. Appelable par un
    //    anonyme.
    //  · `qualiopi/presence.ts` ré-exportait `formatMinutesToHHhMM`, fonction
    //    SYNCHRONE — le motif exact du 500 déjà documenté dans `_guards.ts`.
    //
    // Un ré-export n'est jamais nécessaire ici : le consommateur importe
    // depuis la source, et si la fonction doit être appelable par le client,
    // elle mérite une action nommée, gardée, et visible en revue.
    const fautifs: string[] = [];
    for (const { fichier, source } of modulesUseServer()) {
      for (const m of source.matchAll(/^\s*export\s*\{[^}]*\}\s*(from\s*["'][^"']+["'])?\s*;/gm)) {
        fautifs.push(`${fichier} → ${m[0].replace(/\s+/g, " ").trim()}`);
      }
    }
    expect(
      fautifs,
      "Un `export { … }` dans un module `use server` devient un point d'entrée " +
        "HTTP public. Importez depuis la source, ou écrivez une action nommée " +
        "et gardée.",
    ).toEqual([]);
  });

  it("`_guards.ts` n'est PAS un module `use server`", () => {
    // 🔴 `logQualiopiActivity` y est exportée et reçoit sa session **en
    // paramètre**, sans jamais la revérifier. Tant que le module portait la
    // directive, un anonyme pouvait écrire des entrées `ActivityLog`
    // arbitraires en imputant l'acte à l'identifiant d'administrateur de son
    // choix — et le `catch` best-effort rendait l'attaque silencieuse.
    //
    // C'est la PREUVE d'audit RGPD art. 30 et Qualiopi : le registre censé
    // établir qui a fait quoi était inscriptible par n'importe qui.
    //
    // Le remède n'est pas d'ajouter une garde à un utilitaire interne, c'est
    // qu'il cesse d'être un point d'entrée. Aucun composant client n'importe ce
    // module — vérifié sur les 110 importeurs.
    const source = readFileSync(
      path.join(RACINE, "src/server/actions/qualiopi/_guards.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*["']use server["'];/m);
  });
});
