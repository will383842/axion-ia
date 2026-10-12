/**
 * Formateurs indépendants — GESTES de la mise à niveau des actifs (lot L9b).
 *
 *   - figer la liste : `miseANiveauListeeAt` est posé, une fois, sur chaque indépendant
 *     actif concerné ce jour-là (comparée ensuite au comptage daté de Will) ;
 *   - envoyer le dossier de mise à niveau : le dossier en ligne est ouvert (ou rouvert),
 *     les liens déjà envoyés sont révoqués (`accesVersion + 1`) et F8 part avec le
 *     nouveau lien. Les écrans sont préremplis par ce que la fiche porte déjà.
 *
 * 🔴 Aucun actif n'est désactivé, aucune donnée n'est effacée. Les écritures sont
 * conditionnelles et le journal ne porte que des identifiants.
 *
 * Le rôle et l'interrupteur `formateurs.mise_a_niveau` sont gardés par l'appelant.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";

import { envoyer, texteValide, type ResultatEnvoiFormateur } from "./envois";
import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";
import { urlDossierFormateur } from "./jeton-dossier";
import { lireEcranMiseANiveau } from "./mise-a-niveau-lecture";
import { MESSAGES_REFUS_MISE_A_NIVEAU, refusEnvoiMiseANiveau } from "./mise-a-niveau-regles";

/** Fige la liste : rend le nombre de fiches nouvellement listées. */
export async function figerListeMiseANiveau(p: {
  parId: string;
  maintenant: Date;
}): Promise<{ listees: number }> {
  const ecran = await lireEcranMiseANiveau(p.maintenant);
  const ids = ecran.aMettreANiveau.filter((l) => l.listeeLe === null).map((l) => l.trainerId);
  let listees = 0;
  for (const id of ids) {
    await prisma.$transaction(async (tx) => {
      const r = await tx.trainer.updateMany({
        // `actif` n'est jamais nommé ici (un seul écrivain) : la lecture de l'écran l'a jugé.
        where: { id, miseANiveauListeeAt: null, finCollaborationAt: null },
        data: { miseANiveauListeeAt: p.maintenant },
      });
      if (r.count !== 1) return;
      listees += 1;
      await journaliser(
        tx,
        {
          action: "qualiopi.formateur.mise_a_niveau_listee",
          targetType: "Trainer",
          targetId: id,
          changes: {},
          session: { userId: p.parId },
        },
        { exiger: true },
      );
    });
  }
  return { listees };
}

export type ResultatMiseANiveau =
  { ok: true; envoi: ResultatEnvoiFormateur } | { ok: false; message: string };

/** États du dossier qu'un envoi de mise à niveau peut ouvrir ou rouvrir. */
const ETATS_OUVRABLES = ["en_cours", "a_completer"] as const;

export async function envoyerDossierMiseANiveau(p: {
  trainerId: string;
  parId: string;
  maintenant: Date;
}): Promise<ResultatMiseANiveau> {
  if (!lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "dossier_en_ligne")) {
    return { ok: false, message: "Le dossier en ligne n'est pas ouvert (interrupteur coupé)." };
  }
  // AVANT toute écriture : sans texte validé, rien ne partirait.
  if (!(await texteValide("formateur-dossier-lien"))) {
    return {
      ok: false,
      message: "L'e-mail du lien du dossier n'est pas encore validé : rien n'a été envoyé.",
    };
  }
  if (urlDossierFormateur(p.trainerId, 0, p.maintenant) === null) {
    return { ok: false, message: "Le lien du dossier ne peut pas être fabriqué." };
  }

  const ecran = await lireEcranMiseANiveau(p.maintenant);
  const ligne = ecran.aMettreANiveau.find((l) => l.trainerId === p.trainerId);
  const fiche = await prisma.trainer.findUnique({
    where: { id: p.trainerId },
    select: { miseANiveauListeeAt: true, dossierStatut: true },
  });
  if (fiche === null) return { ok: false, message: "Formateur introuvable." };
  if (fiche.dossierStatut === "verifie") {
    return {
      ok: false,
      message: "Son dossier est déjà vérifié : préparez son contrat-cadre depuis sa fiche.",
    };
  }
  const refus = refusEnvoiMiseANiveau({
    // L'écran a jugé les faits (contrat v3 en vigueur compris) : absent de la liste = pas concerné.
    concerne: ligne !== undefined,
    miseANiveauListeeAt: fiche.miseANiveauListeeAt,
    dossierStatut: fiche.dossierStatut,
  });
  if (refus !== null) return { ok: false, message: MESSAGES_REFUS_MISE_A_NIVEAU[refus] };

  const t = await prisma.$transaction(async (tx) => {
    const r = await tx.trainer.updateMany({
      where: {
        id: p.trainerId,
        statut: "sous_traitant",
        finCollaborationAt: null,
        organismeSousTraitantId: null,
        miseANiveauListeeAt: { not: null },
        ...(fiche.dossierStatut === null
          ? { dossierStatut: null }
          : { dossierStatut: { in: [...ETATS_OUVRABLES] } }),
      },
      data: {
        accesVersion: { increment: 1 },
        ...(fiche.dossierStatut === null
          ? { dossierStatut: "en_cours", dossierOuvertAt: p.maintenant }
          : {}),
      },
    });
    if (r.count !== 1) return null;
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.mise_a_niveau_envoyee",
        targetType: "Trainer",
        targetId: p.trainerId,
        changes: { dossierOuvert: fiche.dossierStatut === null },
        session: { userId: p.parId },
      },
      { exiger: true },
    );
    return tx.trainer.findUnique({
      where: { id: p.trainerId },
      select: { id: true, email: true, prenom: true, accesVersion: true },
    });
  });
  if (t === null) {
    return { ok: false, message: "La fiche a changé entre-temps : rechargez la page." };
  }
  const lien = urlDossierFormateur(t.id, t.accesVersion, p.maintenant);
  if (lien === null) return { ok: true, envoi: "indisponible" };
  const envoi = await envoyer({
    gabarit: "formateur-dossier-lien",
    destinataire: t.email,
    payload: { prenom: t.prenom, lien },
    entityType: "Trainer",
    entityId: t.id,
    jobId: `fi-mise-a-niveau-${t.id}-v${t.accesVersion}`,
  });
  return { ok: true, envoi };
}
