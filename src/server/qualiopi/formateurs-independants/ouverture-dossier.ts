/**
 * Formateurs indépendants — « Retenu » OUVRE le dossier en ligne (lot B, M2).
 *
 * Après l'issue « Retenu » de l'échange (W-3), la fiche INACTIVE vient d'être créée.
 * Ce geste, dans cet ordre :
 *   1. ouvre le dossier : `dossierStatut = "en_cours"`, `dossierOuvertAt`, et une
 *      nouvelle version d'accès (`accesVersion + 1`) qui signe le lien ;
 *   2. envoie F5 (`formateur-issue-retenu`) avec ce lien, rattaché à la FICHE : c'est
 *      l'origine de la campagne S3 (relances F9, `relance-dossier.ts`).
 *
 * 🔴 Interrupteur `dossier_en_ligne` coupé : rien n'est écrit, rien ne part. L'écriture
 * est conditionnelle (dossier jamais ouvert, fiche d'un indépendant en nom propre, sans
 * fin de collaboration) : un dossier déjà ouvert n'est jamais rouvert ici (« Renvoyer le
 * lien », F8, sert à cela). Le journal ne porte que l'identifiant de la fiche.
 *
 * Un texte F5 non validé laisse le dossier ouvert : l'e-mail ne part pas, l'écran le dit,
 * et « Renvoyer le lien » le fera partir une fois le texte validé.
 *
 * Le rôle (administrateur) est gardé par l'appelant.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { envoyer, type ResultatEnvoiFormateur } from "./envois";
import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";
import { urlDossierFormateur } from "./jeton-dossier";

export type ResultatOuvertureDossier =
  { ok: true; envoi: ResultatEnvoiFormateur } | { ok: false; message: string };

export const MESSAGES_OUVERTURE = {
  eteint: "Le dossier en ligne n'est pas ouvert (interrupteur coupé) : aucun e-mail n'est parti.",
  lien: "Le lien du dossier ne peut pas être fabriqué : le dossier n'a pas été ouvert.",
  etat: "Le dossier de ce formateur est déjà ouvert : utilisez « Renvoyer le lien » depuis sa fiche.",
} as const;

export async function ouvrirDossierRetenu(p: {
  trainerId: string;
  parId: string;
  maintenant: Date;
}): Promise<ResultatOuvertureDossier> {
  if (!lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "dossier_en_ligne")) {
    return { ok: false, message: MESSAGES_OUVERTURE.eteint };
  }
  // Le secret de signature est éprouvé AVANT d'écrire : un dossier ouvert sans lien
  // ne servirait à rien.
  if (urlDossierFormateur(p.trainerId, 0, p.maintenant) === null) {
    return { ok: false, message: MESSAGES_OUVERTURE.lien };
  }

  const t = await prisma.$transaction(async (tx) => {
    const r = await tx.trainer.updateMany({
      where: {
        id: p.trainerId,
        statut: "sous_traitant",
        dossierStatut: null,
        finCollaborationAt: null,
        organismeSousTraitantId: null,
      },
      data: {
        dossierStatut: "en_cours",
        dossierOuvertAt: p.maintenant,
        accesVersion: { increment: 1 },
      },
    });
    if (r.count !== 1) return null;
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.dossier_ouvert",
        targetType: "Trainer",
        targetId: p.trainerId,
        changes: { depuis: "issue_retenu" },
        session: { userId: p.parId },
      },
      { exiger: true },
    );
    return tx.trainer.findUnique({
      where: { id: p.trainerId },
      select: { id: true, email: true, prenom: true, accesVersion: true },
    });
  });
  if (t === null) return { ok: false, message: MESSAGES_OUVERTURE.etat };

  const lien = urlDossierFormateur(t.id, t.accesVersion, p.maintenant);
  if (lien === null) return { ok: true, envoi: "indisponible" };
  const envoi = await envoyer({
    gabarit: "formateur-issue-retenu",
    destinataire: t.email,
    payload: { ...(t.prenom.trim() ? { prenom: t.prenom.trim() } : {}), lien },
    entityType: "Trainer",
    entityId: t.id,
    // Une fois par fiche : le dossier ne s'ouvre qu'une fois par ce geste.
    jobId: `fi-issue-retenu-${t.id}`,
  });
  return { ok: true, envoi };
}
