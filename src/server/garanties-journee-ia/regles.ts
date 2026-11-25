/**
 * Garantie Journée IA — règles de saisie (PURES, sans base). Les actions serveur les appellent
 * avant toute écriture ; elles sont testées ici sans Prisma.
 *
 * Règle de fond : « variante brief ». Une réputée acceptée n'est JAMAIS écrite : elle se calcule.
 */
import { estReputeeAcceptee, type DonneesGarantie } from "@/lib/garantie-journee-ia/echeances";

export const DECISIONS = ["remboursement", "refus", "non_applicable"] as const;
export type Decision = (typeof DECISIONS)[number];
export const MOTIF_MIN = 10;

/** `null` si la décision est recevable, sinon la phrase du refus. */
export function refusDecision(
  d: DonneesGarantie,
  saisie: { decision: Decision; decisionLe: string; motif?: string | null },
): string | null {
  if (d.virementLe) return "Le virement est déjà saisi : la décision ne peut plus changer.";
  if (saisie.decision !== "non_applicable" && !d.demandeRecueLe) {
    return "Saisir d'abord la date de réception de la demande écrite du client.";
  }
  if (d.demandeRecueLe && saisie.decisionLe < d.demandeRecueLe) {
    return "La décision ne peut pas précéder la réception de la demande.";
  }
  if (saisie.decision !== "remboursement" && (saisie.motif ?? "").trim().length < MOTIF_MIN) {
    return `Un motif d'au moins ${MOTIF_MIN} caractères est exigé hors remboursement.`;
  }
  return null;
}

/** Le virement n'est saisissable que s'il y a un remboursement décidé, ou une demande réputée acceptée. */
export function refusVirement(
  d: DonneesGarantie,
  virementLe: string,
  aujourdhui: string,
): string | null {
  const dû = d.decision === "remboursement" || (!d.decisionLe && estReputeeAcceptee(d, aujourdhui));
  if (!dû)
    return "Aucun remboursement n'est dû : ni décision de remboursement, ni demande réputée acceptée.";
  const depart = d.decisionLe ?? d.demandeRecueLe ?? null;
  if (depart && virementLe < depart)
    return "Le virement ne peut pas précéder la décision ou la demande.";
  return null;
}

/** Une demande ne peut précéder la remise du rapport (point de départ du délai de 30 jours). */
export function refusDemande(d: DonneesGarantie, demandeRecueLe: string | null): string | null {
  if (demandeRecueLe && !d.rapportRemisLe) {
    return "Saisir d'abord la date de remise du rapport : c'est le point de départ du délai.";
  }
  if (demandeRecueLe && d.rapportRemisLe && demandeRecueLe < d.rapportRemisLe) {
    return "La demande ne peut pas précéder la remise du rapport.";
  }
  return null;
}

/** Euros saisis (« 1 234,50 » ou « 1234.5 ») → centimes entiers, ou null si illisible. */
export function eurosEnCentimes(brut: string | number): number | null {
  const t = String(brut).replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
