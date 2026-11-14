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

  it("n'imprime pas la variable qui porte le corps (echo/printf sans jq filtré)", () => {
    const lignes = code.split("\n").filter((l) => /\b(echo|printf)\b/.test(l));
    for (const l of lignes) {
      // Variables de réponse : `$r`, `$corps`, `$reponse`, `$envs`. Permis seulement vers un fichier
      // ou vers un `jq` dont le filtre n'est PAS l'identité.
      if (/\$\{?(r|corps|reponse|envs)\}?(?![A-Za-z0-9_])/.test(l)) {
        const versFichier = />\s*\/tmp\//.test(l);
        const versJqFiltre =
          /\|\s*jq\b/.test(l) && !/\|\s*jq\s+(-[a-zA-Z]+\s+)*'?\.'?\s*($|\||\))/.test(l);
        const extraitLeCode =
          /\|\s*(tail\s+-n1|sed\s+'\$d')/.test(l) && /(code|corps)=\$\(/.test(l);
        expect(
          versFichier || versJqFiltre || extraitLeCode,
          `corps brut imprimé : ${l.trim()}`,
        ).toBe(true);
      }
    }
  });

  it("n'imprime pas le fichier des variables lues (/tmp/envs.json)", () => {
    expect(code).not.toMatch(/\b(cat|head|tail|sed)\b[^\n|]*\/tmp\/envs\.json/);
  });

  it("ne renvoie le corps vers jq/sed/tail qu'avec une sortie filtrée à un champ", () => {
    const lignes = code.split("\n");
    for (const l of lignes) {
      const portele =
        /\$\{?(r|corps|reponse|envs)\}?(?![A-Za-z0-9_])/.test(l) ||
        /\/tmp\/(resp|rep|envs\.json)/.test(l);
      if (!portele || />\s*\/tmp\//.test(l)) continue;
      // `jq .`, `jq -r .`, `jq -r '.'`, `jq -S .` : l'identité réimprime tout le corps.
      expect(
        /\bjq\s+(-[a-zA-Z-]+\s+)*['"]?\.['"]?(\s|$|\||\))/.test(l),
        `jq identité sur le corps : ${l.trim()}`,
      ).toBe(false);
      // sed/tail/head/cat vers la sortie standard sur le corps, hors extraction du code HTTP.
      if (/\b(sed|tail|head|cat)\b/.test(l) && !/(code|corps)=\$\(/.test(l)) {
        expect(false, `sed/tail/head/cat sur le corps : ${l.trim()}`).toBe(true);
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
