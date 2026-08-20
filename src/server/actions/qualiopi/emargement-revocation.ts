/**
 * Révocation d'une signature d'émargement — la seule porte.
 *
 * 🔴 `D3-3-04` (audit E2E 2026-08-20). Aucune surface ne révoquait une signature
 * d'émargement : une signature apposée sur le mauvais nom était **définitive, et
 * scellée**. Les colonnes `revokedAt` / `revokedById` / `revokedMotif`
 * existaient, les huit lecteurs du registre filtraient déjà `revokedAt: null`,
 * et personne n'écrivait jamais ces colonnes.
 *
 * ## Habilitation
 *
 * `requireHabilitation("revoquer_signature")` — DIRECTION seule, et non le
 * responsable qualité. Celui-ci peut attester et valider, c'est-à-dire AJOUTER
 * de la preuve. Retirer sa valeur à une preuve déjà recueillie n'est pas le même
 * geste, et ne relève pas de la même responsabilité.
 *
 * ⚠️ `requireAdminWrite` aurait été FAUX ici : il autorise `editor`.
 *
 * ## Ce que l'action garantit et ce qu'elle ne fait pas
 *
 * Elle ne supprime rien : la ligne reste au registre avec son chaînage intact.
 * Elle exige un motif écrit. Et elle fait retomber `emargementSigneAt` quand
 * l'inscription n'a plus aucune signature vivante — sans quoi la conformité
 * continuerait d'affirmer « émargement réellement signé » sur une preuve
 * qu'on vient de retirer. Le détail du raisonnement vit dans
 * `emargement/revocation-service.ts`.
 */

"use server";

import { z } from "zod";
import { requireHabilitation, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { revoquerSignature, MOTIF_MIN } from "@/server/qualiopi/emargement/revocation-service";
import { retourValide } from "./_retour-formulaire";

const schema = z.object({
  signatureId: z.string().uuid(),
  motif: z.string().trim().min(MOTIF_MIN).max(2000),
});

/**
 * ⚠️ L'échec porte un CODE en plus du message. Le message s'affiche dans un
 * composant ; le code, lui, est ce qu'une redirection peut transporter — un
 * texte libre repris d'une URL et réaffiché est une injection en puissance.
 */
export type RevocationResultat =
  { ok: true; emargementRetombe: boolean } | { ok: false; raison: RaisonRefus; message: string };

export type RaisonRefus =
  "introuvable" | "deja_revoquee" | "motif_insuffisant" | "maillon_interne" | "demande_invalide";

export async function revoquerSignatureEmargementAction(input: {
  signatureId: string;
  motif: string;
}): Promise<RevocationResultat> {
  const session = await requireHabilitation("revoquer_signature");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    // Le message de zod est UTILE ici : il distingue « motif trop court » de
    // « identifiant invalide », et l'un des deux se corrige à l'écran.
    const premier = parsed.error.issues[0];
    return premier?.code === "too_small"
      ? {
          ok: false,
          raison: "motif_insuffisant",
          message: `Le motif doit faire au moins ${MOTIF_MIN} caractères : c'est lui que l'auditeur lira pour comprendre pourquoi la preuve a été retirée.`,
        }
      : { ok: false, raison: "demande_invalide", message: "Données invalides." };
  }

  const res = await revoquerSignature(parsed.data.signatureId, parsed.data.motif, session.userId);
  if (!res.ok) return { ok: false, raison: res.raison, message: res.message };

  // 🔑 Le journal porte le MOTIF, pas seulement le fait. Une révocation dont on
  // ne peut plus dire pourquoi elle a eu lieu est, du point de vue de
  // l'auditeur, indiscernable d'une manipulation.
  await logQualiopiActivity({
    action: "qualiopi.emargement.signature_revoquee",
    targetType: "EmargementSignature",
    targetId: parsed.data.signatureId,
    changes: {
      motif: parsed.data.motif,
      enrollmentId: res.enrollmentId,
      // Retenu explicitement : c'est la conséquence de conformité, et elle
      // change ce que le certificat de réalisation peut affirmer.
      emargementSigneAtRetire: res.emargementRetombe,
    },
    session,
  });

  return { ok: true, emargementRetombe: res.emargementRetombe };
}

// ─────────────────────────────────────────────────────────────────────────────
// La surface d'appel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 `D3-3-05` (2026-08-21) — CE QUI MANQUAIT, ET QUE J'AVAIS OUBLIÉ.
 *
 * L'action ci-dessus a été écrite le 2026-08-20 : service, habilitation, tests,
 * mutations vérifiées rouges. Et **rien ne l'appelait**. Un balayage des exports
 * sans appelant l'a montré le lendemain : le seul fichier qui la nommait était
 * le test statique vérifiant qu'elle exige une habilitation.
 *
 * C'est mot pour mot le défaut que cet audit poursuit — *l'outil est écrit, le
 * raccordement manque* — et `signature-revocation.ts`, son équivalent pour les
 * pièces, ouvre sur exactement le même constat, corrigé une session plus tôt.
 * Traiter un cas sans regarder la classe le fait revenir.
 *
 * ⚠️ Signature d'un `<form action={…}>` classique : aucune ligne de JavaScript
 * côté client. Le registre auditeur est un Server Component pur, et un écran
 * consulté trois fois par an ne justifie pas un bundle.
 */
export async function revoquerSignatureEmargementFormAction(
  donneesFormulaire: FormData,
): Promise<void> {
  const retour = retourValide(donneesFormulaire);

  const signatureId = donneesFormulaire.get("signatureId");
  const motif = donneesFormulaire.get("motif");

  // L'habilitation est vérifiée par l'action ci-dessus, qui LÈVE si le rôle ne
  // convient pas. On la laisse lever : un `redirect` silencieux ferait croire à
  // un refus métier là où il s'agit d'un défaut d'habilitation.
  const res = await revoquerSignatureEmargementAction({
    signatureId: typeof signatureId === "string" ? signatureId : "",
    motif: typeof motif === "string" ? motif : "",
  });

  if (!res.ok) {
    redirect(`${retour}?revocation=refus&raison=${res.raison}`);
  }

  revalidatePath(retour);
  // 🔑 On transporte la CONSÉQUENCE, pas seulement le succès : quand la
  // révocation fait retomber `emargementSigneAt`, l'inscription cesse d'être
  // « émargée » et le certificat de réalisation ne peut plus l'affirmer. Le
  // taire ferait découvrir la conséquence au moment de justifier.
  redirect(`${retour}?revocation=ok&retombe=${res.emargementRetombe ? "1" : "0"}`);
}
