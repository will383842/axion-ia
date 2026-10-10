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
import {
  DELAI_ETAPE2_VSL_MS,
  VARIANTE_VSL_ABANDON,
  VARIANTE_VSL_ETAPE2,
  VARIANTE_VSL_RELANCE,
} from "@/lib/commercial-application/vsl-apporteur";

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
    // B1 « C'est noté » (tunnel vidéo), retardé de 15 min : une réservation, une
    // réponse ou une opposition arrivées entre-temps le retirent aussi.
    jobIdVslEtape2(emailKey),
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

/** Identifiant du message B1 « C'est noté » (étape 2 du tunnel vidéo) — un seul par adresse. */
export function jobIdVslEtape2(emailKey: string): string {
  return `lead-apporteur-vsl-etape2-${emailKey}`;
}

export interface PlanifierRelancesVslInput {
  email: string;
  prenom: string;
  /** Lien de REPRISE (page vidéo + jeton de reprise) : le bouton de A1, A2 et A3. */
  reprendreUrl: string;
  submissionId: string;
}

/**
 * Branche A du tunnel vidéo (03-MESSAGES §2) : la personne a validé l'étape 1
 * (prénom + e-mail) et pas la suivante.
 *   · A1 à +30 min — `lead-apporteur-recu`, variante `vsl-abandon` ;
 *   · A2 à +2 j, A3 à +7 j — `lead-apporteur-relance`, variante `vsl`.
 *
 * Mêmes identifiants de tâche que le dossier commencé (`kit`, `j2`, `j7`) :
 *   · `annulerRelancesLeadApporteur` les retire déjà tous (dossier complet,
 *     invitation envoyée) ; l'étape 2 et la réservation s'appuient sur lui ;
 *   · une adresse ne peut avoir QU'UNE série en attente, quel que soit le
 *     parcours par lequel elle est entrée (R3, R5 : au plus un message par jour).
 * Best-effort, comme les autres. Renvoie le nombre de tâches posées.
 */
export async function planifierRelancesVsl(input: PlanifierRelancesVslInput): Promise<number> {
  const emailKey = hashEmailForLookup(input.email);
  if (!emailKey) return 0;
  let poses = 0;
  const kit = await enqueueEmail(
    "lead-apporteur-recu",
    input.email,
    "fr",
    {
      contactName: input.prenom,
      dossierUrl: input.reprendreUrl,
      variante: VARIANTE_VSL_ABANDON,
      submissionId: input.submissionId,
    },
    {
      delayMs: DELAI_KIT_DOSSIER_COMMENCE_MS,
      jobId: jobIdKitDossierCommence(emailKey),
      entityType: "Submission",
      entityId: input.submissionId,
    },
  );
  if (kit.enqueued) poses += 1;
  for (const r of RELANCES_LEAD_APPORTEUR) {
    const res = await enqueueEmail(
      "lead-apporteur-relance",
      input.email,
      "fr",
      {
        contactName: input.prenom,
        dossierUrl: input.reprendreUrl,
        etape: r.etape,
        variante: VARIANTE_VSL_RELANCE,
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

export interface EnvoyerEtape2Input {
  email: string;
  prenom: string;
  /** Bouton « Choisir mon créneau » : le lien Calendly, ou la page de remerciement à défaut. */
  calendlyUrl: string;
  dossierUrl: string;
  submissionId: string;
  /**
   * Jeton signé (`?j=`) que le gabarit recopie dans le lien de réservation : le
   * formulaire du site reconnaît alors la personne (nom, e-mail, téléphone) et
   * rattache la réservation à sa fiche. Il vit aussi longtemps que le message
   * peut être ouvert (`VALIDITE_JETON_REPRISE_MS`) ; absent, le lien part nu.
   */
  jetonReservation?: string;
}

/**
 * B1 — « C'est noté » + bouton Calendly, RETARDÉ de 15 minutes (2026-10-10), une
 * seule fois par adresse (le `jobId` dérivé du hash fait ignorer un second
 * enfilage). Renvoie vrai si le message est parti en file.
 *
 * Celui qui réserve aussitôt n'en reçoit pas : la réservation retire le job
 * (`annulerRelancesLeadApporteur`, appelée par l'enrichissement Calendly), comme
 * pour A1, A2 et A3 — ce job fait partie de `jobsCaducs`. Il ne double pas A1 :
 * l'étape 2 retire A1 avant de poser B1, les deux ne coexistent jamais.
 */
export async function envoyerEtape2Vsl(input: EnvoyerEtape2Input): Promise<boolean> {
  const emailKey = hashEmailForLookup(input.email);
  if (!emailKey) return false;
  const res = await enqueueEmail(
    "lead-apporteur-recu",
    input.email,
    "fr",
    {
      contactName: input.prenom,
      calendlyUrl: input.calendlyUrl,
      dossierUrl: input.dossierUrl,
      ...(input.jetonReservation ? { jetonReservation: input.jetonReservation } : {}),
      variante: VARIANTE_VSL_ETAPE2,
      submissionId: input.submissionId,
    },
    {
      delayMs: DELAI_ETAPE2_VSL_MS,
      jobId: jobIdVslEtape2(emailKey),
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
