// Banc @formateurs, vérification n° 2 (rouge « parcours et e-mails ») — lancer un
// SCÉNARIO côté serveur.
//
// Même protocole que `securite-execution.ts` (équipe sécurité) : le spec ne charge
// ni les Server Actions ni le domaine Qualiopi ; il lance `v2p-serveur.ts` sous
// `tsx`, qui joue le scénario contre le code RÉEL (base, file, worker et puits du
// job) et rend ses OBSERVATIONS. Les `expect` restent dans le spec.

import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MARQUEUR_RESULTAT } from "./protocole";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../../..");
const TSX = path.join(RACINE, "node_modules", ".bin", "tsx");
const EXECUTEUR = path.join(ICI, "v2p-serveur.ts");

/** Démarrage de `tsx`, chargement des actions, puis le scénario (attentes du worker comprises). */
const DELAI_MS = 280_000;

export function executerScenarioV2p<T>(
  scenario: string,
  parametres: unknown = {},
  /** Variables d'environnement propres à CE processus (jamais au worker). */
  env: Readonly<Record<string, string>> = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    execFile(
      TSX,
      [EXECUTEUR],
      {
        cwd: RACINE,
        timeout: DELAI_MS,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, ...env, BANC_ENTREE: JSON.stringify({ scenario, parametres }) },
      },
      (erreur, sortie, erreurs) => {
        const ligne = sortie.split("\n").find((l) => l.startsWith(MARQUEUR_RESULTAT));
        if (erreur || ligne === undefined) {
          reject(
            new Error(
              `scénario « ${scenario} » en échec :\n${erreurs.slice(-6000)}\n${sortie.slice(-2000)}`,
            ),
          );
          return;
        }
        resolve(JSON.parse(ligne.slice(MARQUEUR_RESULTAT.length)) as T);
      },
    );
  });
}
