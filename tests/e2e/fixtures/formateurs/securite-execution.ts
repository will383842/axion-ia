// Banc @formateurs, équipe sécurité — lancer un SCÉNARIO côté serveur.
//
// Le spec ne charge pas les Server Actions (son chargeur ne sait pas charger
// `@sentry/nextjs`) : il lance `securite-serveur/executer.ts` sous `tsx`, qui
// joue le scénario contre le code RÉEL et rend ses observations. Les `expect`
// restent dans le spec.

import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MARQUEUR_RESULTAT } from "./protocole";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../../..");
const TSX = path.join(RACINE, "node_modules", ".bin", "tsx");
const EXECUTEUR = path.join(ICI, "securite-serveur", "executer.ts");

/** Démarrage de `tsx` (~3 s), chargement des actions, puis le scénario. */
const DELAI_MS = 150_000;

export function executerScenarioSecurite<T>(
  scenario: string,
  parametres: unknown,
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
        maxBuffer: 16 * 1024 * 1024,
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
