/**
 * Qualiopi — le montant RÉELLEMENT pris en charge par le financeur.
 *
 * ## 🔴 Le défaut fermé ici, trouvé le 16/08 par la vérification de bout en bout
 *
 * `TrainingSession.priseEnChargeMontantCents` **n'est pas un montant total.
 * C'est un TARIF**, dont le sens dépend entièrement d'un second champ,
 * `priseEnChargeUnite` : euros **par heure**, par jour, par formation, ou par
 * salarié et par an. Le formulaire de saisie le dit (« 40 € », unité « €/h »),
 * et `computeVentilationDossier` le calcule correctement pour la facture.
 *
 * Trois consommateurs l'additionnaient pourtant comme un total, sans jamais
 * lire l'unité :
 *
 * | Où | Ce que ça produisait |
 * |---|---|
 * | **convention tripartite** | « Prise en charge OPCO : 40,00 € » et un reste à charge faux du même écart — sur la pièce que lit le financeur et que **trois parties signent** |
 * | créances `DossierPayeur` | une ventilation fausse du même facteur |
 * | assiette de l'acompte (contrat particulier) | un acompte calculé sur une base fausse |
 *
 * Ordre de grandeur : un OPCO à **40 €/h** sur 14 h pour 8 participants prend en
 * charge **4 480 €**. La convention imprimait **40,00 €**. Ce n'est pas une
 * approximation, c'est un facteur 112.
 *
 * ## La règle
 *
 * > **`priseEnChargeMontantCents` ne se lit JAMAIS seul.** Il ne veut rien dire
 * > sans son unité, sa durée et son effectif.
 *
 * Ce module est le seul endroit qui répond à « combien le financeur prend-il
 * réellement en charge ». Il délègue le calcul à `computeVentilationDossier` —
 * la fonction qui le faisait déjà juste — plutôt que d'en écrire une seconde :
 * deux formules pour la même question finiraient par diverger, et c'est
 * exactement la divergence qu'on referme.
 *
 * Aucun import Prisma ni Next : mêmes entrées, mêmes sorties.
 */

import { computeVentilationDossier } from "./opco-calcul";
import type { PriseEnChargeUnite } from "../../../../prisma/generated/client";

/** Ce dont le calcul a besoin — tout vient de la session. */
export interface BasePriseEnCharge {
  /** Le TARIF saisi, en centimes. Sans unité, il ne veut rien dire. */
  priseEnChargeMontantCents: number | null;
  priseEnChargeUnite: PriseEnChargeUnite | null;
  priseEnChargePlafondFormationCents?: number | null;
  priseEnChargePlafondAnnuelCents?: number | null;
  /** Durée de l'action, en heures — indispensable pour `euro_heure`/`euro_jour`. */
  dureeHeures: number | null;
  /** Effectif : le tarif est TOUJOURS par participant, quelle que soit l'unité. */
  nbParticipants: number | null;
}

/**
 * Montant total pris en charge par le financeur, en centimes.
 *
 * Rend `null` quand le calcul n'est **pas établi** — et c'est le point le plus
 * important de ce module. Trois cas :
 *
 * 1. aucun tarif saisi ;
 * 2. 🔴 **un tarif sans unité** : on ne peut pas deviner s'il s'agit de 40 € ou
 *    de 40 €/h. Retomber sur « c'est un total » est précisément le défaut
 *    d'origine — c'est ce qu'il ne faut plus faire ;
 * 3. une unité qui exige la durée (`euro_heure`, `euro_jour`) sans durée connue.
 *
 * ⚠️ L'appelant doit traiter `null` comme « montant non établi » et le DIRE,
 * jamais comme zéro. Un zéro affiché se lit comme « le financeur ne prend rien
 * en charge », ce qui est une affirmation — et une affirmation fausse.
 */
export function montantPrisEnChargeCents(base: BasePriseEnCharge): number | null {
  const tarif = base.priseEnChargeMontantCents;
  if (tarif == null || tarif <= 0) return null;

  const unite = base.priseEnChargeUnite;
  if (unite == null) return null;

  // Le nombre de participants borne tout : le tarif est par participant dans
  // les quatre unités. Sans effectif, aucun total n'est calculable.
  const nbParticipants = base.nbParticipants ?? 0;
  if (nbParticipants <= 0) return null;

  const exigeDuree = unite === "euro_heure" || unite === "euro_jour";
  const dureeHeures = base.dureeHeures ?? 0;
  if (exigeDuree && dureeHeures <= 0) return null;

  const { totalHtCents } = computeVentilationDossier({
    unite,
    montantCents: tarif,
    dureeHeures,
    nbParticipants,
    ...(base.priseEnChargePlafondFormationCents != null
      ? { plafondFormationCents: base.priseEnChargePlafondFormationCents }
      : {}),
    ...(base.priseEnChargePlafondAnnuelCents != null
      ? { plafondAnnuelCents: base.priseEnChargePlafondAnnuelCents }
      : {}),
  });

  return totalHtCents;
}

/**
 * Reste à charge du client, en centimes, borné à `[0, prix]`.
 *
 * Rend `null` si la prise en charge n'est pas établie : un reste à charge
 * calculé sur un montant inconnu serait faux, et sur une pièce contractuelle un
 * chiffre faux vaut moins que pas de chiffre du tout.
 *
 * 🔴 Borné à zéro : une prise en charge annoncée supérieure au prix ne doit pas
 * produire un reste à charge NÉGATIF, qui se lirait comme un avoir dû au client.
 */
export function resteAChargeCents(base: BasePriseEnCharge, prixHtCents: number): number | null {
  const priseEnCharge = montantPrisEnChargeCents(base);
  if (priseEnCharge === null) return null;
  return Math.max(0, prixHtCents - Math.min(priseEnCharge, prixHtCents));
}
