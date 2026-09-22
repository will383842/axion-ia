// Reply Server Actions admin (Sprint Notif Infra 2026-05-26 / Chantier 5).
//
// Permet à l'admin (super_admin / admin / editor) de :
//  - répondre à une Submission depuis l'admin → SubmissionReply created
//    + email enqueued via worker dédié
//  - archiver / désarchiver (single + bulk)
//  - marquer needsAttention=true/false (toggle inbox)
//  - retry une reply failed/bounced
//
// Pattern hérité de `admin-submissions/actions.ts` :
//  - requireAdminWriteSession() (RBAC strict)
//  - Zod schema strict
//  - Prisma transaction si update Submission + create SubmissionReply
//  - revalidatePath(/contacts/messages + /contacts/messages/[id])
//  - Sentry.captureException sur catch (audit trail)

"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { renderEmailTemplate } from "@/lib/email/templates";
import { enqueueEmail } from "@/server/queue/queues";
import { decryptPii, isDecryptedEmailUsable } from "@/lib/pii-crypto";
import { appliquerTransition } from "./transitions";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { enregistrerOppositionPourAdresse } from "@/server/email/opposition";
import { annulerRelancesLeadApporteur } from "@/features/commercial-application/relances-lead-apporteur";

async function requireAdminWriteSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role;
  if (role !== "super_admin" && role !== "admin" && role !== "editor") {
    throw new Error("forbidden");
  }
  const name = (session.user as { name?: string }).name ?? session.user.id;
  return { userId: session.user.id, role, name };
}

// ============================================================
// replyToSubmissionAction
// ============================================================

const replySchema = z.object({
  submissionId: z.string().uuid(),
  subject: z.string().min(2).max(500),
  bodyMarkdown: z.string().min(1).max(50_000),
  template: z
    .enum(["default", "audit_followup", "intervention_followup", "custom"])
    .default("default"),
  internalNote: z.string().max(2000).optional(),
});

export type ReplyToSubmissionState =
  | { ok: true; replyId: string }
  // replyId présent si la reply a été persistée mais l'envoi a échoué (enqueue KO)
  // → l'admin peut la réessayer via retryFailedReplyAction.
  | { ok: false; error: string; replyId?: string };

