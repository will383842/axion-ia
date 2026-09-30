/**
 * UNE PASSE de rédaction (P1 à P6, lecture des réponses, e-mail de suivi)
 * par l'API Responses (ADR 0055 ; LOTS-EXECUTION §1.3).
 *
 *   · plafond vérifié AVANT, dépense écrite APRÈS (même pour une sortie
 *     refusée : on a été facturé) ;
 *   · `store: false`, aucun outil, jamais de `temperature` (`client.ts`) ;
 *   · `instructions` = bloc commun + consigne de la passe, identiques d'un
 *     appel à l'autre pour profiter du cache d'OpenAI ; les DONNÉES vont dans
 *     `input` — et ne sont JAMAIS stockées ni journalisées : ni en base, ni
 *     dans une erreur, ni dans `job.data`
 *     (`l-entree-d-une-passe-n-est-jamais-stockee-ni-journalisee.spec.ts`) ;
 *   · G13 — SORTIE REFUSÉE OU TRONQUÉE : `status !== "completed"`,
 *     `incomplete_details.reason === "max_output_tokens"`, un `refusal`, ou
 *     une sortie que Zod refuse ⇒ `ErreurVisio` de classe `contenu` (un
 *     nouvel essai, puis échec définitif et note manuelle proposée). JAMAIS
 *     de repli vers un autre modèle.
 */

import type { ZodType } from "zod";

import {
  EFFORT_PAR_PASSE,
  ESTIMATION_PASSE_USD,
  MAX_SORTIE_PAR_PASSE,
  MODELE_REDACTION,
  type PasseIA,
} from "./modeles";
import { formatDeSortie, type ClientOpenAIVisio } from "./client";
import { apresAppel, appelAnnuleEnVol, avantAppel, type PortCout } from "./cout";
import { AppelInterrompu, classerErreurOpenAI, ErreurVisio } from "./erreurs";

export interface DepsPasse {
  readonly client: ClientOpenAIVisio;
  readonly cout: PortCout;
}

export interface DemandePasse<T> {
  readonly passe: PasseIA;
  readonly schema: ZodType<T>;
  /** Nom du format (ex. `extraction_v1`). */
  readonly nomSchema: string;
  readonly instructions: string;
  readonly entree: string;
  readonly jobId: string;
}

export interface ResultatPasse<T> {
  readonly sortie: T;
  /** Le modèle RÉELLEMENT servi (écrit dans `CompteRendu.modele`). */
  readonly modele: string;
}

/** Exécute une passe. Lève une `ErreurVisio` classée. */
export async function executerPasse<T>(
  deps: DepsPasse,
  d: DemandePasse<T>,
): Promise<ResultatPasse<T>> {
  await avantAppel(deps.cout, ESTIMATION_PASSE_USD[d.passe]);
  let r;
  try {
    r = await deps.client.repondre({
      modele: MODELE_REDACTION,
      instructions: d.instructions,
      entree: d.entree,
      format: formatDeSortie(d.schema, d.nomSchema),
      effort: EFFORT_PAR_PASSE[d.passe],
      maxSortie: MAX_SORTIE_PAR_PASSE[d.passe],
    });
  } catch (err) {
    if (err instanceof AppelInterrompu) {
      if (err.envoye) {
        try {
          await appelAnnuleEnVol(deps.cout, {
            jobId: d.jobId,
            modele: MODELE_REDACTION,
            estimationUsd: ESTIMATION_PASSE_USD[d.passe],
          });
        } catch (echec) {
          // Registre injoignable pendant l'arrêt : l'appel reste INTERROMPU
          // (relâché sans essai), jamais reclassé en erreur passagère.
          throw new AppelInterrompu(true, echec);
        }
      }
      throw err;
    }
    throw classerErreurOpenAI(err);
  }
  await apresAppel(deps.cout, {
    jobId: d.jobId,
    modele: r.modele || MODELE_REDACTION,
    usage: {
      jetonsEntree: r.jetonsEntree,
      jetonsEntreeEnCache: r.jetonsEntreeEnCache,
      jetonsSortie: r.jetonsSortie,
      secondesAudio: null,
    },
  });

  if (r.refus !== null) {
    throw new ErreurVisio("contenu", "refus_modele", `passe ${d.passe} : refus du modèle`);
  }
  if (r.statut !== "completed" || r.raisonIncomplete !== null) {
    throw new ErreurVisio(
      "contenu",
      "sortie_tronquee",
      `passe ${d.passe} : sortie incomplète (${r.raisonIncomplete ?? r.statut})`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(r.texte ?? "");
  } catch {
    throw new ErreurVisio("contenu", "sortie_invalide", `passe ${d.passe} : JSON illisible`);
  }
  const lu = d.schema.safeParse(json);
  if (!lu.success) {
    throw new ErreurVisio("contenu", "sortie_invalide", `passe ${d.passe} : sortie hors schéma`);
  }
  return { sortie: lu.data, modele: r.modele || MODELE_REDACTION };
}
