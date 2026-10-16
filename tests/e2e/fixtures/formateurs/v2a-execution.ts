// Banc @formateurs, VÉRIFICATION 2 — équipe A : lancer `v2a-executer.ts` sous `tsx`.
//
// Même mécanique et même environnement que `argent-execution.ts` : les IBAN semés par
// l'exécuteur d'argent sont chiffrés avec SA clé de banc ; la vue « Virements à faire »
// doit les relire, donc la clé est la même (valeurs FICTIVES, jamais une donnée réelle).

import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SECRET_EMPREINTE_IBAN_BANC } from "./argent-execution";
import { MARQUEUR_RESULTAT_V2A, type EtapeV2a, type SortieV2a } from "./v2a-protocole";

/** La clé PII de l'exécuteur d'argent (`argent-execution.ts`) — fictive, 64 hex. */
const CLE_PII_BANC = "ba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0cba0c";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../../..");
const TSX = path.join(RACINE, "node_modules", ".bin", "tsx");
const EXECUTEUR = path.join(ICI, "v2a-executer.ts");

export function jouerV2a(etapes: readonly EtapeV2a[]): Promise<SortieV2a> {
  return new Promise<SortieV2a>((resolve, reject) => {
    execFile(
      TSX,
      [EXECUTEUR],
      {
        cwd: RACINE,
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          BANC_ENTREE_V2A: JSON.stringify({ etapes }),
          IBAN_EMPREINTE_SECRET: SECRET_EMPREINTE_IBAN_BANC,
          PII_ENCRYPTION_KEY: CLE_PII_BANC,
        },
      },
      (erreur, sortie, erreurs) => {
        const ligne = sortie.split("\n").find((l) => l.startsWith(MARQUEUR_RESULTAT_V2A));
        if (erreur || ligne === undefined) {
          reject(
            new Error(
              `exécuteur v2a en échec (${etapes.map((e) => e.etape).join(", ")}) :\n` +
                `${erreurs.slice(-4000)}\n${sortie.slice(-2000)}`,
            ),
          );
          return;
        }
        resolve(JSON.parse(ligne.slice(MARQUEUR_RESULTAT_V2A.length)) as SortieV2a);
      },
    );
  });
}

export async function jouerV2aUne<T>(etape: EtapeV2a): Promise<T> {
  const [r] = await jouerV2a([etape]);
  return r as T;
}
