/**
 * SIREN PROPOSÉ par l'annuaire public des entreprises (chantier visio, plan
 * §3.17 point 4, PA-10).
 *
 * `recherche-entreprises.api.gouv.fr` : service de l'État, gratuit, sans clé
 * (réponse 200 sans authentification, mesuré le 28/09). On cherche avec le nom
 * et la ville de l'entreprise, et on PROPOSE : Will confirme d'un clic. Rien
 * n'est jamais écrit en silence.
 *
 * Règles :
 *   · délai de 3 s : au-delà, on rend « annuaire indisponible » et la fiche se
 *     crée sans SIREN (badge « SIREN à compléter ») — l'annuaire n'est JAMAIS
 *     sur le chemin de la création (test
 *     `la-fiche-se-cree-meme-si-l-annuaire-est-en-panne.spec.ts`) ;
 *   · cache de 24 h par (nom, ville) : une saisie répétée n'interroge pas
 *     l'État à chaque frappe ;
 *   · aucun référentiel local, aucune copie de l'annuaire.
 *
 * Module serveur neutre : `fetch` seulement, injectable pour les tests.
 */

import { checkSirenFormat } from "@/lib/siret";
/**
 * Clé de cache et comparaison de ville : minuscules, sans accents ni
 * ponctuation. Volontairement locale et simple (pas l'import de la
 * normalisation du CRM) : ce module ne décide d'aucun rapprochement de fiches,
 * il ne fait que proposer, et il reste hors du domaine Qualiopi.
 */
