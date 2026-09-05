/**
 * empreinte.ts — l'accès DISQUE aux artefacts copiés depuis Axion Partners.
 *
 * Séparé de `contrat.ts` à dessein : `contrat.ts` est du code d'application, il
 * importe le JSON comme un module et ne touche jamais au système de fichiers. Ce
 * module-ci lit des OCTETS, et n'est appelé que par le test de transcription et par
 * `scripts/partners/fixtures.ts` — deux contextes Node, jamais un rendu de page.
 *
 * 🔑 Pourquoi lire l'empreinte au lieu de l'écrire en constante : une constante
 * recopiée à la main serait mise à jour par la même personne, dans le même geste, que
 * la copie qu'elle est censée surveiller. Elle ne surveillerait plus rien.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `__dirname` n'existe pas en ESM, et `import.meta.url` n'existe pas en CJS. Vitest
 * transforme ce fichier en ESM ; `tsx` aussi. On passe donc par `import.meta.url`,
 * avec un repli sur `process.cwd()` pour les rares hôtes qui ne le fournissent pas.
 */
function racine(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.cwd(), "src", "server", "partners", "contrat");
  }
}

/** Le chemin absolu de la copie du JSON Schema publié par Partners. */
export function cheminContratPublie(): string {
  return path.join(racine(), "contracts.v1.json");
}

/**
 * L'empreinte que Partners a publiée, LUE dans `contracts.sha256`.
 *
 * ⚠️ Ce n'est PAS le hash recalculé du fichier voisin : ce serait une tautologie, et
 * le test de transcription ne prouverait plus rien. C'est la valeur écrite par
 * `pnpm contracts:export` DANS L'AUTRE DÉPÔT, au format `sha256sum`.
 */
export function empreinteContratPublie(): string {
  const ligne = readFileSync(path.join(racine(), "contracts.sha256"), "utf8").trim();
  const hash = ligne.slice(0, 64);
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error(
      `[partners] contracts.sha256 illisible : « ${ligne} ». Attendu « <64 hex>  contracts.v1.json ».`,
    );
  }
  return hash;
}