export async function replyToSubmissionAction(
  input: z.input<typeof replySchema>,
): Promise<ReplyToSubmissionState> {
  let session: { userId: string; role: string; name: string };
  try {
    session = await requireAdminWriteSession();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unauthorized";
    return { ok: false, error: msg };
  }

  const parsed = replySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Champs invalides",
    };
  }
  const data = parsed.data;

  const submission = await prisma.submission.findUnique({
    where: { id: data.submissionId },
  });
  if (!submission) return { ok: false, error: "submission_not_found" };

  // 0. Pré-vol : déchiffrer + valider l'adresse DANS le process web (qui a la
  //    clé). Si l'adresse est illisible (clé absente → placeholder) ou invalide,
  //    on échoue AVANT de créer une reply orpheline, avec une erreur claire.
  if (!isDecryptedEmailUsable(decryptPii(submission.contactEmail))) {
    return { ok: false, error: "invalid_recipient" };
  }

  // 1. Pre-render template HTML + plain text via @react-email/render.
  let rendered: { subject: string; html: string; text: string };
  try {
    rendered = await renderEmailTemplate("submission-reply", submission.locale, {
      subject: data.subject,
      bodyMarkdown: data.bodyMarkdown,
    });
  } catch (e) {
    Sentry.captureException(e);
    return { ok: false, error: "render_failed" };
  }

  // 2. Create SubmissionReply + update Submission cache cols en transaction.
  const replyId = await prisma
    .$transaction(async (tx) => {
      const reply = await tx.submissionReply.create({
        data: {
          submissionId: submission.id,
          repliedByUserId: session.userId,
          repliedByName: session.name,
          toEmail: submission.contactEmail,
          subject: data.subject,
          bodyHtml: rendered.html,
          bodyText: rendered.text,
          deliveryStatus: "pending",
          ...(data.internalNote ? { internalNote: data.internalNote } : {}),
          templateUsed: data.template,
        },
      });

      await tx.submission.update({
        where: { id: submission.id },
        data: {
          replyCount: { increment: 1 },
          needsAttention: false,
          ...(submission.status === "new" ? { status: "in_progress" as const } : {}),
        },
      });

      return reply.id;
    })
    .catch((e) => {
      Sentry.captureException(e);
      return null;
    });

  if (!replyId) return { ok: false, error: "db_failed" };

  // 3. Enqueue email (le worker re-déchiffre l'adresse depuis la DB → PAS de PII
  //    dans le payload de queue). Si l'enqueue échoue (queue indisponible), on
  //    marque la reply `failed` (rejouable) et on remonte l'échec à l'admin
  //    (plus de faux succès pendant que la reply reste `pending` éternellement).
  let enqueued = false;
  try {
    const res = await enqueueEmail("submission-reply", "", submission.locale, {
      replyId,
      subject: data.subject,
      submissionId: submission.id,
    });
    enqueued = res.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }

  revalidatePath(adminPath("fr", "contacts/messages"));
  revalidatePath(adminPath("fr", `contacts/messages/${submission.id}`));
  // Sprint Notif Infra 2026-05-26 / fix P1-1 audit 2026-05-27 — invalide le
  // compteur unread cached du badge sidebar.
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);

  if (!enqueued) {
    await prisma.submissionReply
      .update({
        where: { id: replyId },
        data: {
          deliveryStatus: "failed",
          failedAt: new Date(),
          errorMsg: "enqueue_failed (file d'envoi indisponible)",
        },
      })
      .catch((e) => Sentry.captureException(e));
    return { ok: false, error: "enqueue_failed", replyId };
  }

  // ── REPONDRE ARRETE LES RELANCES EN ATTENTE ────────────────────────────
  // Demande de Will, mot pour mot : « je voudrais pouvoir repondre manuellement
  // sans passer par le circuit normal, pour eviter d'avoir des messages en
  // doublons ». Les rappels « ton dossier t'attend » sont des jobs RETARDES qui
  // dorment dans Redis jusqu'a J+2 et J+7 ; rien ne les arretait parce qu'on
  // avait repondu.
  //
  // 🔴 DEUX CONDITIONS, ET J'AVAIS OUBLIE LES DEUX.
  //
  // 1. SEULEMENT SUR UN DOSSIER APPORTEUR. `annulerRelancesLeadApporteur`
  //    retrouve les jobs par l'EMPREINTE DE L'ADRESSE, jamais par la fiche — et
  //    `ReplyComposer` est monte sur TOUTE fiche de la console. Sans ce garde,
  //    repondre a un simple message /contact retirait, en silence, les relances
  //    programmees par la candidature d'apporteur de la meme personne, et
  //    inscrivait au journal des envois un motif qui designe une reponse faite
  //    sur un AUTRE dossier.
  //
  //    ⚠️ Le garde existait deja, dix lignes plus bas, dans `transitions.ts` —
  //    avec le commentaire qui decrit ce scenario mot pour mot. Je l'avais ecrit
  //    et pas applique ici : corriger le cas qu'on vous nomme n'est pas corriger
  //    la famille.
  //
  // 2. SEULEMENT SI LA REPONSE EST PARTIE. Ce bloc tournait AVANT le
  //    branchement ci-dessus : file indisponible ⇒ la personne ne recevait NI la
  //    reponse NI les relances, et le journal affirmait un envoi qui n'avait pas
  //    eu lieu. Elle sortait du tunnel en silence.
  //
  // Best-effort a partir d'ici : un retrait qui echoue ne transforme pas une
  // reponse PARTIE en echec — sinon Will recommence, et la personne recoit deux
  // fois la meme reponse. C'est exactement le doublon qu'on evite.
  if (estApporteur(submission.details)) {
    const adresseClaire = decryptPii(submission.contactEmail);
    if (adresseClaire) {
      try {
        await annulerRelancesLeadApporteur(
          adresseClaire,
          "Envoi annulé : une réponse a été envoyée depuis la console.",
        );
      } catch (e) {
        Sentry.captureException(e, { tags: { step: "annuler-relances-apres-reponse" } });
      }
    }
  }

  return { ok: true, replyId };
}