function normaliserTexte(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const normaliserNom = normaliserTexte;
const normaliserVille = normaliserTexte;

export const URL_ANNUAIRE = "https://recherche-entreprises.api.gouv.fr/search";
export const DELAI_ANNUAIRE_MS = 3_000;
export const DUREE_CACHE_ANNUAIRE_MS = 24 * 60 * 60 * 1000;
/** Nombre de propositions montrées à Will. */
export const PROPOSITIONS_MAX = 5;

export interface PropositionSiren {
  readonly siren: string;
  readonly nom: string;
  readonly ville: string | null;
  readonly codePostal: string | null;
}

export type ResultatAnnuaire =
  | { readonly ok: true; readonly propositions: ReadonlyArray<PropositionSiren> }
  | { readonly ok: false; readonly motif: "indisponible" | "saisie_insuffisante" };

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

const cache = new Map<string, { le: number; resultat: ResultatAnnuaire }>();

/** Vide le cache (tests). */
export function viderCacheAnnuaire(): void {
  cache.clear();
}

interface LigneAnnuaire {
  siren?: unknown;
  nom_complet?: unknown;
  nom_raison_sociale?: unknown;
  siege?: { libelle_commune?: unknown; code_postal?: unknown } | null;
}

function lireLigne(l: LigneAnnuaire): PropositionSiren | null {
  const siren = typeof l.siren === "string" ? l.siren : "";
  if (!checkSirenFormat(siren).ok) return null;
  const nom =
    typeof l.nom_complet === "string"
      ? l.nom_complet
      : typeof l.nom_raison_sociale === "string"
        ? l.nom_raison_sociale
        : "";
  const ville = typeof l.siege?.libelle_commune === "string" ? l.siege.libelle_commune : null;
  const cp = typeof l.siege?.code_postal === "string" ? l.siege.code_postal : null;
  return { siren, nom, ville, codePostal: cp };
}

/**
 * Cherche des SIREN pour un nom d'entreprise (et sa ville si on la connaît).
 * Ne lève JAMAIS : une panne rend `{ ok: false, motif: "indisponible" }`.
 */
export async function rechercherSiren(
  nom: string,
  ville: string | null,
  options: { readonly fetch?: Fetch; readonly maintenant?: number } = {},
): Promise<ResultatAnnuaire> {
  const nomNormalise = normaliserNom(nom);
  if (nomNormalise.length < 2) return { ok: false, motif: "saisie_insuffisante" };
  const villeNormalisee = normaliserVille(ville);
  const cle = `${nomNormalise}|${villeNormalisee}`;
  const maintenant = options.maintenant ?? Date.now();
  const enCache = cache.get(cle);
  if (enCache !== undefined && maintenant - enCache.le < DUREE_CACHE_ANNUAIRE_MS) {
    return enCache.resultat;
  }

  const url = new URL(URL_ANNUAIRE);
  url.searchParams.set("q", ville ? `${nom} ${ville}` : nom);
  url.searchParams.set("per_page", "10");
  const f: Fetch = options.fetch ?? ((u, init) => fetch(u, init));
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_ANNUAIRE_MS);
  try {
    const reponse = await f(url.toString(), { signal: controleur.signal });
    if (!reponse.ok) return { ok: false, motif: "indisponible" };
    const corps = (await reponse.json()) as { results?: unknown };
    const lignes = Array.isArray(corps.results) ? (corps.results as LigneAnnuaire[]) : [];
    let propositions = lignes.map(lireLigne).filter((p): p is PropositionSiren => p !== null);
    // Ville connue : on garde d'abord les sièges de cette ville.
    if (villeNormalisee !== "") {
      const memeVille = propositions.filter((p) => normaliserVille(p.ville) === villeNormalisee);
      if (memeVille.length > 0) propositions = memeVille;
    }
    const resultat: ResultatAnnuaire = {
      ok: true,
      propositions: propositions.slice(0, PROPOSITIONS_MAX),
    };
    cache.set(cle, { le: maintenant, resultat });
    return resultat;
  } catch {
    // Délai dépassé, réseau coupé, réponse illisible : la saisie à la main reste possible.
    return { ok: false, motif: "indisponible" };
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * Lot OPCO A7d — code de TRANCHE D'EFFECTIF SALARIÉ de l'unité légale d'un
 * SIREN, tel que l'annuaire le reprend de Sirene (`tranche_effectif_salarie`,
 * ex. « 11 »). La traduction du code en effectif est une règle Qualiopi : elle
 * vit dans `src/server/qualiopi/crm/effectif-insee.ts`, pas ici.
 *
 * Mêmes règles que `rechercherSiren` : délai de 3 s, ne lève JAMAIS. Pas de
 * cache : l'appel n'a lieu que sur un geste (création de la fiche, bouton
 * « Rafraîchir depuis l'INSEE »), jamais à l'affichage.
 *
 * `{ ok: false }` : annuaire en panne, délai dépassé, SIREN invalide.
 * `{ ok: true, tranche: null }` : l'annuaire a répondu, mais sans tranche pour
 * ce SIREN (introuvable, ou tranche non renseignée).
 */
export type ResultatTrancheEffectif =
  { readonly ok: true; readonly tranche: string | null } | { readonly ok: false };

export async function rechercherTrancheEffectif(
  siren: string,
  options: { readonly fetch?: Fetch } = {},
): Promise<ResultatTrancheEffectif> {
  if (!checkSirenFormat(siren).ok) return { ok: false };
  const url = new URL(URL_ANNUAIRE);
  url.searchParams.set("q", siren);
  url.searchParams.set("per_page", "1");
  const f: Fetch = options.fetch ?? ((u, init) => fetch(u, init));
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_ANNUAIRE_MS);
  try {
    const reponse = await f(url.toString(), { signal: controleur.signal });
    if (!reponse.ok) return { ok: false };
    const corps = (await reponse.json()) as { results?: unknown };
    const lignes = Array.isArray(corps.results)
      ? (corps.results as Array<{ siren?: unknown; tranche_effectif_salarie?: unknown }>)
      : [];
    // La recherche plein texte peut rendre une autre entreprise : on exige le même SIREN.
    const ligne = lignes.find((l) => l.siren === siren);
    const tranche = ligne?.tranche_effectif_salarie;
    return {
      ok: true,
      tranche: typeof tranche === "string" && tranche.trim() !== "" ? tranche.trim() : null,
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(minuterie);
  }
}
