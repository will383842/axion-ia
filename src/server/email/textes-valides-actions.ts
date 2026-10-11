"use server";

/**
 * Acte « valider un texte d'e-mail » (FAC-1).
 *
 * Réservé au super-admin (`estSuperAdmin`, SSOT `auth/habilitations.ts`) :
 * c'est Will qui relit et arrête les textes. Écriture et journal dans la MÊME
 * transaction ; jamais de `targetId` (colonne `uuid`) — la clé va dans
 * `changes.cle`.
 */

import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { estSuperAdmin } from "@/server/auth/habilitations";

import { cleTexteValide, estNomValide, lireValidation } from "./textes-valides";

export type EtatValidation = { ok: true; message: string } | { ok: false; error: string };

export async function validerTexteEmailAction(d: {
  gabarit: string;
  variante?: string;
  valide: boolean;
}): Promise<EtatValidation> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  if (!estSuperAdmin(role)) {
    return {
      ok: false,
      error: "Valider les textes des e-mails est réservé à la direction (super-admin).",
    };
  }
  if (!estNomValide(d.gabarit) || (d.variante !== undefined && !estNomValide(d.variante))) {
    return { ok: false, error: "Gabarit inconnu." };
  }
  if (typeof d.valide !== "boolean") return { ok: false, error: "Valeur invalide." };
  const cle = cleTexteValide(d.gabarit, d.variante);
  const userId = session.user.id;
  const valide = d.valide;
  try {
    await prisma.$transaction(async (tx) => {
      const avant = lireValidation(
        (await tx.setting.findUnique({ where: { key: cle }, select: { value: true } }))?.value,
      );
      await tx.setting.upsert({
        where: { key: cle },
        create: {
          key: cle,
          value: { valide } as never,
          description: "E-mails › Texte validé par la direction",
          updatedBy: userId,
        },
        update: { value: { valide } as never, updatedBy: userId },
      });
      await tx.activityLog.create({
        data: {
          adminUserId: userId,
          action: valide ? "email.texte_valide" : "email.texte_invalide",
          targetType: "setting",
          changes: { cle, avant, apres: valide } as never,
        },
      });
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "validerTexteEmail" } });
    return {
      ok: false,
      error: "Le changement n'a pas été enregistré (erreur technique). Réessayez plus tard.",
    };
  }
  return { ok: true, message: valide ? "Texte validé." : "Validation retirée." };
}
