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
// ── Le kit du dossier commencé (2026-09-19) ──────────────────────────────
// Quelqu'un qui valide l'écran 1 du dossier sans le finir n'a reçu AUCUN
// e-mail : le kit apporteur (document de présentation + catalogue) doit
// pourtant partir dès qu'on a son adresse (décision Will). Un troisième job
// retardé de 30 minutes lui envoie `lead-apporteur-recu`, variante
// `dossier-commence`. Même mécanique que les relances — `jobId` dérivé du hash,
// retiré par `annulerRelancesLeadApporteur` quand le dossier arrive — donc celui
// qui finit son dossier en trois minutes ne le reçoit jamais : la confirmation
// du dossier porte déjà le kit.
//
// 🔴 Le `jobId` porte le HASH, jamais l'adresse — une clé Redis se lit dans
// n'importe quel dump (même règle que le compteur par e-mail de l'action).
// Il n'a pas de `:` : BullMQ s'en sert comme séparateur de clés.

import { emailsQueue, enqueueEmail } from "@/server/queue/queues";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { marquerAnnule } from "@/server/email/email-log";
import {
  DELAI_KIT_DOSSIER_COMMENCE_MS,
  VARIANTE_DOSSIER_COMMENCE,
} from "@/lib/commercial-application/kit-apporteur";

export const RELANCES_LEAD_APPORTEUR = [
  { etape: "j2", delaiMs: 2 * 24 * 60 * 60 * 1000 },
  { etape: "j7", delaiMs: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type EtapeRelance = (typeof RELANCES_LEAD_APPORTEUR)[number]["etape"];

export function jobIdRelance(etape: EtapeRelance, emailKey: string): string {
  return `lead-apporteur-relance-${etape}-${emailKey}`;
}

/** Identifiant du job « kit du dossier commencé » — dérivé du hash, comme les relances. */
export function jobIdKitDossierCommence(emailKey: string): string {
  return `lead-apporteur-kit-${emailKey}`;
}

/** Tous les jobs en attente qu'un dossier complet rend caducs, pour une adresse. */
function jobsCaducs(emailKey: string): string[] {
  return [
    jobIdKitDossierCommence(emailKey),
    ...RELANCES_LEAD_APPORTEUR.map((r) => jobIdRelance(r.etape, emailKey)),
  ];
}

export interface PlanifierRelancesInput {
  email: string;
  prenom: string;
  dossierUrl: string;
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
 * Pose le kit du dossier commencé (30 min) — pour la personne arrivée
 * DIRECTEMENT sur le dossier, qui n'a donc reçu aucun e-mail. Best-effort,
 * comme les relances. Renvoie vrai si le job est posé.
 */
export async function planifierKitDossierCommence(input: PlanifierRelancesInput): Promise<boolean> {
  const emailKey = hashEmailForLookup(input.email);
  if (!emailKey) return false;
  const res = await enqueueEmail(
    "lead-apporteur-recu",
    input.email,
    "fr",
    {
      contactName: input.prenom,
      dossierUrl: input.dossierUrl,
      variante: VARIANTE_DOSSIER_COMMENCE,
      submissionId: input.submissionId,
    },
    {
      delayMs: DELAI_KIT_DOSSIER_COMMENCE_MS,
      jobId: jobIdKitDossierCommence(emailKey),
      entityType: "Submission",
      entityId: input.submissionId,
    },
  );
  return res.enqueued;
}

/**
 * Retire les rappels encore en attente pour cette adresse. Appelée quand le
 * dossier complet arrive. Best-effort, silencieuse si la file est absente
 * (build, tests) ou si aucun job n'existe.
 */
export async function annulerRelancesLeadApporteur(
  email: string,
  motif = "Envoi annulé : le dossier complet est arrivé avant l'échéance.",
): Promise<number> {
  const emailKey = hashEmailForLookup(email);
  if (!emailKey || !emailsQueue) return 0;
  let retires = 0;
  for (const jobId of jobsCaducs(emailKey)) {
    try {
      const n = await emailsQueue.remove(jobId);
      if (n === 1) retires += 1;
    } catch {
      // Un job déjà parti, ou déjà retiré : rien à faire.
    }
    // 🔴 2026-09-09 — RETIRER LE JOB NE SUFFISAIT PAS.
    //
    // La ligne « en attente » posée à l'enfilage n'était refermée par personne :
    // le worker la clôt à l'exécution, et un job annulé n'est jamais exécuté.
    // Elle restait donc `pending` POUR TOUJOURS, et son échéance passée elle se
    // présentait comme un envoi bloqué. Deux lignes dans cet état en production.
    //
    // Appelé HORS du `try` du retrait, et pour les deux issues : `remove()` rend
    // aussi 0 quand le job a déjà été retiré par un passage précédent, et la
    // ligne, elle, peut être restée ouverte. `marquerAnnule` ne touche que les
    // lignes encore `pending` — un envoi réellement parti n'est jamais réécrit.
    await marquerAnnule(jobId, motif);
  }
  return retires;
}
