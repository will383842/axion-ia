/**
 * Qualiopi 1-to-1 / AFEST — génération de la feuille d'émargement signée (C1).
 *
 * Matérialise la présence par séance (date, durée, présence DÉCLARÉE par
 * l'organisme) à partir des CompteRenduSeance. Le PDF NE porte PAS de signature
 * électronique des parties (voir chantier fondation signature AFEST, différé).
 * Réutilise generateDocument (type `emargement`, refs coachingSessionId). Idempotent.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { Emargement1to1Pdf } from "@/server/qualiopi/documents/templates/emargement-1to1";
import type { EmargementSeance1to1 } from "@/server/qualiopi/documents/templates/emargement-1to1";
import { ensureCoachingSnapshot, COACHING_SNAPSHOT_SELECT } from "./coaching-snapshot";
import { heuresReellesSignees, SEANCE_HEURES_SELECT, versSeancePourHeures } from "./heures";

export interface Emargement1to1Generated {
  documentId: string;
  numero: string;
}

const formatDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export async function genererEmargement1to1(
  coachingSessionId: string,
  opts?: { force?: boolean },
): Promise<Emargement1to1Generated | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const cs = await prisma.coachingSession.findUnique({
    where: { id: coachingSessionId },
    select: {
      id: true,
      coachingSnapshot: true,
      ...COACHING_SNAPSHOT_SELECT,
      beneficiaireNom: true,
      beneficiaireEntreprise: true,
      tuteurEntrepriseNom: true,
      emargementDocumentId: true,
      emargementGenereeAt: true,
      trainer: { select: { nom: true, prenom: true } },
      trainee: { select: { nom: true, prenom: true, entreprise: true } },
      regimePreuve: true,
      comptesRendus: {
        orderBy: { dateSeance: "asc" },
        select: {
          dateSeance: true,
          // 🔴 Sélecteur PARTAGÉ avec les autres surfaces, jamais un select local.
          // Le select local qu'il remplace omettait `statut` — une séance ANNULÉE
          // restait donc comptée sur cette feuille alors qu'elle est exclue de la
          // facture, du BPF et du certificat — et n'embarquait pas la relation de
          // signature, si bien que le régime réel du parcours ne pouvait pas
          // s'appliquer ici. C'est précisément par ce genre de select recopié que
          // les quatre surfaces avaient divergé la première fois.
          ...SEANCE_HEURES_SELECT,
        },
      },
    },
  });
  if (!cs) throw new Error(`CoachingSession introuvable : ${coachingSessionId}`);

  // Idempotence.
  if (cs.emargementGenereeAt && cs.emargementDocumentId && !opts?.force) {
    const existing = await prisma.documentGenere.findUnique({
      where: { id: cs.emargementDocumentId },
      select: { id: true, numero: true },
    });
    if (existing) return { documentId: existing.id, numero: existing.numero };
  }

  // Snapshot légal (WS9) : fige le contenu engageant à la 1re émission de doc.
  const snap = await ensureCoachingSnapshot(cs);

  const identite = await getOrganismeIdentite();
  const beneficiaire = cs.trainee
    ? {
        nom: cs.trainee.nom,
        prenom: cs.trainee.prenom,
        ...(cs.trainee.entreprise ? { entreprise: cs.trainee.entreprise } : {}),
      }
    : {
        nom: cs.beneficiaireNom ?? "Bénéficiaire",
        prenom: "",
        ...(cs.beneficiaireEntreprise ? { entreprise: cs.beneficiaireEntreprise } : {}),
      };

  // 🔴 La colonne « présent » et le TOTAL se lisent sous le MÊME régime.
  //
  // Sous `signature_reelle`, la présence est portée par la LIGNE DE SIGNATURE du
  // bénéficiaire ; `beneficiairePresent` n'est plus qu'un cache d'affichage.
  // Dissocier les deux produirait une feuille qui se contredit elle-même : des
  // séances cochées « présent » dont les heures ne figurent pas au total — le
  // pire des rendus devant un auditeur, puisqu'il donne raison au doute.
  const seances: EmargementSeance1to1[] = cs.comptesRendus.map((cr) => ({
    date: formatDate(new Date(cr.dateSeance)),
    dureeLabel: cr.dureeMinutes != null ? `${cr.dureeMinutes} min` : "—",
    present:
      cs.regimePreuve === "signature_reelle" ? cr.signatures.length > 0 : cr.beneficiairePresent,
  }));
  const totalHeures = heuresReellesSignees(
    cs.comptesRendus.map(versSeancePourHeures),
    cs.regimePreuve,
  ).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

  const generated = await generateDocument({
    type: "emargement",
    buildElement: (numero) =>
      React.createElement(Emargement1to1Pdf, {
        data: {
          numero,
          dateEmission: formatDate(new Date()),
          identite,
          intitule: snap.intitule,
          beneficiaire,
          formateur: `${cs.trainer.prenom} ${cs.trainer.nom}`.trim() || identite.raisonSociale,
          ...(cs.tuteurEntrepriseNom ? { tuteur: cs.tuteurEntrepriseNom } : {}),
          seances,
          totalHeures,
        },
      }),
    refs: { coachingSessionId },
  });

  await prisma.coachingSession.update({
    where: { id: coachingSessionId },
    data: { emargementDocumentId: generated.id, emargementGenereeAt: new Date() },
  });

  return { documentId: generated.id, numero: generated.numero };
}
