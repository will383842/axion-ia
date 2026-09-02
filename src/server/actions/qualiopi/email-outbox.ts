/**
 * Qualiopi — Server Actions : corbeille de validation des emails (F60).
 *
 * Approuver un email l'envoie RÉELLEMENT. C'est la seule action de ce fichier
 * qui produit un effet visible par un tiers, et elle est irréversible : un email
 * parti ne se rappelle pas. D'où deux précautions :
 *   - `requireAdminWrite()` comme partout, mais surtout une transition d'état
 *     STRICTE — on ne peut approuver que depuis `a_valider`, jamais depuis
 *     `envoye`. Sans ça, un double-clic enverrait deux fois le même message ;
 *   - `bypassValidation: true` à la remise en file, sinon l'email approuvé
 *     retomberait dans la corbeille et bouclerait indéfiniment.
 *
 * Pattern EXACT des autres actions Qualiopi : requireAdminWrite + Zod safeParse
 * + ActionResult<T> + logQualiopiActivity.
 */

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";

type ActionResult<T> = { data: T } | { error: string };

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

const approuverSchema = z.object({
  id: z.string().uuid(),
  /** Sujet éventuellement corrigé par l'admin. Vide = on garde celui d'origine. */
  sujet: z.string().trim().min(1).max(300).optional(),
  /** Bloc de texte libre inséré dans le corps. Vide = aucun ajout. */
  messagePersonnalise: z.string().trim().max(4000).optional(),
});

/**
 * Approuve un email en attente ET l'envoie.
 *
 * La mise à jour conditionnelle (`updateMany` sur `statut: "a_valider"`) sert de
 * verrou : si deux onglets approuvent en même temps, le second ne trouve plus la
 * ligne dans l'état attendu et s'arrête sans réenvoyer.
 */
