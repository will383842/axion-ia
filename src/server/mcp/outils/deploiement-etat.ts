/**
 * `axionia.deploiement.etat` — « est-ce que ma dernière modification est en ligne ? »
 *
 * Décision W-9, défaut appliqué : **GitHub seul**. La couche service
 * (`src/server/deploiement/etat.ts`) lit le dernier run du workflow de
 * déploiement et le confronte au commit que le processus courant exécute.
 *
 * ⚠️ CET OUTIL NE LIT PAS `process.env` — le contrôle 2 du harnais l'interdit
 *    aux fichiers de l'adaptateur, et c'est justement pour ça que la lecture de
 *    `BUILD_SHA` et du jeton vit dans la couche service.
 *
 * ⚠️ `sourceIncomplete` est VRAI dès que le commit en service est inconnu : la
 *    réponse est alors amputée de la moitié qui compte, et le taire ferait
 *    passer « je n'ai pas pu vérifier » pour « tout va bien ».
 */

import { z } from "zod/v4";

import { ETATS, lireEtatDuDeploiement } from "@/server/deploiement/etat";

import { definirOutil } from "../contrat";
import { meta, schemaSortie } from "../sortie";

export const VERSION = "1.0.0";

/** Le SHA est rendu ABRÉGÉ : sept caractères suffisent à désigner, et se disent. */
const LONGUEUR_DU_SHA_COURT = 7;

const Item = z.strictObject({
  etat: z.enum(ETATS),
  resume: z.string(),
  /** Commit du dernier run, abrégé. */
  commit: z
    .string()
    .regex(/^[0-9a-f]{7}$/)
    .nullable(),
  /** Commit que le processus qui répond exécute, abrégé. */
  commitEnService: z
    .string()
    .regex(/^[0-9a-f]{7}$/)
    .nullable(),
  branche: z.string().nullable(),
  termineLe: z.iso.datetime().nullable(),
  /** Rang 2. */
  titreDuCommit: z.string().nullable().optional(),
  /** Rang 2. */
  dureeSecondes: z.number().int().min(0).nullable().optional(),
  /** Rang 2 — retrouver le journal du run dans GitHub. */
  numeroDeRun: z.number().int().min(0).nullable().optional(),
});

function abreger(sha: string | null): string | null {
  if (sha === null) return null;
  const court = sha.slice(0, LONGUEUR_DU_SHA_COURT).toLowerCase();
  return /^[0-9a-f]{7}$/.test(court) ? court : null;
}

export const deploiementEtat = definirOutil({
  name: "deploiement.etat",
  version: VERSION,
  description:
    "L'état du dernier déploiement du site : réussi, en cours ou en échec, et si " +
    "le commit déployé est bien celui qui est servi en ce moment.",
  effect: "read",
  // Un numéro de run et un SHA ne désignent personne : c'est de l'interne, pas
  // de la donnée personnelle. Le déclarer « personal » banaliserait le marquage
  // de session que le socle applique aux lectures qui, elles, en portent.
  dataClass: "internal",
  idempotency: "n/a",
  pagination: "none",
  input: z.strictObject({}),
  output: schemaSortie(Item),
  maxBytes: 2_048,
  compaction: {
    free: ["resume", "titreDuCommit"],
    tier2: ["titreDuCommit", "dureeSecondes", "numeroDeRun"],
    aggregateBy: null,
  },
  idFields: ["commit", "commitEnService"],
  governanceFields: [],
  fixtureMax: "fixtures/deploiement-etat.max.json",
  async handler() {
    const etat = await lireEtatDuDeploiement();
    const inconnu = etat.commitEnService === null;

    return {
      items: [
        {
          etat: etat.etat,
          resume: etat.resume,
          commit: abreger(etat.commit),
          commitEnService: abreger(etat.commitEnService),
          branche: etat.branche,
          termineLe: etat.termineLe,
          titreDuCommit: etat.titreDuCommit,
          dureeSecondes: etat.dureeSecondes,
          numeroDeRun: etat.numeroDeRun,
        },
      ],
      meta: meta({
        returned: 1,
        version: VERSION,
        asOf: new Date(),
        sourceIncomplete: inconnu,
        sourceNote: inconnu
          ? "le commit en service est inconnu de ce processus : la concordance entre ce qui " +
            "a été déployé et ce qui est servi n'a PAS été vérifiée."
          : null,
        failedSources:
          etat.etat === "indisponible" || etat.etat === "non-configure" ? ["github"] : [],
      }),
    };
  },
});
