// Banc @formateurs — lancer le code serveur RÉEL depuis un spec Playwright.
//
// Le spec n'importe pas la route ni la découverte Calendly (son chargeur de
// modules ne sait pas charger `@sentry/nextjs`, cf. `serveur/executer.ts`) : il
// lance l'exécuteur sous `tsx`, attend sa ligne de résultat, puis constate en
// base avec son propre client Prisma.
//
// L'environnement transmis est celui du spec (donc, sous Gate B, la base et le
// Redis du job), complété de trois valeurs FICTIVES propres au banc.

import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MARQUEUR_RESULTAT, type EntreeBanc } from "./protocole";

/** Clé de signature webhook du banc — fictive, n'a jamais existé chez Calendly. */
export const CLE_WEBHOOK_BANC = "banc-formateurs-cle-webhook-fictive";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../../..");
const TSX = path.join(RACINE, "node_modules", ".bin", "tsx");
const EXECUTEUR = path.join(ICI, "serveur", "executer.ts");

/** Délai d'un passage : démarrage de `tsx` (~3 s) plus la chaîne serveur. */
const DELAI_MS = 90_000;

export function executerCoteServeur<T>(entree: EntreeBanc): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    execFile(
      TSX,
      [EXECUTEUR],
      {
        cwd: RACINE,
        timeout: DELAI_MS,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          BANC_ENTREE: JSON.stringify(entree),
          CALENDLY_WEBHOOK_SIGNING_KEY: CLE_WEBHOOK_BANC,
          CALENDLY_API_TOKEN: "banc-formateurs-jeton-fictif",
          // L'outbox CRM s'écrit — c'est elle que le banc constate. Rien n'en
          // sort : sans `CRM_SYNC_URL` ni file BullMQ, aucune émission.
          CRM_SYNC_ENABLED: "true",
        },
      },
      (erreur, sortie, erreurs) => {
        const ligne = sortie.split("\n").find((l) => l.startsWith(MARQUEUR_RESULTAT));
        if (erreur || ligne === undefined) {
          reject(
            new Error(
              `exécuteur du banc en échec (${entree.action}) :\n${erreurs.slice(-4000)}\n${sortie.slice(-2000)}`,
            ),
          );
          return;
        }
        resolve(JSON.parse(ligne.slice(MARQUEUR_RESULTAT.length)) as T);
      },
    );
  });
}
