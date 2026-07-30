/**
 * Révocation d'une signature — la seule correction possible sur un registre
 * append-only.
 *
 * ## Pourquoi cette action existe
 *
 * `revoquerSignatureDocument` était écrite, testée, gardée… et appelable par
 * personne. Or toute la conception du registre repose sur « append-only : une
 * correction passe par révocation puis nouvelle signature ». Sans surface
 * d'appel, cette phrase était une intention, pas un mécanisme : une signature
 * posée par erreur devenait DÉFINITIVE, et l'index unique partiel
 * `WHERE revoked_at IS NULL` — celui qui autorise précisément à re-signer — ne
 * pouvait jamais servir.
 *
 * ## Ce que cette action ne relâche pas
 *
 * Elle n'ajoute AUCUNE tolérance. Le service refuse toujours de révoquer un
 * maillon non terminal (cela romprait le chaînage et ferait apparaître le
 * registre comme falsifié), exige un motif non vide, et impute la révocation à
 * un compte habilité. Cette action ne fait que rendre ces règles atteignables.
 *
 * ⚠️ Aucune suppression, jamais. La ligne révoquée reste en base avec son
 * empreinte : une preuve retirée du décompte n'est pas une preuve effacée, et
 * c'est cette distinction qu'un auditeur vient vérifier.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  heuresReellesSignees,
  SEANCE_HEURES_SELECT,
  versSeancePourHeures,
} from "@/server/qualiopi/coaching-afest/heures";
import { requireAdminWrite, logQualiopiActivity } from "./_guards";
import { revoquerSignatureDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { revoquerSignatureSeance } from "@/server/qualiopi/coaching-afest/signature/signature-afest-service";

const schema = z.object({
  signatureId: z.string().uuid(),
  // Le CHECK de la base refuse un motif vide ; on le refuse plus tôt, avec un
  // message qui dit pourquoi plutôt qu'une violation de contrainte.
  motif: z.string().trim().min(1).max(500),
  /** Chemin à rafraîchir après coup. Validé : il ne vient pas de nulle part. */
  retour: z.string().startsWith("/").max(300),
});

/**
 * Codes de retour, transmis par l'URL.
 *
 * ⚠️ On transmet un CODE, jamais le message : un texte libre repris dans l'URL
 * et réaffiché est une injection en puissance, et une URL n'est pas un canal de
 * confiance. La page traduit le code en phrase.
 */
export type CodeRevocation = "ok" | "role_insuffisant" | "demande_invalide" | "refus_service";

/**
 * Révoque une signature depuis le registre auditeur.
 *
 * ⚠️ Signature d'un `<form action={…}>` classique : aucune ligne de JavaScript
 * côté client, le registre reste un Server Component pur. Un écran d'audit
 * consulté trois fois par an ne justifie pas un bundle.
 */
export async function revoquerSignatureAction(donneesFormulaire: FormData): Promise<void> {
  const session = await requireAdminWrite();
  // Retirer une preuve du dossier engage l'organisme autant que l'y verser :
  // même exigence de rôle que la signature elle-même. Le service revérifie.
  const retourBrut = donneesFormulaire.get("retour");
  const retour =
    typeof retourBrut === "string" && retourBrut.startsWith("/") && retourBrut.length <= 300
      ? retourBrut
      : // Repli sûr : jamais une redirection vers une valeur non validée.
        "/";

  if (session.role !== "super_admin" && session.role !== "admin") {
    redirect(`${retour}?revocation=role_insuffisant`);
  }

  const parse = schema.safeParse({
    signatureId: donneesFormulaire.get("signatureId"),
    motif: donneesFormulaire.get("motif"),
    retour: donneesFormulaire.get("retour"),
  });
  if (!parse.success) {
    redirect(`${retour}?revocation=demande_invalide`);
  }

  const res = await revoquerSignatureDocument({
    signatureId: parse.data.signatureId,
    motif: parse.data.motif,
    parAdminId: session.userId,
  });
  if (!res.ok) {
    // Le motif exact (maillon interne, déjà révoquée…) est journalisé ; l'URL
    // ne porte qu'un code, et la page invite à consulter le détail.
    Sentry.captureMessage("Révocation de signature refusée", {
      level: "warning",
      tags: { action: "revoquerSignatureAction", raison: res.raison },
      extra: { signatureId: parse.data.signatureId },
    });
    redirect(`${retour}?revocation=refus_service&raison=${res.raison}`);
  }

  await logQualiopiActivity({
    action: "qualiopi.signature.revocation",
    targetType: "DocumentSignature",
    targetId: parse.data.signatureId,
    changes: { motif: parse.data.motif },
    session,
  });
  Sentry.captureMessage("Signature révoquée", {
    level: "info",
    tags: { action: "revoquerSignatureAction" },
    extra: { signatureId: parse.data.signatureId },
  });

  revalidatePath(parse.data.retour);
  redirect(`${parse.data.retour}?revocation=ok`);
}

