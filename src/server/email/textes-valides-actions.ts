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
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { getClientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { estSuperAdmin } from "@/server/auth/habilitations";

import {
  cleDuTexte,
  estTexteFormateurAValider,
  TEXTES_FORMATEURS_A_VALIDER,
} from "./textes-formateurs-a-valider";
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
  if (!d || typeof d !== "object") return { ok: false, error: "Champs invalides." };
  if (!estNomValide(d.gabarit) || (d.variante !== undefined && !estNomValide(d.variante))) {
    return { ok: false, error: "Gabarit inconnu." };
  }
  if (typeof d.valide !== "boolean") return { ok: false, error: "Valeur invalide." };
  const cle = cleTexteValide(d.gabarit, d.variante);
  const userId = session.user.id;
  const valide = d.valide;
  const ip = await getClientIp();
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
          ipAddress: ip,
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

/** Les deux pages de l'écran des gabarits (préfixe d'administration dynamique). */
function rafraichirGabarits(): void {
  revalidatePath("/[locale]/(admin)/[adminPrefix]/emails/gabarits", "layout");
}

/**
 * M1 (lot A) — le bouton de la page d'aperçu d'un gabarit : valider, ou retirer la
 * validation, d'UN texte formateur (gabarit ou variante). Même acte que
 * `validerTexteEmailAction`, limité aux textes que l'écran propose.
 */
export async function validerTexteEmailFormAction(
  _prev: EtatValidation,
  formData: FormData,
): Promise<EtatValidation> {
  const gabarit = formData.get("gabarit");
  const brute = formData.get("variante");
  const variante = typeof brute === "string" && brute !== "" ? brute : undefined;
  const valide = formData.get("valide");
  if (typeof gabarit !== "string" || (valide !== "1" && valide !== "0")) {
    return { ok: false, error: "Champs invalides." };
  }
  if (!estTexteFormateurAValider(gabarit, variante)) {
    return { ok: false, error: "Ce texte ne se valide pas depuis cet écran." };
  }
  const r = await validerTexteEmailAction({
    gabarit,
    ...(variante !== undefined ? { variante } : {}),
    valide: valide === "1",
  });
  if (r.ok) rafraichirGabarits();
  return r;
}

/**
 * M1 (lot A) — « Valider tous les textes formateurs d'un coup ».
 *
 * Super-admin seul. Deux garde-fous côté serveur : la case de confirmation cochée, et
 * le NOMBRE de textes affiché à l'écran (une liste qui aurait changé entre l'affichage
 * et le clic — un texte neuf déployé entre-temps — refuse : on ne valide pas ce qu'on
 * n'a pas vu). Seuls les textes pas encore validés sont écrits ; UNE ligne de journal,
 * sans `targetId`, porte les clés écrites.
 */
export async function validerTousTextesFormateursAction(
  _prev: EtatValidation,
  formData: FormData,
): Promise<EtatValidation> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session expirée." };
  const role = (session.user as { role?: string }).role;
  if (!estSuperAdmin(role)) {
    return {
      ok: false,
      error: "Valider les textes des e-mails est réservé à la direction (super-admin).",
    };
  }
  if (formData.get("confirme") !== "oui") {
    return { ok: false, error: "Cochez la case de confirmation : rien n'a été validé." };
  }
  if (formData.get("nombre") !== String(TEXTES_FORMATEURS_A_VALIDER.length)) {
    return {
      ok: false,
      error: "La liste des textes a changé depuis l'affichage : rechargez la page et relisez-la.",
    };
  }
  const cles = TEXTES_FORMATEURS_A_VALIDER.map(cleDuTexte);
  const userId = session.user.id;
  const ip = await getClientIp();
  let ecrites: string[] = [];
  try {
    ecrites = await prisma.$transaction(async (tx) => {
      const lignes = await tx.setting.findMany({
        where: { key: { in: cles } },
        select: { key: true, value: true },
      });
      const deja = new Set(lignes.filter((l) => lireValidation(l.value)).map((l) => l.key));
      const aEcrire = cles.filter((c) => !deja.has(c));
      for (const cle of aEcrire) {
        await tx.setting.upsert({
          where: { key: cle },
          create: {
            key: cle,
            value: { valide: true } as never,
            description: "E-mails › Texte validé par la direction",
            updatedBy: userId,
          },
          update: { value: { valide: true } as never, updatedBy: userId },
        });
      }
      if (aEcrire.length > 0) {
        await tx.activityLog.create({
          data: {
            adminUserId: userId,
            action: "email.textes_formateurs_valides",
            targetType: "setting",
            ipAddress: ip,
            changes: { nombre: aEcrire.length, cles: aEcrire } as never,
          },
        });
      }
      return aEcrire;
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "validerTousTextesFormateurs" } });
    return {
      ok: false,
      error: "Le changement n'a pas été enregistré (erreur technique). Réessayez plus tard.",
    };
  }
  rafraichirGabarits();
  return {
    ok: true,
    message:
      ecrites.length === 0
        ? "Tous ces textes étaient déjà validés."
        : `${ecrites.length} texte${ecrites.length > 1 ? "s" : ""} validé${ecrites.length > 1 ? "s" : ""}.`,
  };
}