// ============================================================
// archive / unarchive
// ============================================================

const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });
const singleIdSchema = z.object({ id: z.string().uuid() });

// 🔴 LES QUATRE GESTES UNITAIRES PASSENT PAR `transitions.ts`, ET C'EST LE FOND
// DE CETTE PR. Chacun écrivait ses propres colonnes ici, et « Archiver »
// n'annulait PAS les relances en attente : une personne archivée continuait de
// recevoir « ton dossier t'attend » à J+2 et J+7, depuis des jobs retardés qui
// dorment dans Redis. Ça ne se voit jamais depuis la console — ça se voit dans
// sa boîte à elle.
//
// ⚠️ Les gestes EN LOT restent ci-dessous en `updateMany` : ils traitent
// jusqu'à 500 lignes, et 500 transactions séquentielles feraient expirer
// l'action. Ils annulent les relances en une passe APRÈS l'écriture.

/** Nombre de relances retirees de la file — `0` est une reponse, pas un echec. */
export interface ResultatGeste {
  ok: boolean;
  relancesRetirees?: number;
}

async function geste(
  id: string,
  transition:
    "traite" | "archiver" | "desarchiver" | "sans-suite" | "remettre" | "repondu-ailleurs",
): Promise<ResultatGeste> {
  let session: { userId: string };
  try {
    session = await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  const res = await appliquerTransition(parsed.data.id, transition, session.userId);
  return { ok: res.ok, relancesRetirees: res.relancesRetirees };
}

/**
 * Marquer traité — RANGER, sans clore.
 *
 * 🔴 Ce geste passait par `updateSubmissionAction`, le formulaire général de la
 * fiche, et pas par la table des transitions. Conséquence invisible : le témoin
 * qui prouve que « traité » n'annule PAS les relances gardait du code que la
 * production n'exécutait jamais. Il serait resté vert le jour où le vrai
 * « marquer traité » se serait mis à couper des relances légitimes.
 *
 * Au passage, ce chemin-ci n'écrit QUE deux colonnes : il ne peut pas emporter
 * les notes internes, contrairement au formulaire général — c'est exactement le
 * défaut réparé le 19/09.
 */
export async function marquerTraiteAction(id: string): Promise<ResultatGeste> {
  return geste(id, "traite");
}

export async function archiveSubmissionAction(id: string): Promise<ResultatGeste> {
  return geste(id, "archiver");
}

export async function unarchiveSubmissionAction(id: string): Promise<ResultatGeste> {
  return geste(id, "desarchiver");
}

/**
 * Classer sans suite : on a décidé de ne pas donner suite.
 *
 * Même effet de base qu'archiver — les relances s'arrêtent, la purge à 24 mois
 * s'applique par le MÊME chemin — plus une marque lisible sur la fiche et une
 * entrée au journal d'activité. La console peut alors distinguer « écarté » de
 * « rangé », ce qu'un seul `status: archived` ne permettait pas.
 */
export async function classerSansSuiteAction(id: string): Promise<ResultatGeste> {
  return geste(id, "sans-suite");
}

/** Remettre à traiter : la fiche redevient visible dans « à traiter ». */
export async function remettreATraiterAction(id: string): Promise<ResultatGeste> {
  return geste(id, "remettre");
}

/**
 * « J'ai répondu ailleurs — arrête tout ».
 *
 * Pour les réponses faites depuis Gmail, au téléphone ou de vive voix. Elle ne
 * change aucun statut : elle retire les relances en attente et horodate le
 * geste. Une réponse n'est pas toujours une clôture, et décider à la place de
 * Will coûterait plus cher que de ne rien décider.
 */
export async function reponduHorsCircuitAction(id: string): Promise<ResultatGeste> {
  return geste(id, "repondu-ailleurs");
}

/**
 * Enregistrer une opposition reçue AUTREMENT que par le lien de désinscription
 * — au téléphone, par retour d'e-mail, de vive voix.
 *
 * 🔴 CE GESTE MANQUAIT, ET SON ABSENCE SE VOYAIT CHEZ LA PERSONNE. Une
 * opposition dite à Will ne s'enregistrait nulle part : il fallait attendre
 * qu'elle clique sur un lien dans un message qu'elle venait de dire ne plus
 * vouloir. Entre-temps, les relances déjà programmées partaient.
 *
 * Passe par le MÊME chemin que le lien (`enregistrerOppositionPourAdresse`) :
 * empreinte posée, CRM prévenu, envois programmés retirés. Un second chemin
 * aurait oublié l'un des trois.
 */
export async function enregistrerOppositionDepuisFicheAction(
  id: string,
): Promise<{ ok: boolean; dejaOpposee?: boolean; erreur?: "introuvable" | "sans-adresse" }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };

  const ligne = await prisma.submission.findUnique({
    where: { id: parsed.data.id },
    select: { contactEmail: true, deletedAt: true },
  });
  if (!ligne || ligne.deletedAt) return { ok: false, erreur: "introuvable" };

  // Une fiche effacée (art. 17) porte une adresse synthétique : y poser une
  // opposition n'apprendrait rien à personne et créerait une ligne fantôme.
  const adresse = decryptPii(ligne.contactEmail);
  if (!adresse || adresse.endsWith("@erased.local")) {
    return { ok: false, erreur: "sans-adresse" };
  }

  const r = await enregistrerOppositionPourAdresse(adresse, { origine: "console-admin" });
  if (!r.ok) return { ok: false };

  revalidatePath(adminPath("fr", "contacts/messages"));
  revalidatePath(adminPath("fr", "contacts/commercial"));
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true, dejaOpposee: r.dejaOpposee };
}

