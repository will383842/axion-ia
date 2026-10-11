/**
 * Formateurs indépendants — CONTRÔLE D'UNE FACTURE DÉPOSÉE (lot L12k), pur.
 *
 * Pour le stock sans mandat d'autofacturation, un mandat révoqué et les
 * organismes : le formateur (ou l'organisme) dépose SA facture. Avant de la
 * rapprocher du relevé (`facture_recue`), on vérifie :
 *   - un numéro présent, comparé sans casse ni espaces (l'index unique
 *     `trainer_statements_facture_emetteur_unique` refuse la même facture deux fois) ;
 *   - un montant TTC ÉGAL au dû (sinon : « facture non conforme », comme le
 *     paiement existant) ;
 *   - une date de facture ni future, ni antérieure à la dernière journée facturée.
 * L'échéance ne bouge pas : dernière journée + 30 jours, jamais facture + 30.
 * Le contrôle antivirus et le format du fichier passent par le dépôt de pièces
 * commun (hors de ce module).
 */

import type { JourCivil } from "../argent/dates";

export type RefusFacture =
  | "numero_absent"
  | "numero_trop_long"
  | "montant_non_conforme"
  | "date_future"
  | "date_avant_la_mission";

export const LIBELLE_REFUS_FACTURE: Record<RefusFacture, string> = {
  numero_absent: "Le numéro de la facture est requis.",
  numero_trop_long: "Le numéro de la facture dépasse 60 caractères.",
  montant_non_conforme: "Le montant TTC de la facture ne correspond pas au montant dû.",
  date_future: "La date de la facture ne peut pas être dans le futur.",
  date_avant_la_mission: "La facture est datée d'avant la dernière journée facturée.",
};

/** Le numéro tel que l'index unique le compare. */
export function numeroFactureNormalise(numero: string): string {
  return numero.trim().toUpperCase();
}

export function controlerFactureDeposee(
  f: { readonly numero: string; readonly montantTtcCents: number; readonly dateFacture: JourCivil },
  r: {
    readonly totalTtcCents: number;
    readonly derniereJournee: JourCivil;
    readonly aujourdhui: JourCivil;
  },
): {
  readonly conforme: boolean;
  readonly refus: ReadonlyArray<RefusFacture>;
  readonly numero: string;
} {
  const numero = numeroFactureNormalise(f.numero);
  const refus: RefusFacture[] = [];
  if (numero === "") refus.push("numero_absent");
  else if (numero.length > 60) refus.push("numero_trop_long");
  if (!Number.isInteger(f.montantTtcCents) || f.montantTtcCents !== r.totalTtcCents)
    refus.push("montant_non_conforme");
  if (f.dateFacture > r.aujourdhui) refus.push("date_future");
  else if (f.dateFacture < r.derniereJournee) refus.push("date_avant_la_mission");
  return { conforme: refus.length === 0, refus, numero };
}
