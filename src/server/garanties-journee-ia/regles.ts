/**
 * Garantie Journée IA — règles de saisie (PURES, sans base). Les actions serveur les appellent
 * avant toute écriture ; elles sont testées ici sans Prisma.
 *
 * Règle de fond : « variante brief ». Une réputée acceptée n'est JAMAIS écrite : elle se calcule.
 */
import { estReputeeAcceptee, type DonneesGarantie } from "@/lib/garantie-journee-ia/echeances";

export const DECISIONS = ["remboursement", "refus", "avoir"] as const;
export type Decision = (typeof DECISIONS)[number];
export const MOTIF_MIN = 10;
/** Plafond d'un remboursement : prix HT de la journée + TVA à 20 % (art. 47.10 f), en centimes. */
export function plafondRemboursementCents(prixHtCents: number): number {
  return Math.round(prixHtCents * 1.2);
}
/** Plafond de l'avoir offert : 4 470 € HT (décision du dirigeant, 25/11/2026), en centimes. */
export const PLAFOND_AVOIR_HT_CENTS = 447_000;

/** Montant d'avoir en centimes si recevable (> 0 et ≤ plafond), sinon la phrase du refus. */
export function verifierMontantAvoir(
  cents: number | null,
): { ok: true; cents: number } | { ok: false; message: string } {
  if (cents === null || cents <= 0) return { ok: false, message: "Montant de l'avoir invalide." };
  if (cents > PLAFOND_AVOIR_HT_CENTS) {
    return { ok: false, message: "L'avoir ne peut pas dépasser 4 470 € HT." };
  }
  return { ok: true, cents };
}

/** `null` si la décision est recevable, sinon la phrase du refus. */
export function refusDecision(
  d: DonneesGarantie,
  saisie: { decision: Decision; decisionLe: string; motif?: string | null },
): string | null {
  if (d.virementLe) return "Le virement est déjà saisi : la décision ne peut plus changer.";
  if (!d.demandeRecueLe) {
    return "Saisir d'abord la date de réception de la demande écrite du client.";
  }
  if (d.demandeRecueLe && saisie.decisionLe < d.demandeRecueLe) {
    return "La décision ne peut pas précéder la réception de la demande.";
  }
  if (saisie.decision === "refus" && (saisie.motif ?? "").trim().length < MOTIF_MIN) {
    return `Un motif d'au moins ${MOTIF_MIN} caractères est exigé pour un refus.`;
  }
  return null;
}

/** Le virement n'est saisissable que s'il y a un remboursement décidé, ou une demande réputée acceptée. */
export function refusVirement(
  d: DonneesGarantie,
  virementLe: string,
  aujourdhui: string,
): string | null {
  const dû = d.decision === "remboursement" || estReputeeAcceptee(d, aujourdhui);
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
  const c = Math.round(Number(t) * 100);
  return c <= 2_147_483_647 ? c : null;
}

/**
 * Un remboursement décidé a ÉMIS un avoir (pièce comptable, jamais supprimée) : la décision ne peut
 * plus changer. `null` = pas d'obstacle ; "idempotent" = même décision, même montant (double clic).
 */
export function etatApresAvoirRembourse(
  d: { decision?: Decision | null; avoirId: string | null; montantRembourseCents: number | null },
  saisie: { decision: Decision; montantCents: number | null },
): { type: "libre" } | { type: "idempotent" } | { type: "refus"; message: string } {
  if (d.decision !== "remboursement" || !d.avoirId) return { type: "libre" };
  if (saisie.decision === "remboursement" && saisie.montantCents === d.montantRembourseCents)
    return { type: "idempotent" };
  return {
    type: "refus",
    message:
      "Un avoir de remboursement est déjà émis : la décision ne peut plus changer. Une pièce émise ne se supprime pas ; voir le Hub factures avec le comptable.",
  };
}

/** Le virement exige l'avoir émis par la décision, et un montant viré égal à son TTC. */
export function refusVirementSansAvoir(
  d: { avoirId: string | null; decision?: Decision | null; montantRembourseCents: number | null },
  montantViréCents: number | null,
): string | null {
  if (!d.avoirId || d.decision !== "remboursement") {
    return "Émettre d'abord l'avoir : enregistrer la décision « Rembourser » (elle émet l'avoir), puis le virement.";
  }
  if (montantViréCents !== d.montantRembourseCents) {
    return `Le montant viré doit être égal au montant TTC de l'avoir (${((d.montantRembourseCents ?? 0) / 100).toFixed(2).replace(".", ",")} €).`;
  }
  return null;
}
