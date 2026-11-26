// Réseau d'apporteurs — la commission d'une commande qui porte une JOURNÉE IA reconnue (annexe 1 du
// contrat 2.8, A1.1 ; art. 4.1 bis pour une commande mixte). Source unique du passage quotidien
// (`passage-quotidien.ts#etapeCommissions`) et du classement manuel (`commissions.ts`).
//
// ⚠️ Atteint par le WORKER (job horaire `reseau-facturation`, tsx hors Next) : aucun `server-only`.

import { ventilerJourneeIa } from "./commandes";
import {
  calculerCommission,
  commissionMixte,
  euros,
  palierMixte,
  type CalculCommission,
} from "./regles";

/**
 * Commission d'une commande dont la Journée IA est RECONNUE (annexe 1, A1.1, art. 4.1 bis) :
 *   · Journée IA seule : 500 € × journées au prorata de la base de la commande ;
 *   · MIXTE (autres lignes positives) : la Journée IA sur le HT de SES lignes, l'autre partie selon
 *     l'activité de la commande (A1.4 audit 30 %, A1.5 15 %, A1.3 coaching : rien), en UNE ligne de
 *     palier `mixte:` (unicité facture/apporteur/parrainage, sans migration) ;
 *   · formation dans une commande mixte : « à qualifier », palier `mixte:…+formation:…` gardé (le
 *     palier de formation se choisit dans la console, `qualifierCommission`) + alerte ;
 *   · ventilation incertaine (remise globale, lignes illisibles ou qui ne retombent pas sur le devis,
 *     activité de l'autre partie inconnue) : « à qualifier » + alerte. Rien n'est deviné.
 */
export function commissionJourneeIa(e: {
  lignes: readonly unknown[];
  quantite: number;
  baseSignatureCents: number;
  baseApresAvoirsCents: number;
  /** Activité des factures de la commande (une seule) ; `null` si absente ou divergente. */
  activiteAutre: string | null;
}): {
  calc: CalculCommission;
  activite: string;
  palierAQualifier: string | null;
  alerteMixte: string | null;
} {
  const aQualifier = (motif: string, palier: string | null = null, activite = "inconnue") => ({
    calc: { statut: "a_qualifier" } as CalculCommission,
    activite,
    palierAQualifier: palier,
    alerteMixte: motif,
  });
  const v = ventilerJourneeIa({ lignes: e.lignes, baseSignatureCents: e.baseSignatureCents });
  if ("incertaine" in v) return aQualifier(`Ventilation impossible : ${v.incertaine}.`);
  if (v.autreHtCents === 0)
    return {
      calc: calculerCommission({
        activite: "journee_ia",
        factureHtCents: e.baseApresAvoirsCents,
        quantite: e.quantite,
      }),
      activite: "journee_ia",
      palierAQualifier: null,
      alerteMixte: null,
    };
  const parts = {
    journees: v.journees,
    journeeIaHtCents: v.journeeIaHtCents,
    autre: e.activiteAutre ?? "inconnue",
    sessions: 1,
    autreHtCents: v.autreHtCents,
  };
  if (e.activiteAutre === "formation") {
    const j = commissionMixte({ ...parts, autre: "un_a_un" }, e.baseApresAvoirsCents);
    const partJournee = j.statut === "calculee" ? euros(j.montantCents) : "—";
    return aQualifier(
      `Part Journée IA : ${partJournee} (500 € au prorata de 1 490 € HT, sur ${euros(v.journeeIaHtCents)} HT). Part formation (${euros(v.autreHtCents)} HT) : choisissez son palier dans la console, la commission totale sera la somme des deux.`,
      palierMixte({ ...parts, autre: "formation" }),
      "formation",
    );
  }
  const calc =
    e.activiteAutre === null
      ? ({ statut: "a_qualifier" } as CalculCommission)
      : commissionMixte(parts, e.baseApresAvoirsCents);
  if (calc.statut !== "calculee")
    return aQualifier(
      `L'activité de l'autre prestation (${euros(v.autreHtCents)} HT) n'est pas connue ou n'est pas commissionnable avec certitude.`,
    );
  return { calc, activite: "journee_ia", palierAQualifier: null, alerteMixte: null };
}
