// Banc @formateurs — le REGISTRE DES ENTREPRISES simulé.
//
// `recherche-entreprises.api.gouv.fr` est appelé par deux modules du dépôt,
// qui acceptent TOUS LES DEUX un `fetch` injecté — c'est le mécanisme de
// simulation existant, le banc n'en invente pas d'autre :
//   · `lireEntrepriseParSiren` / `lireEtablissementParSiret`
//     (`src/features/apporteurs-reseau/annuaire.ts`, option `fetch`) ;
//   · `rechercherSiren` (`src/features/dossier-client/recherche-entreprises.ts`,
//     option `fetch`).
// Ce module rend ce `fetch`, réglé sur l'une des cinq réponses du registre.
//
// Les cinq réponses, et ce que chacune doit produire chez l'appelant :
//   vert   — entreprise active, française, diffusion complète ;
//   orange — entreprise active, diffusion PARTIELLE (non-diffusible) : un
//            humain doit compléter et vérifier ;
//   rouge  — entreprise CESSÉE (`etat_administratif: "C"`) ;
//   muet   — le registre ne répond jamais : seul le délai de l'appelant
//            (son `AbortSignal`) le sort de l'attente ;
//   429    — quota dépassé à chaque essai (`Retry-After: 1`).
//
// SIREN fictif, valide au sens de Luhn ; dénomination inventée.

export type ReponseRegistre = "vert" | "orange" | "rouge" | "muet" | "429";

/** SIREN du banc : 9 chiffres, clé de Luhn juste, aucune entreprise réelle visée. */
export const SIREN_BANC = "987654324";
/** SIRET du siège (NIC 00019, clé de Luhn juste). */
export const SIRET_BANC = "98765432400019";
export const DENOMINATION_BANC = "ATELIER BANC-ESSAI FORMATION";

type Fetch = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface RegistreSimule {
  readonly fetch: Fetch;
  /** Les adresses demandées, dans l'ordre — un 429 en montre trois. */
  readonly appels: string[];
}

function ligne(reponse: "vert" | "orange" | "rouge"): Record<string, unknown> {
  const masque = reponse === "orange";
  return {
    siren: SIREN_BANC,
    nom_complet: masque ? "[NON-DIFFUSIBLE]" : DENOMINATION_BANC,
    nom_raison_sociale: masque ? null : DENOMINATION_BANC,
    etat_administratif: reponse === "rouge" ? "C" : "A",
    nature_juridique: "5710",
    activite_principale: "85.59A",
    complements: { est_entrepreneur_individuel: false },
    siege: {
      siret: SIRET_BANC,
      adresse: masque ? "[NON-DIFFUSIBLE]" : "1 RUE DU BANC D'ESSAI 69000 LYON",
      libelle_commune: "LYON",
      code_postal: "69000",
      activite_principale: "85.59A",
      etat_administratif: reponse === "rouge" ? "F" : "A",
    },
    matching_etablissements: [],
  };
}

export function registreSimule(reponse: ReponseRegistre): RegistreSimule {
  const appels: string[] = [];
  const fetch: Fetch = (entree, init) => {
    appels.push(
      typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url,
    );
    if (reponse === "muet") {
      // Ne répond jamais. Seul l'abandon de l'appelant termine l'attente — et
      // c'est exactement ce que le scénario vérifie.
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) reject(signal.reason);
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    if (reponse === "429") {
      return Promise.resolve(
        new Response(JSON.stringify({ erreur: "trop de requêtes" }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "1" },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ results: [ligne(reponse)], total_results: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  return { fetch, appels };
}
