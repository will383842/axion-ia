/**
 * CLIQUET — aucune redirection admin ne doit oublier le préfixe de langue.
 *
 * 🔴 2026-08-21 — `signInAction` et `signOutAction` redirigeaient vers
 * `/<prefixe-admin>` sans `/fr`. Le proxy rattrapait par un 301, donc « ça
 * marchait » : un aller-retour de plus à chaque connexion et à chaque
 * déconnexion, et une URL intermédiaire que voit passer tout code qui attend
 * l'arrivée. Le fixture e2e `loginAsAdmin` s'y arrêtait, et les quatre specs
 * appelantes se `test.skip`aient — c'est ainsi que la couverture de la console
 * admin a disparu.
 *
 * 🔑 `adminPath()` existait déjà et fait exactement cela. Le chemin admin était
 * écrit de TROIS façons différentes dans la même fonctionnalité ; deux d'entre
 * elles ont divergé. Ce test interdit la troisième forme.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FICHIER = join(process.cwd(), "src", "features", "admin-auth", "actions.ts");

describe("redirections de l'authentification admin", () => {
  const source = readFileSync(FICHIER, "utf8");

  it("aucune redirection ne construit le chemin sans langue", () => {
    // On cherche la FORME fautive, pas un commentaire : une redirection dont
    // l'argument commence par le segment admin au lieu d'une locale.
    const lignes = source
      .split("\n")
      .map((l, i) => ({ n: i + 1, l }))
      .filter(({ l }) => !l.trimStart().startsWith("//"))
      .filter(({ l }) => /redirect\(\s*`\/\$\{adminSegment\(\)\}/.test(l))
      .map(({ n, l }) => `${n}: ${l.trim()}`);
    expect(
      lignes,
      'redirections admin sans préfixe de langue — passer par `adminPath("fr", …)`',
    ).toEqual([]);
  });

  it("les deux redirections passent bien par le helper", () => {
    // Contre-témoin : sans lui, supprimer les deux `redirect` rendrait le test
    // ci-dessus vert en n'ayant plus rien à surveiller.
    const appels = source.match(/redirect\(adminPath\(/g) ?? [];
    expect(appels.length, "connexion et déconnexion doivent toutes deux rediriger").toBe(2);
  });
});
