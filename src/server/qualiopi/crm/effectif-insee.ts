/**
 * Qualiopi — Effectif du client relevé à l'INSEE (lot OPCO A7d, manque n°3).
 *
 * `Client.effectif` gouverne les seuils OPCO (< 11 / 11-49 / 50 et plus) :
 * régime de paiement, tranche du barème, « hors fonds légaux ». Il n'était
 * alimenté que par saisie. Ce module le relève depuis la TRANCHE D'EFFECTIF
 * SALARIÉ de l'unité légale (Sirene), via l'annuaire public des entreprises
 * (`rechercherTrancheEffectif`), à deux moments seulement : la création de la
 * fiche et le bouton « Rafraîchir depuis l'INSEE ». Jamais au rendu d'une page,
 * jamais au niveau du module (contrat de build `stub.invalid`, ADR 0026).
 *
 * Règles :
 *   · on écrit si l'effectif est VIDE, ou s'il vient déjà de l'INSEE ;
 *   · une SAISIE (`effectifSource = saisie`) n'est JAMAIS écrasée — ni un
 *     effectif historique sans source, présumé saisi ;
 *   · annuaire en panne, SIREN inconnu, tranche absente : rien d'écrit, aucune
 *     exception — la création de la fiche ne dépend pas de l'annuaire.
 *
 * ── Pourquoi la BORNE BASSE de la tranche ────────────────────────────────────
 * L'INSEE ne publie pas l'effectif, seulement une tranche. On retient la borne
 * basse, et ce choix est sûr pour les seuils qui comptent :
 *   · seuil de 50 (fonds légaux, art. L6332-17 C. trav.) : les tranches ne le
 *     chevauchent pas. « 20 à 49 » → 20, sous 50 : correct, même pour une
 *     entreprise de 49 salariés. « 50 à 99 » → 50, au moins 50 : correct.
 *   · seuil de 11 : « 10 à 19 » → 10 range sous 11 une entreprise de 11 à 19
 *     salariés. C'est la seule tranche à cheval sur un seuil OPCO ; la borne
 *     basse y penche vers le régime le PLUS favorable au client (moins de 11).
 *     Une saisie corrige, et n'est ensuite plus jamais écrasée.
 *
 * ── Table de correspondance (FERMÉE) ─────────────────────────────────────────
 * Source officielle : INSEE, répertoire Sirene, variable « tranche d'effectif
 * salarié » (`trancheEffectifsUniteLegale`), nomenclature publiée sur
 * https://www.sirene.fr/sirene/public/variable/tefen (relevé le 2026-10-04).
 * Un code absent de la table n'est pas deviné : rien n'est écrit.
 */

import { rechercherTrancheEffectif } from "@/features/dossier-client/recherche-entreprises";
import { sirenDuClient } from "@/lib/siret";
import { parisDateISO } from "@/server/qualiopi/presence/time";

/** Code INSEE → borne basse de la tranche et libellé officiel. */
export const TRANCHES_EFFECTIF_INSEE: Readonly<
  Record<string, { readonly borneBasse: number; readonly libelle: string }>
> = {
  // « Unité non employeuse » : aucun salarié sur l'année de référence.
  NN: { borneBasse: 0, libelle: "Unité non employeuse" },
  "00": { borneBasse: 0, libelle: "0 salarié" },
  "01": { borneBasse: 1, libelle: "1 ou 2 salariés" },
  "02": { borneBasse: 3, libelle: "3 à 5 salariés" },
  "03": { borneBasse: 6, libelle: "6 à 9 salariés" },
  "11": { borneBasse: 10, libelle: "10 à 19 salariés" },
  "12": { borneBasse: 20, libelle: "20 à 49 salariés" },
  "21": { borneBasse: 50, libelle: "50 à 99 salariés" },
  "22": { borneBasse: 100, libelle: "100 à 199 salariés" },
  "31": { borneBasse: 200, libelle: "200 à 249 salariés" },
  "32": { borneBasse: 250, libelle: "250 à 499 salariés" },
  "41": { borneBasse: 500, libelle: "500 à 999 salariés" },
  "42": { borneBasse: 1000, libelle: "1 000 à 1 999 salariés" },
  "51": { borneBasse: 2000, libelle: "2 000 à 4 999 salariés" },
  "52": { borneBasse: 5000, libelle: "5 000 à 9 999 salariés" },
  "53": { borneBasse: 10000, libelle: "10 000 salariés et plus" },
};

/** Borne basse d'un code de tranche INSEE ; `null` pour un code hors table. */
export function borneBasseTranche(code: string | null | undefined): number | null {
  if (code == null) return null;
  const tranche = TRANCHES_EFFECTIF_INSEE[code.trim()];
  return tranche === undefined ? null : tranche.borneBasse;
}

