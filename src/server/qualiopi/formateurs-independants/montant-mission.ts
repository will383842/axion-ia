/**
 * Formateurs indépendants — LE MONTANT HT D'UNE MISSION EN JEU, pour le seuil de
 * vigilance URSSAF (étape 3 du C4, décision de Will). Module PUR.
 *
 * Décision : le seuil compte la mission en cours. Quand une mission fait atteindre
 * 5 000 € HT au cumul, l'attestation est exigée AVANT la mission. Le montant est celui
 * que la lettre annoncera :
 *   - les journées du FORMATEUR (`journeesDuFormateur`, la règle du paiement et de la
 *     lettre, étape 4) — le formateur dont on décide la mission compte comme affecté ;
 *   - le calcul de la lettre (`honorairesLettre`) : tarif × journées, demi-journée à la
 *     moitié, forfait de déplacement par journée sur place.
 *
 * 🔴 DANS LE DOUTE, ON SUR-ESTIME (décision de Will) :
 *   - conditions figées (mission ou choix) : elles, exactement ;
 *   - rien de figé : le PLUS HAUT entre le tarif de la fiche et 350 € HT, et le forfait
 *     de déplacement AU PLAFOND du paiement (à distance : aucun) ;
 *   - tarif impair en centimes : arrondi au-dessus (la lettre le refuserait) ;
 *   - aucune journée déclarée : chaque jour calendaire de la période vaut une journée
 *     entière, forfait compris ;
 *   - ni journée ni période, ou une erreur : `null` — la garde lit « attestation exigée ».
 */

import { journeesDuFormateur } from "./argent/journees-du-formateur";
import { FORFAIT_MAX_HT_CENTS } from "./choix-formateur";
import { TARIF_JOURNEE_HT_CENTS, honorairesLettre } from "./lettre-mission-v2-calcul";

const JOUR_MS = 86_400_000;

export interface FaitsMontantMission {
  readonly trainerId: string;
  /** Les formateurs déjà affectés à la session (`SessionFormateur`). */
  readonly affectes: ReadonlyArray<{ readonly trainerId: string }>;
  readonly distanciel: boolean;
  readonly jours: ReadonlyArray<{
    readonly date: Date;
    readonly heureDebut: string;
    readonly heureFin: string;
    /** Formateur désigné de la journée, ou `null`. */
    readonly trainerId: string | null;
  }>;
  /** Tarif de la journée FIGÉ (mission ou choix), ou `null`. */
  readonly tarifFigeHtCents: number | null;
  /** Forfait figé avec ce tarif ; `null` avec un tarif figé = déplacement compris. */
  readonly forfaitFigeHtCents: number | null;
  /** Tarif de la fiche du formateur, ou `null`. */
  readonly tarifFicheHtCents: number | null;
  /** Période de la session, lue quand aucune journée n'est déclarée. */
  readonly repli: { readonly debut: Date; readonly fin: Date | null } | null;
}

function entierPositif(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/** Montant HT de la mission en jeu, en centimes ; `null` si illisible. */
export function montantMissionHtCents(f: FaitsMontantMission): number | null {
  try {
    const fige = entierPositif(f.tarifFigeHtCents);
    const tarifBrut = fige
      ? (f.tarifFigeHtCents as number)
      : Math.max(
          entierPositif(f.tarifFicheHtCents) ? f.tarifFicheHtCents : 0,
          TARIF_JOURNEE_HT_CENTS,
        );
    // Une demi-journée se paie à la moitié : un tarif impair est arrondi au-dessus.
    const tarif = tarifBrut % 2 === 0 ? tarifBrut : tarifBrut + 1;
    const forfait = f.distanciel
      ? 0
      : fige
        ? entierPositif(f.forfaitFigeHtCents)
          ? f.forfaitFigeHtCents
          : 0
        : FORFAIT_MAX_HT_CENTS;

    const affectes = f.affectes.some((a) => a.trainerId === f.trainerId)
      ? f.affectes
      : [...f.affectes, { trainerId: f.trainerId }];
    const siens = journeesDuFormateur(f.jours, f.trainerId, affectes);
    if (siens.length > 0) {
      return honorairesLettre({
        jours: siens.map((j) => ({
          date: j.date.toISOString().slice(0, 10),
          heureDebut: j.heureDebut,
          heureFin: j.heureFin,
        })),
        tarifJourneeHtCents: tarif,
        forfaitDeplacementParJourHtCents: forfait,
        joursDeplacement: forfait > 0 ? siens.length : 0,
      }).totalHtCents;
    }

    if (f.repli === null) return null;
    const debut = Date.UTC(
      f.repli.debut.getUTCFullYear(),
      f.repli.debut.getUTCMonth(),
      f.repli.debut.getUTCDate(),
    );
    const finDate = f.repli.fin ?? f.repli.debut;
    const fin = Date.UTC(finDate.getUTCFullYear(), finDate.getUTCMonth(), finDate.getUTCDate());
    if (!Number.isFinite(debut) || !Number.isFinite(fin)) return null;
    const jours = Math.max(1, Math.round((fin - debut) / JOUR_MS) + 1);
    return jours * (tarif + forfait);
  } catch {
    return null;
  }
}
