/**
 * « Facture établie hors console » (Tiime...) : Will coche la case et pose la date ; la fiche passe
 * de prospect à client (fiche client à 7 onglets, étape 4, 2026-10-26, décision de Will).
 *
 * PUR : les règles seulement. L'écriture est dans `actions-facture-hors-console.ts`.
 *   · le statut ne fait que MONTER : prospect et devis envoyé deviennent client actif ; un client
 *     actif ne bouge pas ; un client inactif ou perdu n'est JAMAIS rouvert tout seul (c'est un
 *     geste de Will, par « Éditer ») ;
 *   · la date ne peut pas être dans le futur (une facture n'est pas établie demain).
 */

import type { ClientStatut } from "../../../prisma/generated/client";

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Le statut après la case cochée ; `null` = inchangé. */
export function statutApresFactureHorsConsole(statut: ClientStatut): ClientStatut | null {
  return statut === "prospect" || statut === "devis_envoye" ? "client_actif" : null;
}

/**
 * Le jour saisi (AAAA-MM-JJ) validé contre « aujourd'hui » (AAAA-MM-JJ, heure de Paris) : rend le
 * jour tel quel, ou un motif lisible.
 */
export function validerJourFacture(
  saisie: string,
  aujourdhui: string,
): { readonly ok: true; readonly jour: string } | { readonly ok: false; readonly motif: string } {
  const m = JOUR.exec(saisie);
  if (m === null) return { ok: false, motif: "La date de la facture n'est pas valide." };
  const d = new Date(`${saisie}T00:00:00Z`);
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== annee ||
    d.getUTCMonth() + 1 !== mois ||
    d.getUTCDate() !== jour
  ) {
    return { ok: false, motif: "La date de la facture n'est pas valide." };
  }
  if (annee < 2000) return { ok: false, motif: "La date de la facture est trop ancienne." };
  if (saisie > aujourdhui) {
    return { ok: false, motif: "La date de la facture ne peut pas être dans le futur." };
  }
  return { ok: true, jour: saisie };
}