export async function approuverEmailAction(
  input: z.infer<typeof approuverSchema>,
): Promise<ActionResult<{ id: string; envoye: boolean }>> {
  if (estStub()) return { error: "Indisponible pendant le build" };
  const session = await requireAdminWrite();
  const parsed = approuverSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  const email = await prisma.emailOutbox.findUnique({
    where: { id: v.id },
    select: {
      id: true,
      template: true,
      recipient: true,
      locale: true,
      payload: true,
      sujet: true,
      statut: true,
      clientId: true,
      entityType: true,
      entityId: true,
      attachments: true,
    },
  });
  if (!email) return { error: "Email introuvable" };
  if (email.statut !== "a_valider") {
    return { error: `Cet email a déjà été traité (statut : ${email.statut}).` };
  }

  // Verrou : seule la première approbation passe.
  const verrou = await prisma.emailOutbox.updateMany({
    where: { id: v.id, statut: "a_valider" },
    data: {
      statut: "approuve",
      approuveAt: new Date(),
      approuveById: session.userId,
      ...(v.sujet !== undefined ? { sujet: v.sujet } : {}),
      ...(v.messagePersonnalise !== undefined
        ? { messagePersonnalise: v.messagePersonnalise }
        : {}),
    },
  });
  if (verrou.count === 0) {
    return { error: "Cet email vient d'être traité par ailleurs." };
  }

  // Le message personnalisé rejoint la charge utile : c'est le template qui
  // décide où l'insérer, pas cette action.
  const payload = {
    ...((email.payload as Record<string, unknown>) ?? {}),
    ...(v.messagePersonnalise ? { messagePersonnalise: v.messagePersonnalise } : {}),
  };

  const attachments = Array.isArray(email.attachments)
    ? (email.attachments as Array<{ filename: string; r2Key: string; contentType?: string }>)
    : undefined;

  // `enqueueEmail` peut lever (Redis coupé en cours d'appel) : sans ce filet, la
  // ligne resterait en `approuve` — le même tombeau, par une autre porte.
  let res: { enqueued: boolean; retenu?: "rebond_dur" | "desabonne" };
  try {
    res = await enqueueEmail(
      email.template as EmailJobName,
      email.recipient,
      email.locale === "en" ? "en" : "fr",
      payload,
      {
        // 🔴 INDISPENSABLE : sans lui, l'email approuvé serait re-garé et la
        // corbeille se remplirait d'elle-même à l'infini.
        bypassValidation: true,
        ...(email.entityType ? { entityType: email.entityType } : {}),
        ...(email.entityId ? { entityId: email.entityId } : {}),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      },
    );
  } catch {
    await prisma.emailOutbox.updateMany({
      where: { id: v.id, statut: "approuve" },
      data: { statut: "a_valider", approuveAt: null, approuveById: null },
    });
    return { error: "L'envoi a échoué : l'email est retourné dans la corbeille, réessayez." };
  }

  // 🔴 Contre-vérification 2026-07-26. La transition `a_valider → approuve` est
  // commitée AVANT la mise en file. Si celle-ci échoue — Redis injoignable —
  // la ligne restait bloquée en `approuve` : invisible de la liste « en
  // attente », invisible de « traités », ré-approbation refusée, refus
  // impossible, aucun sweeper. Un état TOMBEAU : l'email n'était ni envoyé, ni
  // garé, ni rejouable.
  //
  // On remet donc en `a_valider` : l'email retourne dans la corbeille, l'admin
  // le voit et peut réessayer. Perdre un email en silence est le seul défaut
  // qu'une corbeille de validation n'a pas le droit d'avoir.
  if (res.enqueued) {
    await prisma.emailOutbox.update({
      where: { id: v.id },
      data: { statut: "envoye", envoyeAt: new Date() },
    });
  } else if (res.retenu !== undefined) {
    // 🔴 2026-09-02 — liste de suppression. L'adresse a rebondi dur (ou la
    // personne s'est désabonnée d'un envoi marketing) : renvoyer l'email en
    // corbeille sans un mot ferait ré-approuver le même envoi vers la même
    // adresse morte, indéfiniment. On le REFUSE, avec le motif écrit là où
    // l'admin le lira, et on le lui dit tout de suite.
    const motif =
      res.retenu === "rebond_dur"
        ? `Envoi retenu automatiquement : cette adresse a déjà rebondi définitivement (rebond dur). ` +
          `Corriger l'adresse dans la fiche du client, puis ré-émettre l'envoi depuis son écran d'origine.`
        : `Envoi retenu automatiquement : cette personne s'est désabonnée des envois marketing.`;
    await prisma.emailOutbox.updateMany({
      where: { id: v.id, statut: "approuve" },
      data: { statut: "refuse", refuseAt: new Date(), refuseMotif: motif },
    });
    return { error: motif };
  } else {
    await prisma.emailOutbox.updateMany({
      where: { id: v.id, statut: "approuve" },
      data: { statut: "a_valider", approuveAt: null, approuveById: null },
    });
  }

  await logQualiopiActivity({
    action: "email.outbox.approuver",
    targetType: "EmailOutbox",
    targetId: v.id,
    changes: {
      template: email.template,
      destinataire: email.recipient,
      sujetModifie: v.sujet !== undefined && v.sujet !== email.sujet,
      messageAjoute: Boolean(v.messagePersonnalise),
      envoye: res.enqueued,
    },
    session,
  });

  revalidatePath("/[locale]/(admin)/[adminPrefix]/qualiopi/emails", "page");
  return { data: { id: v.id, envoye: res.enqueued } };
}

const refuserSchema = z.object({
  id: z.string().uuid(),
  motif: z.string().trim().min(1).max(1000),
});

/**
 * Refuse un email : il ne partira jamais.
 *
 * Le motif est OBLIGATOIRE. Un refus sans raison est indistinguable d'un oubli
 * six mois plus tard, et c'est précisément ce qu'un auditeur demanderait sur une
 * relance non envoyée.
 */
