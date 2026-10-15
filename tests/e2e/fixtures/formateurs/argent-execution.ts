// Banc @formateurs, équipe ARGENT — lancer `argent-executer.ts` sous `tsx`.
//
// Même mécanique que `execution.ts` (le chargeur de Playwright ne sait pas charger
// `@sentry/nextjs`) : un processus `tsx` joue les étapes, rend une ligne de
// résultat, et le spec constate en base avec son propre client.
//
// Environnement : celui du spec, plus deux valeurs FICTIVES propres au banc :
//   · le secret de l'empreinte d'IBAN, absent du job (sans lui, `empreinteIban` rend
//     `null` et aucun IBAN ne peut être semé ni changé) ;
//   · une clé de chiffrement des données personnelles au FORMAT attendu (64 hex) : celle
//     du job est une chaîne factice que `encryptPii` refuse (« aucun repli en clair »).
//     Seuls ces processus l'utilisent ; ils chiffrent et relisent leurs propres IBAN.

import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MARQUEUR_RESULTAT_ARGENT, type EtapeArgent, type SortieArgent } from "./argent-protocole";

/** Secret d'empreinte d'IBAN du banc — fictif, n'a jamais protégé un vrai compte. */
export const SECRET_EMPREINTE_IBAN_BANC =
  "banc-formateurs-argent-secret-empreinte-iban-fictif-0001";
/** Clé PII du banc — fictive (64 hex), n'a jamais chiffré une donnée réelle. */
const CLE_PII_BANC = "ba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0c";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../../..");
const TSX = path.join(RACINE, "node_modules", ".bin", "tsx");
const EXECUTEUR = path.join(ICI, "argent-executer.ts");

/** Démarrage de `tsx` (~3 s), rendu PDF d'une autofacture compris. */
const DELAI_MS = 120_000;

export function jouer(etapes: readonly EtapeArgent[]): Promise<SortieArgent> {
  return new Promise<SortieArgent>((resolve, reject) => {
    execFile(
      TSX,
      [EXECUTEUR],
      {
        cwd: RACINE,
        timeout: DELAI_MS,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          BANC_ENTREE_ARGENT: JSON.stringify({ etapes }),
          IBAN_EMPREINTE_SECRET: SECRET_EMPREINTE_IBAN_BANC,
          PII_ENCRYPTION_KEY: CLE_PII_BANC,
        },
      },
      (erreur, sortie, erreurs) => {
        const ligne = sortie.split("\n").find((l) => l.startsWith(MARQUEUR_RESULTAT_ARGENT));
        if (erreur || ligne === undefined) {
          reject(
            new Error(
              `exécuteur argent en échec (${etapes.map((e) => e.etape).join(", ")}) :\n` +
                `${erreurs.slice(-4000)}\n${sortie.slice(-2000)}`,
            ),
          );
          return;
        }
        resolve(JSON.parse(ligne.slice(MARQUEUR_RESULTAT_ARGENT.length)) as SortieArgent);
      },
    );
  });
}

/** Une seule étape, son résultat typé par l'appelant. */
export async function jouerUne<T>(etape: EtapeArgent): Promise<T> {
  const [r] = await jouer([etape]);
  return r as T;
}