/**
 * Heures RETENUES pour un parcours, avec SON régime de preuve.
 *
 * 🔴 Le régime RÉEL, jamais un défaut : `legacy_boolean` et `signature_reelle`
 * ne comptent pas les mêmes séances, et se tromper de régime inscrirait un
 * « impact » faux au journal — pire que pas d'impact du tout.
 */
async function heuresDuParcours(coachingId: string): Promise<number | null> {
  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingId },
    select: { regimePreuve: true, comptesRendus: { select: SEANCE_HEURES_SELECT } },
  });
  if (cs === null) return null;
  return heuresReellesSignees(cs.comptesRendus.map(versSeancePourHeures), cs.regimePreuve);
}

/**
 * Révoque une signature d'émargement AFEST 1-to-1 (famille `CoachingSeanceSignature`).
 *
 * ## Pourquoi une SECONDE action plutôt qu'un paramètre `famille`
 *
 * Les trois familles de preuve ont chacune leur table, leur tuple et leur
 * version de hachage — c'est un choix assumé du socle : coupler leurs
 * révocations ferait qu'une évolution de l'une toucherait des lignes de l'autre,
 * déjà scellées. Un discriminant runtime aurait aussi ouvert la porte à un
 * appelant qui passe un `signatureId` d'AFEST avec la famille « document » : le
 * service aurait rendu `signature_introuvable`, et l'écran aurait affiché « cette
 * signature n'existe pas » sur une signature parfaitement existante.
 *
 * Le service appelé pose les mêmes gardes que son homologue : refus du maillon
 * NON TERMINAL (le révoquer romprait le chaînage et ferait apparaître le
 * registre comme falsifié), refus d'une ligne déjà révoquée, motif obligatoire.
 * Cette action ne relâche rien — elle rend ces règles atteignables.
 *
 * ⚠️ Aucune suppression, jamais. La ligne révoquée reste en base avec son
 * empreinte.
 *
 * ## 🔴 L'impact en HEURES est chiffré et journalisé
 *
 * Révoquer une signature de séance n'est pas un geste de registre isolé : en
 * régime `signature_reelle`, `heuresReellesSignees` ne compte QUE les séances
 * dont le bénéficiaire a signé. Retirer une signature retire donc des HEURES —
 * et les heures alimentent la facture, le BPF (R.6313-3), le certificat de
 * réalisation et l'attestation.
 *
 * Une correction légitime peut faire BAISSER un montant déjà appelé auprès d'un
 * OPCO ou de France Travail, ou rétrograder une attestation déjà remise. Ce
 * n'est pas une raison de l'interdire — c'est une raison de la RENDRE VISIBLE.
 * On mesure avant, on révoque, on mesure après, et on journalise l'écart.
 *
 * ⚠️ Cette action ne corrige AUCUNE pièce déjà émise, et ne prétend pas le
 * faire : elle dit ce qui a bougé. Reprendre une facture ou une attestation est
 * une décision, pas une conséquence mécanique.
 */
