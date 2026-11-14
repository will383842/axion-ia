/**
 * Les workflows qui parlent à l'API Coolify n'impriment JAMAIS le corps brut d'une réponse :
 * le journal d'un run est lisible par tous ceux qui ont accès au dépôt, et une réponse Coolify
 * peut contenir des valeurs de variables ou des jetons. On n'affiche que le code HTTP et, pour
 * `/deploy`, un champ sûr extrait par `jq` (`deployment_uuid`).
 *
 * Mutation qui rougit : remettre `head -c …` sur un corps de réponse, ou `echo "$nom : $r"`.
 */
import { describe, expect, it } from "vitest";

import { codeYaml } from "./lire-un-workflow";

const WORKFLOWS = [
  ".github/workflows/coolify-drapeau.yml",
  ".github/workflows/coolify-poser-variable.yml",
] as const;

describe.each(WORKFLOWS)("%s", (chemin) => {
  const code = codeYaml(chemin);

  it("n'imprime aucun extrait de corps de réponse (head -c)", () => {
    expect(code).not.toMatch(/head\s+-c/);
  });

  it("n'imprime pas le contenu brut d'un fichier de réponse", () => {
    expect(code).not.toMatch(/\b(cat|head|tail)\b[^\n|]*\/tmp\/(resp|rep)\b/);
    expect(code).not.toMatch(/\$\(\s*(cat|head|tail)\b[^)]*\/tmp\/(resp|rep)/);
  });

  it("n'imprime pas la variable qui porte le corps (echo/printf sans jq)", () => {
    const lignes = code.split("\n").filter((l) => /\b(echo|printf)\b/.test(l));
    for (const l of lignes) {
      // Les variables de réponse sont `$r`, `$corps`, `$reponse` : permises seulement vers jq/fichier.
      if (/\$\{?(r|corps|reponse)\}?(?![A-Za-z0-9_])/.test(l)) {
        expect(l, `corps brut imprimé : ${l.trim()}`).toMatch(
          /\|\s*jq\b|>\s*\/tmp\/|\|\s*tail\b|\|\s*sed\b/,
        );
      }
    }
  });
});

describe("coolify-drapeau.yml › redéploiement", () => {
  it("n'affiche de /deploy que le deployment_uuid extrait par jq", () => {
    const code = codeYaml(".github/workflows/coolify-drapeau.yml");
    expect(code).toMatch(/deployment_uuid/);
    expect(code).not.toMatch(/echo "\$nom : \$r"/);
  });
});
