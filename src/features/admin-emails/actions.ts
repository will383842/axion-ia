"use server";

// Rejouer un envoi en échec depuis le journal — lot 3 (2026-09-02).
//
// Le journal n'enregistre pas le contenu (ni sujet, ni variables) : il ne
// peut pas ré-émettre un e-mail lui-même. Mais BullMQ garde le job en échec
// (`removeOnFail: 5 000`), avec son gabarit et ses variables. On lui demande
// de le REPRENDRE : même destinataire, même contenu, journal repassé « en
// attente » pour que la clôture du worker le trouve.
//
// Avant : une ligne « Échec » était terminale à l'écran. Une clé SMTP périmée
// un vendredi soir laissait quarante lignes à ré-émettre à la main le lundi,
// déclencheur métier par déclencheur métier.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { emailsQueue } from "@/server/queue/queues";

const schema = z.object({ id: z.string().uuid() });

export type ResultatRenvoi = { ok: true; jobId: string } | { ok: false; error: string };

export async function renvoyerEmailAction(input: { id: string }): Promise<ResultatRenvoi> {
  await requireAdminWrite();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Identifiant invalide." };

  const ligne = await prisma.emailLog.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true, jobId: true, template: true, recipient: true },
  });
  if (!ligne) return { ok: false, error: "Ligne introuvable." };
  if (ligne.status !== "failed") {
    return { ok: false, error: "Seul un envoi en échec se rejoue." };
  }
  if (!ligne.jobId) {
    return {
      ok: false,
      error: "Cet envoi n'a pas d'identifiant de job : le ré-émettre depuis son écran d'origine.",
    };
  }
  if (!emailsQueue) {
    return { ok: false, error: "La file d'envoi est injoignable (Redis)." };
  }

  const job = await emailsQueue.getJob(ligne.jobId);
  if (!job) {
    return {
      ok: false,
      error:
        "Le job a été purgé de la file (rétention BullMQ dépassée) : le ré-émettre depuis son écran d'origine.",
    };
  }
  const etat = await job.getState();
  if (etat !== "failed") {
    return { ok: false, error: `Le job est « ${etat} », pas en échec : rien à rejouer.` };
  }

  await job.retry();
  // La ligne repasse « en attente » : le worker la clôturera (« envoyé » ou,
  // après ses nouveaux essais, « échec ») par `jobId`, sans en créer une autre.
  await prisma.emailLog.update({
    where: { id: ligne.id },
    data: { status: "pending", failedAt: null },
  });
  console.warn(
    `[admin-emails] renvoi demandé : ${ligne.template} → ${ligne.recipient} (job ${ligne.jobId})`,
  );
  revalidatePath("/fr/[adminPrefix]/emails-envoyes", "page");
  return { ok: true, jobId: ligne.jobId };
}

/**
 * Variante pour un `<form action>` de composant serveur : une action de
 * formulaire ne rend rien. Le motif d'un refus part dans le journal du serveur ;
 * l'écran, lui, se recharge et montre la ligne telle qu'elle est.
 */
export async function renvoyerEmailActionFormulaire(id: string): Promise<void> {
  const r = await renvoyerEmailAction({ id });
  if (!r.ok) console.warn(`[admin-emails] renvoi refusé (${id}) : ${r.error}`);
}