export async function revoquerSignatureSeanceAfestAction(
  donneesFormulaire: FormData,
): Promise<void> {
  const session = await requireAdminWrite();
  const retourBrut = donneesFormulaire.get("retour");
  const retour =
    typeof retourBrut === "string" && retourBrut.startsWith("/") && retourBrut.length <= 300
      ? retourBrut
      : "/";

  // Retirer une preuve du dossier engage l'organisme autant que l'y verser :
  // même exigence de rôle que pour la famille document.
  if (session.role !== "super_admin" && session.role !== "admin") {
    redirect(`${retour}?revocation=role_insuffisant`);
  }

  const parse = schema.safeParse({
    signatureId: donneesFormulaire.get("signatureId"),
    motif: donneesFormulaire.get("motif"),
    retour: donneesFormulaire.get("retour"),
  });
  if (!parse.success) {
    redirect(`${retour}?revocation=demande_invalide`);
  }

  // ── Mesure AVANT ──
  //
  // ⚠️ Lue ICI, avant toute écriture : après la révocation, l'état d'origine
  // n'est plus reconstituable sans rejouer la chaîne.
  const ligne = await prisma.coachingSeanceSignature.findUnique({
    where: { id: parse.data.signatureId },
    select: { coachingId: true, role: true },
  });
  const heuresAvant = ligne === null ? null : await heuresDuParcours(ligne.coachingId);

  const res = await revoquerSignatureSeance({
    signatureId: parse.data.signatureId,
    motif: parse.data.motif,
    parAdminId: session.userId,
  });
  if (!res.ok) {
    Sentry.captureMessage("Révocation de signature AFEST refusée", {
      level: "warning",
      tags: { action: "revoquerSignatureSeanceAfestAction", raison: res.raison },
      extra: { signatureId: parse.data.signatureId },
    });
    redirect(`${retour}?revocation=refus_service&raison=${res.raison}`);
  }

  // ── Mesure APRÈS ──
  //
  // ⚠️ RELUE, jamais déduite. Déduire « la séance faisait N minutes, donc on
  // retire N » supposerait connaître le régime, la neutralisation et l'absence
  // actée — trois règles qui vivent dans `heures.ts` et doivent y rester.
  const heuresApres =
    ligne === null ? null : ((await heuresDuParcours(ligne.coachingId)) ?? heuresAvant);
  const deltaHeures =
    heuresAvant !== null && heuresApres !== null
      ? Math.round((heuresApres - heuresAvant) * 100) / 100
      : null;

  await logQualiopiActivity({
    action: "qualiopi.signature.revocation",
    targetType: "CoachingSeanceSignature",
    targetId: parse.data.signatureId,
    changes: {
      motif: parse.data.motif,
      ...(ligne !== null ? { coachingId: ligne.coachingId, role: ligne.role } : {}),
      // 🔴 L'écart est la vraie information : c'est lui qui dit si une facture,
      // un BPF, un certificat ou une attestation devient inexact.
      ...(heuresAvant !== null ? { heuresAvant } : {}),
      ...(heuresApres !== null ? { heuresApres } : {}),
      ...(deltaHeures !== null ? { deltaHeures } : {}),
    },
    session,
  });

  if (deltaHeures !== null && deltaHeures !== 0) {
    // Une révocation qui change le comptage doit REMONTER : sans alerte, l'écart
    // n'existe que dans un journal que personne ne relit avant l'audit.
    Sentry.captureMessage("Révocation AFEST modifiant le comptage d'heures", {
      level: "warning",
      tags: { action: "revoquerSignatureSeanceAfestAction" },
      extra: { signatureId: parse.data.signatureId, heuresAvant, heuresApres, deltaHeures },
    });
  }
  Sentry.captureMessage("Signature AFEST révoquée", {
    level: "info",
    tags: { action: "revoquerSignatureSeanceAfestAction" },
    extra: { signatureId: parse.data.signatureId },
  });

  revalidatePath(parse.data.retour);
  redirect(`${parse.data.retour}?revocation=ok`);
}
