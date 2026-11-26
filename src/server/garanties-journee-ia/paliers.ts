/**
 * Garantie Journée IA — paliers d'alerte des échéances (module PUR, sans base).
 *
 * Quatre paliers par échéance : J-5 (info), J-2 et J0 (important), « dépassée » (critique), le
 * dernier une seule fois. Les textes d'un palier sont STABLES (ils ne comptent jamais « N jours de
 * retard ») : le passage quotidien rend à l'identique, et l'alerte n'est ni mise à jour ni
 * re-notifiée tant que le palier ne change pas. Seule l'ÉCHÉANCE porte la date.
 *
 * `fin_demande` n'a pas d'alerte : c'est le délai du CLIENT, pas une obligation d'Axion-IA.
 */
import { joursRestants } from "@/lib/jours-ouvres";
import type { Echeance, TypeEcheance } from "@/lib/garantie-journee-ia/echeances";
import { jourFr } from "@/lib/garantie-journee-ia/presentation";

export type PalierAlerte = "J-5" | "J-2" | "J0" | "depassee";
export type NiveauAlerte = "info" | "important" | "critique";

export const CODE_PAR_ECHEANCE: Readonly<Partial<Record<TypeEcheance, string>>> = {
  rapport: "garantie_ji_rapport",
  reponse: "garantie_ji_reponse",
  virement: "garantie_ji_remboursement",
};

/** Les trois codes émis par le passage (et donc refermés par lui). */
export const CODES_GARANTIE_JI: readonly string[] = Object.values(CODE_PAR_ECHEANCE) as string[];

export const CIBLE_TYPE_GARANTIE = "GarantieJourneeIa";

export const NIVEAU_PAR_PALIER: Readonly<Record<PalierAlerte, NiveauAlerte>> = {
  "J-5": "info",
  "J-2": "important",
  J0: "important",
  depassee: "critique",
};

/** Le palier atteint à `aujourdhui`, ou `null` si l'échéance est à plus de 5 jours. */
export function palierPour(dateEcheance: string, aujourdhui: string): PalierAlerte | null {
  const j = joursRestants(dateEcheance, aujourdhui);
  if (j < 0) return "depassee";
  if (j === 0) return "J0";
  if (j <= 2) return "J-2";
  if (j <= 5) return "J-5";
  return null;
}

const QUAND: Record<PalierAlerte, (d: string) => string> = {
  "J-5": (d) => `échéance dans 5 jours ou moins, le ${jourFr(d)}`,
  "J-2": (d) => `échéance dans 2 jours ou moins, le ${jourFr(d)}`,
  J0: (d) => `échéance aujourd'hui, le ${jourFr(d)}`,
  depassee: (d) => `échéance dépassée depuis le ${jourFr(d)}`,
};

const OBJET: Record<string, string> = {
  rapport: "Remise du rapport",
  reponse: "Réponse écrite au client",
  virement: "Virement du remboursement",
};

export interface TexteAlerte {
  titre: string;
  message: string;
}

/** Titre et message d'une alerte de palier ; stables pour un (échéance, palier) donné. */
export function texteAlerte(
  type: TypeEcheance,
  palier: PalierAlerte,
  dateEcheance: string,
  clientNom: string,
  aTrancher = false,
): TexteAlerte {
  const objet = OBJET[type] ?? type;
  const titre = `Garantie Journée IA — ${objet} (${clientNom}) : ${
    palier === "depassee" ? "dépassée" : palier === "J0" ? "aujourd'hui" : palier
  }`;
  let message = `${objet} pour ${clientNom} : ${QUAND[palier](dateEcheance)}.`;
  if (type === "reponse" && aTrancher) {
    // Demande hors délai : jamais d'acceptation tacite, Will choisit (rembourser, refuser ou avoir).
    message +=
      " Demande reçue hors délai : aucune acceptation tacite, à trancher (rembourser, refuser ou offrir un avoir).";
  } else if (type === "reponse") {
    message +=
      palier === "depassee"
        ? " Sans réponse écrite, la demande est réputée acceptée : le virement est dû."
        : palier === "J0"
          ? " Sans réponse écrite aujourd'hui, la demande sera réputée acceptée."
          : " Sans réponse écrite à cette date, la demande sera réputée acceptée.";
  }
  if (type === "rapport") message += " Saisir la date de remise dans la fiche du dossier.";
  if (type === "virement") message += " Saisir la date du virement dans la fiche du dossier.";
  return { titre, message };
}

export interface AlerteVoulue extends TexteAlerte {
  code: string;
  cibleId: string;
  palier: PalierAlerte;
  niveau: NiveauAlerte;
  echeance: TypeEcheance;
}

/** L'alerte voulue pour une échéance OUVERTE, ou `null` (faite, sans code, ou trop lointaine). */
export function alerteVoulue(
  dossierId: string,
  clientNom: string,
  e: Pick<Echeance, "type" | "date" | "faite" | "aTrancher">,
  aujourdhui: string,
): AlerteVoulue | null {
  const code = CODE_PAR_ECHEANCE[e.type];
  if (!code || e.faite) return null;
  const palier = palierPour(e.date, aujourdhui);
  if (!palier) return null;
  return {
    code,
    cibleId: dossierId,
    palier,
    niveau: NIVEAU_PAR_PALIER[palier],
    echeance: e.type,
    ...texteAlerte(e.type, palier, e.date, clientNom, Boolean(e.aTrancher)),
  };
}