export async function bulkArchiveSubmissionsAction(ids: string[]): Promise<{ archived: number }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { archived: 0 };
  }
  const parsed = idsSchema.safeParse({ ids });
  if (!parsed.success) return { archived: 0 };
  // Les adresses sont lues AVANT l'écriture : après, le filtre `archivedAt:
  // null` ne retrouve plus les lignes que cet appel vient de fermer.
  const concernes = await prisma.submission.findMany({
    where: { id: { in: parsed.data.ids }, archivedAt: null },
    select: { contactEmail: true, details: true },
  });
  const result = await prisma.submission.updateMany({
    where: { id: { in: parsed.data.ids }, archivedAt: null },
    data: { archivedAt: new Date(), needsAttention: false, status: "archived" },
  });
  // Même règle que le geste unitaire : archiver CLÔT, donc plus aucune relance
  // ne part. En lot on ne rend pas le compte — l'écran n'a pas où le dire — mais
  // le retrait doit avoir lieu, sinon archiver cinquante fiches d'un coup
  // laisserait cinquante « ton dossier t'attend » en vol.
  for (const c of concernes) {
    // 🔑 SEULS les dossiers apporteurs, comme pour le geste unitaire : les
    // relances se retrouvent par l'ADRESSE, et archiver un simple message
    // /contact de quelqu'un tuerait celles que sa candidature a programmées.
    if (!estApporteur(c.details)) continue;
    try {
      // ⚠️ `decryptPii` DANS le filet : un chiffré altéré lève, et il
      // interromprait la boucle APRES que les 500 fiches ont été archivées —
      // les suivantes garderaient leurs relances, sans que rien ne le dise.
      const adresse = decryptPii(c.contactEmail);
      if (!adresse) continue;
      await annulerRelancesLeadApporteur(adresse, "Envoi annulé : la fiche a été archivée.");
    } catch {
      // Un retrait qui échoue ne défait pas un archivage acquis.
    }
  }
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { archived: result.count };
}

