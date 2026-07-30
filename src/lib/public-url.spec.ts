/**
 * Tests — URL absolue publique, et interdiction de `request.url` dans les
 * redirections de Route Handlers (constat du 2026-07-28).
 *
 * 🔴 Ce qui s'est passé en production. `new URL(chemin, request.url)` est
 * l'idiome que tout le monde écrit. Derrière le proxy Coolify, `request.url`
 * porte l'adresse d'écoute INTERNE du conteneur : le navigateur recevait
 * `Location: https://0.0.0.0:3000/fr/espace-formateur` → ERR_ADDRESS_INVALID.
 *
 * Les espaces formateur ET ressources étaient donc entièrement inaccessibles.
 * Le pire est la façon dont le défaut se présentait : le lien magique de
 * l'e-mail était correct, le jeton était consommé, la session posée — et la
 * redirection finale jetait l'utilisateur dans le vide. Comme le jeton est à
 * USAGE UNIQUE, chaque essai en brûlait un et la page affichait « lien
 * invalide », ce qui désignait le mauvais coupable.
 *
 * Le second test est un garde-fou de SOURCE : il relit les Route Handlers des
 * espaces authentifiés et refuse le motif fautif. Un test de comportement ne
 * suffirait pas ici — le défaut ne se voit qu'en production, derrière un proxy,
 * et aucun test unitaire ne reproduit ce contexte.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { publicUrl } from "./public-url";

describe("publicUrl", () => {
  it("rend une URL absolue sur l'origine publique, jamais sur 0.0.0.0", () => {
    const u = publicUrl("/fr/espace-formateur");
    expect(u.protocol).toMatch(/^https?:$/);
    expect(u.hostname).not.toBe("0.0.0.0");
    expect(u.pathname).toBe("/fr/espace-formateur");
  });

  it("préserve la query string", () => {
    const u = publicUrl("/fr/espace-formateur/connexion?erreur=lien_invalide");
    expect(u.pathname).toBe("/fr/espace-formateur/connexion");
    expect(u.searchParams.get("erreur")).toBe("lien_invalide");
  });

  it("rend un objet URL directement utilisable par NextResponse.redirect", () => {
    expect(publicUrl("/fr/espace-ressources")).toBeInstanceOf(URL);
  });
});

/**
 * Route Handlers des espaces authentifiés : ils redirigent vers des pages que
 * l'utilisateur doit atteindre depuis l'extérieur.
 */
const ROUTES_A_ORIGINE_PUBLIQUE = [
  "src/app/[locale]/espace-formateur/connexion/[token]/route.ts",
  "src/app/[locale]/espace-ressources/connexion/[token]/route.ts",
  "src/app/[locale]/espace-ressources/telecharger/[versionId]/route.ts",
];

/**
 * Retire commentaires de bloc et de ligne.
 *
 * ⚠️ Indispensable, et la première version de ce test l'a appris à ses dépens :
 * elle tombait sur le commentaire qui EXPLIQUE le correctif (« PAS
 * `new URL(..., request.url)` »). Un contrôle qui confond une explication avec
 * la chose expliquée est un contrôle faux — il pousse à tordre les commentaires
 * pour contenter la regex, donc à effacer le savoir qu'ils portent.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

describe("garde de source — aucune redirection ne repart de `request.url`", () => {
  for (const rel of ROUTES_A_ORIGINE_PUBLIQUE) {
    it(`${rel} n'utilise pas request.url comme base de redirection`, () => {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      const code = sansCommentaires(src);
      // On vise le MOTIF (`new URL(..., request.url)`), pas la chaîne
      // « request.url » seule : la lire pour ses `searchParams` est légitime.
      expect(code, `${rel} doit passer par publicUrl()`).not.toMatch(
        /new URL\([^)]*,\s*(request|req)\.url\s*\)/,
      );
      expect(code).toContain("publicUrl");
    });
  }
});
