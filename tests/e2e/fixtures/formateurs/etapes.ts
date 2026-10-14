// Banc @formateurs — lancer UNE ÉTAPE de scénario côté serveur.
//
// Le spec n'importe jamais le code serveur qu'il vérifie (le chargeur de
// Playwright ne sait pas charger `@sentry/nextjs` ni `next/cache`) : il lance
// `serveur/etapes.ts` sous `tsx`, avec `serveur/contexte-console.mjs`, puis
// constate en base avec son propre client Prisma.

import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CLE_WEBHOOK_BANC } from "./execution";
import { MARQUEUR_RESULTAT, type EntreeEtape, type ResultatEtape } from "./protocole";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../../..");
const TSX = path.join(RACINE, "node_modules", ".bin", "tsx");
const EXECUTEUR = path.join(ICI, "serveur", "etapes.ts");
const CONTEXTE = path.join(ICI, "serveur", "contexte-console.mjs");

const DELAI_MS = 120_000;

export function etape<T>(entree: EntreeEtape): Promise<ResultatEtape<T>> {
  return new Promise((resolve, reject) => {
    execFile(
      TSX,
      ["--import", CONTEXTE, EXECUTEUR],
      {
        cwd: RACINE,
        timeout: DELAI_MS,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          BANC_ENTREE: JSON.stringify(entree),
          BANC_SESSION: entree.session ? JSON.stringify(entree.session) : "",
          BANC_IP: entree.ip ?? "192.0.2.10",
          CALENDLY_WEBHOOK_SIGNING_KEY: CLE_WEBHOOK_BANC,
          CALENDLY_API_TOKEN: "banc-formateurs-jeton-fictif",
          CRM_SYNC_ENABLED: "true",
          // Le relevé des réponses aux candidatures : allumé pour le banc
          // seulement, avec une boîte simulée (jamais Zoho).
          CANDIDATS_REPONSES_RECUES_ENABLED: "true",
        },
      },
      (erreur, sortie, erreurs) => {
        const ligne = sortie.split("\n").find((l) => l.startsWith(MARQUEUR_RESULTAT));
        if (erreur || ligne === undefined) {
          reject(
            new Error(
              `étape du banc en échec (${entree.etape}) :\n${erreurs.slice(-4000)}\n${sortie.slice(-2000)}`,
            ),
          );
          return;
        }
        resolve(JSON.parse(ligne.slice(MARQUEUR_RESULTAT.length)) as ResultatEtape<T>);
      },
    );
  });
}