export async function bulkUnarchiveSubmissionsAction(
  ids: string[],
): Promise<{ unarchived: number }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { unarchived: 0 };
  }
  const parsed = idsSchema.safeParse({ ids });
  if (!parsed.success) return { unarchived: 0 };
  const result = await prisma.submission.updateMany({
    where: { id: { in: parsed.data.ids }, archivedAt: { not: null } },
    data: { archivedAt: null, status: "in_progress" },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { unarchived: result.count };
}

// ============================================================
// soft-delete / restore (Corbeille — 2026-07-10)
// ============================================================
//
// Corbeille récupérable : `deletedAt` non null masque le message de tous les
// listings sauf l'onglet « Corbeille ». Restauration = deletedAt→null. La
// suppression DÉFINITIVE reste l'effacement RGPD (`eraseSubmissionAction`,
// super_admin, dans admin-submissions/actions.ts).

export async function softDeleteSubmissionAction(id: string): Promise<{ ok: boolean }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  await prisma.submission.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date(), needsAttention: false },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true };
}

export async function restoreSubmissionAction(id: string): Promise<{ ok: boolean }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  await prisma.submission.update({
    where: { id: parsed.data.id },
    data: { deletedAt: null },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true };
}

// ============================================================
// markNeedsAttentionAction
// ============================================================

export async function markNeedsAttentionAction(
  id: string,
  value: boolean,
): Promise<{ ok: boolean }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false };
  }
  const parsed = singleIdSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };
  await prisma.submission.update({
    where: { id: parsed.data.id },
    data: { needsAttention: value },
  });
  revalidatePath(adminPath("fr", "contacts/messages"));
  updateTag("admin:contacts-unread");
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true };
}

// ============================================================
// retryFailedReplyAction
// ============================================================

export async function retryFailedReplyAction(
  replyId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminWriteSession();
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = z.string().min(1).max(64).safeParse(replyId);
  if (!parsed.success) return { ok: false, error: "invalid_id" };

  const reply = await prisma.submissionReply.findUnique({
    where: { id: parsed.data },
    include: { submission: { select: { id: true, locale: true } } },
  });
  if (!reply) return { ok: false, error: "not_found" };

  if (reply.deliveryStatus !== "failed" && reply.deliveryStatus !== "bounced") {
    return { ok: false, error: "not_retryable" };
  }

  await prisma.submissionReply.update({
    where: { id: reply.id },
    data: {
      deliveryStatus: "pending",
      retryCount: { increment: 1 },
      failedAt: null,
      errorMsg: null,
    },
  });

  let enqueued = false;
  try {
    // Pas de PII dans le payload : le worker re-déchiffre depuis la DB.
    const res = await enqueueEmail("submission-reply", "", reply.submission.locale, {
      replyId: reply.id,
      subject: reply.subject,
      submissionId: reply.submissionId,
    });
    enqueued = res.enqueued;
  } catch (e) {
    Sentry.captureException(e);
  }
  if (!enqueued) {
    await prisma.submissionReply
      .update({
        where: { id: reply.id },
        data: {
          deliveryStatus: "failed",
          failedAt: new Date(),
          errorMsg: "enqueue_failed (file d'envoi indisponible)",
        },
      })
      .catch((e) => Sentry.captureException(e));
    return { ok: false, error: "enqueue_failed" };
  }

  revalidatePath(adminPath("fr", `contacts/messages/${reply.submissionId}`));
  return { ok: true };
}

// ============================================================
// getReplyDeliveryStatusAction — polling léger du statut réel d'envoi
// (le worker met à jour deliveryStatus de façon asynchrone). Sert au
// ReplyComposer pour afficher « Réponse envoyée ✓ » ou l'erreur. Ne renvoie
// JAMAIS de PII.
// ============================================================

export type ReplyDeliveryStatus = "pending" | "sent" | "delivered" | "failed" | "bounced";

export async function getReplyDeliveryStatusAction(replyId: string): Promise<{
  status: ReplyDeliveryStatus;
  errorMsg: string | null;
  retryCount: number;
} | null> {
  try {
    await requireAdminWriteSession();
  } catch {
    return null;
  }
  const parsed = z.string().min(1).max(64).safeParse(replyId);
  if (!parsed.success) return null;

  const reply = await prisma.submissionReply.findUnique({
    where: { id: parsed.data },
    select: { deliveryStatus: true, errorMsg: true, retryCount: true },
  });
  if (!reply) return null;

  return {
    status: reply.deliveryStatus as ReplyDeliveryStatus,
    errorMsg: reply.errorMsg,
    retryCount: reply.retryCount,
  };
}