export async function refuserEmailAction(
  input: z.infer<typeof refuserSchema>,
): Promise<ActionResult<{ id: string }>> {
  if (estStub()) return { error: "Indisponible pendant le build" };
  const session = await requireAdminWrite();
  const parsed = refuserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Un motif de refus est requis." };
  }
  const v = parsed.data;

  const res = await prisma.emailOutbox.updateMany({
    where: { id: v.id, statut: "a_valider" },
    data: { statut: "refuse", refuseAt: new Date(), refuseMotif: v.motif },
  });
  if (res.count === 0) return { error: "Cet email a déjà été traité." };

  await logQualiopiActivity({
    action: "email.outbox.refuser",
    targetType: "EmailOutbox",
    targetId: v.id,
    changes: { motif: v.motif },
    session,
  });

  revalidatePath("/[locale]/(admin)/[adminPrefix]/qualiopi/emails", "page");
  return { data: { id: v.id } };
}

const reglageSchema = z.object({
  scope: z.enum(["global", "client"]),
  clientId: z.string().uuid().nullable().optional(),
  /** `null` = la règle vaut pour toutes les natures d'email de cette portée. */
  template: z.string().max(60).nullable().optional(),
  mode: z.enum(["auto", "validation"]),
});

/**
 * Pose ou remplace une règle d'automatisation.
 *
 * `upsert` sur la clé (scope, clientId, template) : régler deux fois le même
 * périmètre doit corriger la règle, pas en empiler une seconde qui rendrait la
 * résolution non déterministe.
 */
export async function definirReglageEmailAction(
  input: z.infer<typeof reglageSchema>,
): Promise<ActionResult<{ id: string }>> {
  if (estStub()) return { error: "Indisponible pendant le build" };
  const session = await requireAdminWrite();
  const parsed = reglageSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const v = parsed.data;

  if (v.scope === "client" && !v.clientId) {
    return { error: "Un réglage par client exige de désigner le client." };
  }
  const clientId = v.scope === "client" ? (v.clientId ?? null) : null;
  const template = v.template ?? null;

  // `upsert` sur une clé composite dont deux membres sont nullables n'est pas
  // exprimable en Prisma 5 : le type d'entrée exige des non-null. On fait donc
  // le recherche-puis-écrit à la main. L'index unique
  // `NULLS NOT DISTINCT` reste la garantie d'unicité côté base — c'est lui qui
  // empêche deux règles concurrentes sur le même périmètre, pas ce code.
  const existante = await prisma.emailAutomationSetting.findFirst({
    where: { scope: v.scope, clientId, template },
    select: { id: true },
  });
  const ligne = existante
    ? await prisma.emailAutomationSetting.update({
        where: { id: existante.id },
        data: { mode: v.mode },
        select: { id: true },
      })
    : await prisma.emailAutomationSetting.create({
        data: { scope: v.scope, clientId, template, mode: v.mode },
        select: { id: true },
      });

  await logQualiopiActivity({
    action: "email.reglage.definir",
    targetType: "EmailAutomationSetting",
    targetId: ligne.id,
    changes: { scope: v.scope, clientId, template, mode: v.mode },
    session,
  });

  revalidatePath("/[locale]/(admin)/[adminPrefix]/qualiopi/emails", "page");
  return { data: { id: ligne.id } };
}

/** Retire une règle : le périmètre concerné retombe sur la règle plus générale. */
export async function supprimerReglageEmailAction(input: {
  id: string;
}): Promise<ActionResult<{ id: string }>> {
  if (estStub()) return { error: "Indisponible pendant le build" };
  const session = await requireAdminWrite();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };

  await prisma.emailAutomationSetting.delete({ where: { id: parsed.data.id } });
  await logQualiopiActivity({
    action: "email.reglage.supprimer",
    targetType: "EmailAutomationSetting",
    targetId: parsed.data.id,
    changes: {},
    session,
  });

  revalidatePath("/[locale]/(admin)/[adminPrefix]/qualiopi/emails", "page");
  return { data: { id: parsed.data.id } };
}
