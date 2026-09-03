// Relances du premier contact Facebook — « ton dossier t'attend » à J+2 et J+7.
//
// ── Ce que c'est, et ce que ce n'est pas ─────────────────────────────────
// La personne a laissé cinq champs et demandé qu'on l'appelle. Le dossier
// complet (3 minutes, sans CV) lui est proposé par l'e-mail de confirmation ;
// deux rappels suivent si elle ne l'a pas ouvert. Elle n'est PAS apporteuse :
// aucun contrat, aucune activité mesurée. Ces rappels portent sur une démarche
// qu'elle a elle-même engagée — ce n'est ni une relance de dormance ni une
// directive (cf. `docs/partners/ANTI-REQUALIFICATION.md`, qui ne vise que les
// apporteurs sous contrat).
//
// ── Mécanique ────────────────────────────────────────────────────────────
// Deux jobs BullMQ RETARDÉS, posés à la soumission, avec un `jobId` DÉRIVÉ du
// hash de l'e-mail : la même personne qui renvoie le formulaire ne reçoit pas
// deux séries (BullMQ ignore un job dont l'identifiant existe déjà). Quand le
// dossier complet arrive, `submitCommercialApplicationAction` appelle
// `annulerRelancesLeadApporteur` : les jobs encore en attente sont retirés,
// et personne n'est relancé pour un dossier déjà envoyé.
//
// 🔴 Le `jobId` porte le HASH, jamais l'adresse — une clé Redis se lit dans
// n'importe quel dump (même règle que le compteur par e-mail de l'action).
// Il n'a pas de `:` : BullMQ s'en sert comme séparateur de clés.

import { emailsQueue, enqueueEmail } from "@/server/queue/queues";
import { hashEmailForLookup } from "@/lib/security/email-hash";

export const RELANCES_LEAD_APPORTEUR = [
  { etape: "j2", delaiMs: 2 * 24 * 60 * 60 * 1000 },
  { etape: "j7", delaiMs: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type EtapeRelance = (typeof RELANCES_LEAD_APPORTEUR)[number]["etape"];

export function jobIdRelance(etape: EtapeRelance, emailKey: string): string {
  return `lead-apporteur-relance-${etape}-${emailKey}`;
}

export interface PlanifierRelancesInput {
  email: string;
  prenom: string;
  dossierUrl: string;
  creneauUrl?: string | undefined;
  submissionId: string;
}

/**
 * Pose les deux rappels. Best-effort : un échec de mise en file ne doit jamais
 * remonter à la candidature (déjà en base). Renvoie le nombre de jobs posés.
 */
export async function planifierRelancesLeadApporteur(
  input: PlanifierRelancesInput,
): Promise<number> {
  const emailKey = hashEmailForLookup(input.email);
  if (!emailKey) return 0;
  let poses = 0;
  for (const r of RELANCES_LEAD_APPORTEUR) {
    const res = await enqueueEmail(
      "lead-apporteur-relance",
      input.email,
      "fr",
      {
        contactName: input.prenom,
        dossierUrl: input.dossierUrl,
        etape: r.etape,
        ...(input.creneauUrl ? { creneauUrl: input.creneauUrl } : {}),
        submissionId: input.submissionId,
      },
      {
        delayMs: r.delaiMs,
        jobId: jobIdRelance(r.etape, emailKey),
        entityType: "Submission",
        entityId: input.submissionId,
      },
    );
    if (res.enqueued) poses += 1;
  }
  return poses;
}

/**
 * Retire les rappels encore en attente pour cette adresse. Appelée quand le
 * dossier complet arrive. Best-effort, silencieuse si la file est absente
 * (build, tests) ou si aucun job n'existe.
 */
export async function annulerRelancesLeadApporteur(email: string): Promise<number> {
  const emailKey = hashEmailForLookup(email);
  if (!emailKey || !emailsQueue) return 0;
  let retires = 0;
  for (const r of RELANCES_LEAD_APPORTEUR) {
    try {
      const n = await emailsQueue.remove(jobIdRelance(r.etape, emailKey));
      if (n === 1) retires += 1;
    } catch {
      // Un job déjà parti, ou déjà retiré : rien à faire.
    }
  }
  return retires;
}