export interface EffectifActuel {
  effectif: number | null;
  effectifSource: "saisie" | "insee" | null;
}

/** Ce que l'on écrit quand le relevé INSEE est admis. */
export interface EcritureEffectifInsee {
  effectif: number;
  effectifSource: "insee";
  effectifReleveLe: Date;
}

/** L'effectif en base peut-il recevoir un relevé INSEE ? Vide, ou déjà de l'INSEE. */
export function effectifOuvertAuReleveInsee(actuel: EffectifActuel): boolean {
  return actuel.effectif === null || actuel.effectifSource === "insee";
}

/**
 * Décision PURE : l'écriture à faire, ou `null` si la saisie prime. Le relevé
 * est daté du jour civil de Paris (colonne `@db.Date`, donc minuit UTC).
 */
export function effectifInseeAEcrire(
  actuel: EffectifActuel,
  borneBasse: number,
  maintenant: Date,
): EcritureEffectifInsee | null {
  if (!effectifOuvertAuReleveInsee(actuel)) return null;
  return {
    effectif: borneBasse,
    effectifSource: "insee",
    effectifReleveLe: new Date(`${parisDateISO(maintenant)}T00:00:00.000Z`),
  };
}

export type ResultatReleveEffectif =
  | { readonly statut: "pose"; readonly effectif: number; readonly tranche: string }
  | { readonly statut: "saisie_conservee" }
  | { readonly statut: "sans_siren" }
  | { readonly statut: "indisponible" }
  | { readonly statut: "tranche_inconnue" };

/** Le strict nécessaire du client Prisma (injectable en test). */
export interface BaseEffectif {
  client: {
    findUnique(args: {
      where: { id: string };
      select: { siren: true; siret: true; type: true; effectif: true; effectifSource: true };
    }): Promise<{
      siren: string | null;
      /** Lot A9 : une fiche qui n'a que son SIRET est relevée sur son SIREN. */
      siret?: string | null;
      type: string;
      effectif: number | null;
      effectifSource: "saisie" | "insee" | null;
    } | null>;
    updateMany(args: {
      where: {
        id: string;
        OR: [{ effectif: null }, { effectifSource: "insee" }];
      };
      data: { effectif: number; effectifSource: "insee"; effectifReleveLe: Date };
    }): Promise<{ count: number }>;
  };
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/**
 * Relève la tranche INSEE de la fiche et écrit sa borne basse si la saisie ne
 * prime pas. Ne lève pas sur une panne de l'annuaire (délai de 3 s, porté par
 * `rechercherTrancheEffectif`).
 *
 * 🔴 La garde « vide ou INSEE » est vérifiée DEUX fois : avant l'appel (pour ne
 * pas interroger l'État pour rien) et DANS l'écriture (`updateMany` filtré) —
 * une saisie posée pendant les 3 s de l'appel n'est pas écrasée.
 *
 * L'écriture ne touche que les trois champs d'effectif : aucun n'est transmis
 * à Axion Partners (`client.mis_a_jour`), il n'y a donc pas de fait à émettre.
 */
export async function rafraichirEffectifInsee(
  db: BaseEffectif,
  clientId: string,
  options: { readonly fetch?: Fetch; readonly maintenant?: Date } = {},
): Promise<ResultatReleveEffectif> {
  const fiche = await db.client.findUnique({
    where: { id: clientId },
    select: { siren: true, siret: true, type: true, effectif: true, effectifSource: true },
  });
  // Lot A9 : le SIREN se lit aussi dans le SIRET (règle unique `sirenDuClient`).
  const siren = fiche === null ? null : sirenDuClient(fiche);
  if (fiche === null || fiche.type === "particulier" || siren === null) {
    return { statut: "sans_siren" };
  }
  if (!effectifOuvertAuReleveInsee(fiche)) return { statut: "saisie_conservee" };

  const releve = await rechercherTrancheEffectif(siren, {
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
  });
  if (!releve.ok) return { statut: "indisponible" };
  const tranche = releve.tranche;
  if (tranche === null) return { statut: "tranche_inconnue" };
  const borneBasse = borneBasseTranche(tranche);
  if (borneBasse === null) return { statut: "tranche_inconnue" };

  const ecriture = effectifInseeAEcrire(fiche, borneBasse, options.maintenant ?? new Date());
  if (ecriture === null) return { statut: "saisie_conservee" };
  const r = await db.client.updateMany({
    where: { id: clientId, OR: [{ effectif: null }, { effectifSource: "insee" }] },
    data: {
      effectif: ecriture.effectif,
      effectifSource: "insee",
      effectifReleveLe: ecriture.effectifReleveLe,
    },
  });
  if (r.count === 0) return { statut: "saisie_conservee" };
  return { statut: "pose", effectif: ecriture.effectif, tranche };
}
