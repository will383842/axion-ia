/**
 * Formateurs indépendants — PRÉSENTATION DE LA MÉTHODE PAYÉE (lot L12i, E12c,
 * décision 20), règle pure.
 *
 * Une demi-journée, 175 € HT (`PARAMETRES_ARGENT_FORMATEURS.presentationMethodeHtCents`),
 * TVA selon le régime de la fiche, échéance = date de la présentation + 30 jours.
 * Le calcul vient de `argent/calcul-mission.ts` (`presentationMethode`), seule
 * source : ce module ne fait que dire OUI ou NON, et pourquoi.
 *
 * Refus, dans cet ordre :
 *   - la date n'est pas un jour civil lisible ;
 *   - la fiche n'est pas un formateur indépendant (salarié, dirigeant) ;
 *   - c'est l'intervenant d'un organisme : l'organisme facture, pas lui ;
 *   - la fiche n'a pas de régime de TVA (la machine ne le devine pas) ;
 *   - aucun contrat-cadre intégralement signé ;
 *   - la présentation est datée avant la signature du contrat, ou dans le futur ;
 *   - une présentation payée existe déjà (une seule par formateur).
 */

import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";

import { presentationMethode } from "../argent/calcul-mission";
import { estJourCivil, type JourCivil } from "../argent/dates";

export type MotifRefusPresentation =
  | "date_invalide"
  | "pas_independant"
  | "intervenant_d_organisme"
  | "regime_tva_inconnu"
  | "contrat_non_signe"
  | "date_avant_contrat"
  | "date_future"
  | "deja_payee";

export const LIBELLE_REFUS_PRESENTATION: Record<MotifRefusPresentation, string> = {
  date_invalide: "La date de la présentation est illisible.",
  pas_independant: "Seul un formateur indépendant est payé pour la présentation de la méthode.",
  intervenant_d_organisme:
    "Ce formateur intervient pour un organisme : c'est l'organisme qui facture.",
  regime_tva_inconnu: "Le régime de TVA de la fiche n'est pas renseigné.",
  contrat_non_signe: "Le contrat-cadre n'est pas intégralement signé.",
  date_avant_contrat: "La présentation est datée avant la signature du contrat-cadre.",
  date_future: "La présentation n'a pas encore eu lieu.",
  deja_payee: "Une présentation de la méthode est déjà payée pour ce formateur.",
};

export interface FaitsPresentation {
  readonly statut: "salarie" | "sous_traitant" | "dirigeant";
  readonly organismeSousTraitantId: string | null;
  readonly regimeTva: TvaRegimeHonoraires | null;
  /** Jour civil (Paris) de la dernière signature du contrat-cadre, ou `null`. */
  readonly contratSigneLe: JourCivil | null;
  /** Jour de la présentation, tel que saisi (« Présentation faite le … »). */
  readonly jour: string;
  /** Jour civil (Paris) du geste. */
  readonly aujourdhui: JourCivil;
  /** Une ligne `presentation_methode` non annulée existe déjà pour la fiche. */
  readonly dejaPayee: boolean;
}

export type VerdictPresentation =
  | {
      readonly ok: true;
      readonly regimeTva: TvaRegimeHonoraires;
      readonly mois: { readonly year: number; readonly month: number };
      readonly calcul: ReturnType<typeof presentationMethode>;
    }
  | { readonly ok: false; readonly motif: MotifRefusPresentation };

export function verdictPresentationMethode(f: FaitsPresentation): VerdictPresentation {
  const refus = (motif: MotifRefusPresentation): VerdictPresentation => ({ ok: false, motif });
  if (!estJourCivil(f.jour)) return refus("date_invalide");
  if (f.statut !== "sous_traitant") return refus("pas_independant");
  if (f.organismeSousTraitantId !== null) return refus("intervenant_d_organisme");
  if (f.regimeTva === null) return refus("regime_tva_inconnu");
  if (f.contratSigneLe === null) return refus("contrat_non_signe");
  if (f.jour < f.contratSigneLe) return refus("date_avant_contrat");
  if (f.jour > f.aujourdhui) return refus("date_future");
  if (f.dejaPayee) return refus("deja_payee");
  const [year, month] = f.jour.split("-").map(Number) as [number, number];
  return {
    ok: true,
    regimeTva: f.regimeTva,
    mois: { year, month },
    calcul: presentationMethode(f.jour, f.regimeTva),
  };
}
