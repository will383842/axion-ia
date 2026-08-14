/**
 * Synchro CRM — REJEU manuel d'une ligne d'outbox en erreur (lot L5).
 *
 * Le seul geste d'écriture de la carte d'observabilité, et il est délibérément
 * minuscule : remettre une ligne en file. Il ne reconstruit rien, ne corrige
 * rien, ne devine rien — le corps déjà sérialisé repart tel quel.
 *
 * ── Pourquoi remettre `attempts` à zéro ─────────────────────────────────────
 * Une ligne `gave_up` a, par définition, épuisé son plafond. La laisser à 8
 * ferait re-basculer en abandon dès le premier échec suivant, et le bouton
 * n'aurait servi à rien : un rejeu humain rouvre le crédit de tentatives,
 * sinon ce n'est pas un rejeu.
 *
 * ── INERTIE ─────────────────────────────────────────────────────────────────
 * Drapeau `CRM_SYNC_ENABLED` à OFF ⇒ l'action REFUSE, avec un message qui dit
 * pourquoi. Elle n'écrit rien et n'enfile rien : la console n'est pas une porte
 * dérobée pour allumer la synchro.
 */

"use server";

import { revalidatePath } from "next/cache";

import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { isCrmSyncEnabled } from "@/server/crm-sync/config";
import { requireAdminPublish } from "@/server/actions/knowledge/_guards";
import { crmSyncQueue } from "@/server/queue/queues";

type ActionResult<T> = { data: T } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function rejouerLigneCrmSyncAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  await requireAdminPublish();

  if (!UUID.test(input.id)) return { error: "Identifiant de ligne invalide." };

  if (!isCrmSyncEnabled()) {
    return {
      error: "La synchro CRM est désactivée (CRM_SYNC_ENABLED). Aucun rejeu n'est possible.",
    };
  }

  const row = await prisma.crmSyncOutbox.findUnique({
    where: { id: input.id },
    select: { id: true, status: true },
  });
  if (!row) return { error: "Ligne introuvable." };
  if (row.status === "sent") {
    return { error: "Cette ligne a déjà été acquittée par le CRM — rien à rejouer." };
  }

  await prisma.crmSyncOutbox.update({
    where: { id: row.id },
    data: { status: "pending", nextAttemptAt: null, attempts: 0, lastError: null },
  });

  // `jobId` HORODATÉ : le job d'origine (`crm-sync-emit-<id>`) peut encore
  // exister dans Redis, et BullMQ ignore silencieusement un ajout portant un
  // identifiant déjà connu. Sans ce suffixe, le bouton semblerait fonctionner
  // sans que rien ne parte — exactement le genre de panne muette qu'on traque.
  try {
    await crmSyncQueue?.add(
      "emit",
      { type: "emit", outboxId: row.id },
      { jobId: `crm-sync-emit-${row.id}-${Date.now()}` },
    );
  } catch (error) {
    // La ligne est déjà repassée en `pending` : le balayage des 10 minutes la
    // reprendra de toute façon. On le dit plutôt que de faire échouer le geste.
    console.error("[crm-sync] mise en file du rejeu échouée (le balayage reprendra):", error);
  }

  revalidatePath(adminPath("fr", "synchro-crm"));
  return { data: { id: row.id } };
}
