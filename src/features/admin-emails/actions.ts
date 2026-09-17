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
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logQualiopiActivity, requireAdminWrite } from "@/server/actions/qualiopi/_guards";
import { emailsQueue } from "@/server/queue/queues";
import { PLAFOND_RENVOI_LOT, FENETRE_RENVOI_JOURS } from "./query";

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
 * Variante pour un `<form action>` de composant serveur.
 *
 * 🔴 2026-09-17 — ELLE AVALAIT LE MOTIF DU REFUS. La version précédente
 * écrivait `console.warn` et rendait `void` : l'écran se rechargeait à
 * l'identique, la ligne restait « Échec », et l'admin ne pouvait pas distinguer
 * « j'ai cliqué et ça a marché » de « le job a été purgé de la file ». Un geste
 * dont le résultat n'est visible que dans un journal de conteneur n'est pas un
 * geste : c'est un bouton décoratif.
 *
 * Le résultat repart désormais dans l'URL, et l'écran l'affiche en clair.
 */
export async function renvoyerEmailActionFormulaire(
  adminPrefix: string,
  id: string,
): Promise<void> {
  const r = await renvoyerEmailAction({ id });
  const base = `/fr/${encodeURIComponent(adminPrefix)}/emails-envoyes`;
  redirect(
    r.ok
      ? `${base}?renvoi=ok&n=1`
      : `${base}?renvoi=erreur&motif=${encodeURIComponent(r.error.slice(0, 200))}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Renvoi EN LOT — remettre à la poste ce qui est resté à quai
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clé du verrou consultatif Postgres (paire arbitraire stable, propre au renvoi
 * d'e-mails — distincte de celle du seed du référentiel).
 */
const VERROU_RENVOI: readonly [number, number] = [4242, 7];

export type ResultatRenvoiLot =
  | { ok: true; renvoyes: number; destinataires: number; irrecuperables: number }
  | { ok: false; error: string };

const schemaLot = z.object({
  /**
   * 🔴 CONFIRMATION EXPLICITE, et elle n'est pas décorative : ce bouton écrit à
   * des personnes réelles. L'action REFUSE tant que ce champ ne vaut pas
   * exactement « oui » — un `<form>` posté à la main, un double-clic sur un
   * lien, un rejeu de requête ne peuvent pas la fabriquer par accident.
   */
  confirmation: z.literal("oui"),
  /**
   * Le nombre que l'utilisateur AVAIT SOUS LES YEUX en cliquant.
   *
   * 🔑 On n'en renvoie jamais plus. Si trois échecs de plus sont tombés entre
   * l'affichage et le clic, ils attendront le prochain geste : envoyer plus que
   * ce qui a été montré, c'est agir au-delà du consentement obtenu.
   */
  attendus: z.number().int().min(1).max(PLAFOND_RENVOI_LOT),
});

/**
 * Renvoie en une fois les e-mails restés en échec.
 *
 * ## Anti-doublon — pourquoi un verrou ET une revendication
 *
 * Deux administrateurs qui cliquent à la même seconde, ou un double-clic sur un
 * réseau lent, rejoueraient chacun les mêmes jobs : la même convocation
 * partirait deux fois à la même personne. Deux garanties, superposées :
 *
 *  1. `pg_try_advisory_xact_lock` — un seul renvoi en lot à la fois, sur toute
 *     l'application. Le second n'attend pas, il est refusé avec un motif lisible
 *     (attendre rendrait le double-clic silencieusement destructeur au lieu de
 *     bruyamment refusé) ;
 *  2. la REVENDICATION — dans la même transaction, les lignes retenues passent
 *     de `failed` à `pending`. Un second passage ne les voit donc plus comme des
 *     échecs, même après libération du verrou. C'est cette écriture-là qui tient
 *     l'idempotence dans la durée ; le verrou ne tient que l'instant.
 *
 * Les jobs BullMQ sont repris APRÈS le commit : un `retry()` n'est pas
 * annulable par un rollback, donc il ne doit jamais avoir lieu avant que la
 * revendication soit acquise. Une ligne dont le job ne peut pas être repris est
 * remise en `failed` avec le motif — jamais laissée en `pending`, ce qui la
 * ferait passer pour un envoi en cours qui n'arrivera jamais.
 */
export async function renvoyerEchecsEnLotAction(input: {
  confirmation: string;
  attendus: number;
}): Promise<ResultatRenvoiLot> {
  const session = await requireAdminWrite();

  const parsed = schemaLot.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Renvoi non confirmé : cochez la case avant de renvoyer.",
    };
  }
  if (!emailsQueue) {
    return { ok: false, error: "La file d'envoi est injoignable (Redis) : rien n'a été renvoyé." };
  }

  const depuis = new Date(Date.now() - FENETRE_RENVOI_JOURS * 24 * 3600_000);

  const revendiquees = await prisma.$transaction(async (tx) => {
    // ⚠️ Postgres n'expose `pg_try_advisory_xact_lock` qu'en `(bigint)` ou
    // `(int4, int4)` ; Prisma binde les nombres JS en bigint, d'où le cast.
    const [verrou] = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${VERROU_RENVOI[0]}::int4, ${VERROU_RENVOI[1]}::int4) AS locked
    `;
    if (!verrou?.locked) return null;

    const candidates = await tx.emailLog.findMany({
      where: { status: "failed", jobId: { not: null }, failedAt: { gte: depuis } },
      orderBy: { failedAt: "desc" },
      take: parsed.data.attendus,
      select: { id: true, jobId: true, template: true, recipient: true },
    });
    if (candidates.length === 0) return [];

    await tx.emailLog.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { status: "pending", failedAt: null },
    });
    return candidates;
  });

  if (revendiquees === null) {
    return { ok: false, error: "Un renvoi est déjà en cours : patientez quelques secondes." };
  }
  if (revendiquees.length === 0) {
    return { ok: false, error: "Plus aucun envoi en échec à renvoyer." };
  }

  let renvoyes = 0;
  const irrecuperables: Array<{ id: string; motif: string }> = [];
  for (const ligne of revendiquees) {
    try {
      const job = await emailsQueue.getJob(ligne.jobId as string);
      if (!job) {
        irrecuperables.push({ id: ligne.id, motif: "Job purgé de la file (rétention dépassée)." });
        continue;
      }
      const etat = await job.getState();
      if (etat !== "failed") {
        irrecuperables.push({ id: ligne.id, motif: `Job « ${etat} » côté file, pas en échec.` });
        continue;
      }
      await job.retry();
      renvoyes += 1;
    } catch (e) {
      irrecuperables.push({
        id: ligne.id,
        motif: `Reprise impossible : ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // Les lignes qu'on n'a pas su reprendre RETOURNENT en échec. Les laisser en
  // « en attente » les ferait passer pour des envois en cours, et elles
  // disparaîtraient du seul écran qui les montre.
  for (const ko of irrecuperables) {
    await prisma.emailLog
      .update({
        where: { id: ko.id },
        data: { status: "failed", failedAt: new Date(), error: ko.motif.slice(0, 500) },
      })
      .catch(() => undefined);
  }

  const destinataires = new Set(revendiquees.map((l) => l.recipient.trim().toLowerCase())).size;

  await logQualiopiActivity({
    session,
    action: "emails.renvoi_en_lot",
    targetType: "qualiopi.email_log",
    changes: {
      demandes: revendiquees.length,
      renvoyes,
      irrecuperables: irrecuperables.length,
      destinatairesDistincts: destinataires,
      // Pas d'adresses : le registre d'activité n'est pas un carnet d'adresses.
      gabarits: [...new Set(revendiquees.map((l) => l.template))],
    },
  });

  revalidatePath("/fr/[adminPrefix]/emails-envoyes", "page");
  return { ok: true, renvoyes, destinataires, irrecuperables: irrecuperables.length };
}

/** Variante `<form action>` : le résultat repart dans l'URL, pas dans un log. */
export async function renvoyerEchecsEnLotFormulaire(
  adminPrefix: string,
  formData: FormData,
): Promise<void> {
  const r = await renvoyerEchecsEnLotAction({
    confirmation: String(formData.get("confirmation") ?? ""),
    attendus: Number(formData.get("attendus") ?? 0),
  });
  const base = `/fr/${encodeURIComponent(adminPrefix)}/emails-envoyes`;
  redirect(
    r.ok
      ? `${base}?renvoi=lot&n=${r.renvoyes}&d=${r.destinataires}&ko=${r.irrecuperables}`
      : `${base}?renvoi=erreur&motif=${encodeURIComponent(r.error.slice(0, 200))}`,
  );
}
