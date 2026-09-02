/**
 * Journal des envois — écriture (audit du 2026-08-16).
 *
 * ## Le défaut que ce module corrige
 *
 * `EmailLogStatus` porte trois valeurs — `pending`, `sent`, `failed` — et
 * `pending` n'était **jamais écrit**. Le worker créait la ligne à l'issue de la
 * tentative, donc un job enfilé mais jamais consommé — worker mort, Redis
 * coupé, relais SMTP refusant l'authentification au point de bloquer la file —
 * ne laissait **aucune trace**.
 *
 * Conséquence exacte : la page « E-mails envoyés » affichait « 0 échec », ce
 * qui est rigoureusement indistinguable de « aucun e-mail à envoyer ». Le
 * tableau de bord ne pouvait pas voir la panne qu'il existe pour montrer.
 *
 * La ligne est donc posée à L'ENFILAGE, et le worker la CLÔT. Une ligne restée
 * `pending` au-delà de quelques minutes est le signal d'une chaîne rompue —
 * c'est ce que `health.ts` surveille.
 *
 * ## Fail-soft, sans exception
 *
 * Aucune fonction de ce module ne lève. Une panne d'écriture du journal ne doit
 * jamais empêcher un e-mail de partir, ni transformer un envoi réussi en retry
 * (ce qui enverrait l'e-mail deux fois). On journalise l'échec de journalisation
 * en console, et on continue.
 */

import { prisma } from "@/lib/prisma";
import { EmailLogStatus } from "../../../prisma/generated/client";
import type { Locale } from "../../../prisma/generated/client";

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

export interface EntreeJournal {
  template: string;
  recipient: string;
  locale: Locale;
  marketing: boolean;
  jobId?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
}

/**
 * Pose la ligne `pending` au moment de l'enfilage.
 *
 * ⚠️ Garde anti-doublon sur `jobId`. `enqueueEmail` passe un `jobId` stable
 * pour toute la chaîne Qualiopi (`qualiopi-convocation-{id}-{date}`), et BullMQ
 * IGNORE un `add()` portant un jobId déjà connu — c'est le mécanisme
 * d'idempotence. Sans cette garde, chaque passage de cron déposerait une ligne
 * `pending` fantôme pour un job qui n'a jamais été réenfilé, et la surveillance
 * de `health.ts` crierait sur son propre bruit.
 */
export async function journaliserEnAttente(entree: EntreeJournal): Promise<void> {
  if (estStub()) return;
  try {
    if (entree.jobId !== undefined) {
      const existante = await prisma.emailLog.findFirst({
        where: { jobId: entree.jobId },
        select: { id: true },
      });
      if (existante) return;
    }
    await prisma.emailLog.create({
      data: {
        template: entree.template,
        recipient: entree.recipient,
        locale: entree.locale,
        marketing: entree.marketing,
        attempts: 0,
        status: EmailLogStatus.pending,
        ...(entree.entityType ? { entityType: entree.entityType } : {}),
        ...(entree.entityId ? { entityId: entree.entityId } : {}),
        ...(entree.jobId ? { jobId: entree.jobId } : {}),
      },
    });
  } catch (e) {
    console.error(
      `[email-log] écriture « en attente » impossible (${entree.template} → ${entree.recipient}) :`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

/**
 * Tentative ratée NON définitive (lot 2) : la ligne reste « en attente », on y
 * note la tentative et le motif. Le statut « échec » est réservé au dernier
 * essai — `cloturerJournal`.
 */
export async function noterTentativeEchouee(
  tentative: EntreeJournal & { attempts: number; error: string },
): Promise<void> {
  if (estStub()) return;
  if (tentative.jobId === undefined) return;
  try {
    await prisma.emailLog.updateMany({
      where: { jobId: tentative.jobId, status: EmailLogStatus.pending },
      data: { attempts: tentative.attempts, error: tentative.error },
    });
  } catch (e) {
    console.error(
      `[email-log] tentative ratée non consignée (${tentative.template} → ${tentative.recipient}) :`,
      e instanceof Error ? e.message : String(e),
    );
  }
}

export interface ClotureJournal extends EntreeJournal {
  attempts: number;
  status: typeof EmailLogStatus.sent | typeof EmailLogStatus.failed;
  providerMessageId?: string | undefined;
  error?: string | undefined;
  sentAt?: Date | undefined;
  failedAt?: Date | undefined;
}

/**
 * Clôt la ligne d'un envoi : `pending` → `sent` / `failed`.
 *
 * Si aucune ligne en attente ne correspond, on en CRÉE une. Trois cas réels le
 * justifient, et ils sont tous normaux :
 *   - une nouvelle tentative (la ligne de la tentative précédente est déjà
 *     close) → on conserve ainsi une ligne par tentative, comme avant ;
 *   - la course entre l'enfilage et un worker très rapide ;
 *   - les jobs enfilés AVANT ce correctif, qui n'ont pas de ligne `pending`.
 */
export async function cloturerJournal(cloture: ClotureJournal): Promise<void> {
  if (estStub()) return;

  const donnees = {
    attempts: cloture.attempts,
    status: cloture.status,
    ...(cloture.providerMessageId ? { providerMessageId: cloture.providerMessageId } : {}),
    ...(cloture.error ? { error: cloture.error } : {}),
    ...(cloture.sentAt ? { sentAt: cloture.sentAt } : {}),
    ...(cloture.failedAt ? { failedAt: cloture.failedAt } : {}),
  };

  try {
    if (cloture.jobId !== undefined) {
      // Lot 2 : on clôt la ligne du job quel que soit son état intermédiaire
      // (« en attente » avec tentatives comptées), jamais une ligne déjà
      // « envoyé » — un succès ne se réécrit pas.
      const maj = await prisma.emailLog.updateMany({
        where: { jobId: cloture.jobId, status: { not: EmailLogStatus.sent } },
        data: donnees,
      });
      if (maj.count > 0) return;
    }
    await prisma.emailLog.create({
      data: {
        template: cloture.template,
        recipient: cloture.recipient,
        locale: cloture.locale,
        marketing: cloture.marketing,
        ...donnees,
        ...(cloture.entityType ? { entityType: cloture.entityType } : {}),
        ...(cloture.entityId ? { entityId: cloture.entityId } : {}),
        ...(cloture.jobId ? { jobId: cloture.jobId } : {}),
      },
    });
  } catch (e) {
    console.error(
      `[email-log] clôture impossible (${cloture.template} → ${cloture.recipient}) :`,
      e instanceof Error ? e.message : String(e),
    );
  }
}
