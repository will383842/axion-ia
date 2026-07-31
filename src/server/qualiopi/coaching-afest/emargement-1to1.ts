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

  // (voir `regimeDeLaPiece` en bas de fichier)
  // ── Idempotence, MAIS bornée au régime de preuve (défaut H.3) ──
  //
  // 🔴 La feuille d'émargement est une pièce OPPOSABLE, et ses heures dépendent
  // du régime de preuve du parcours. Sous `legacy_boolean` elles viennent des
  // booléens de présence ; sous `signature_reelle` des lignes de signature non
  // révoquées. Ce ne sont pas les mêmes chiffres.
  //
  // L'idempotence servait donc, après bascule, un PDF calculé sous l'ANCIEN
  // régime — pendant que la facture, le BPF et le certificat du même parcours
  // étaient recalculés sous le nouveau. Exactement la divergence « facture ≠
  // certificat ≠ BPF » que ce chantier existe pour empêcher.
  //
  // ⚠️ Le défaut était INERTE tant que tout est en `legacy_boolean`, et se
  // serait déclenché AU MOMENT EXACT de la bascule — quand plus personne ne
  // l'aurait relié à ce chantier. C'est le profil de défaut le plus coûteux.
  //
  // On compare donc le régime figé sur la pièce à celui du parcours. Une pièce
  // ancienne, produite avant que ce marquage existe, ne porte rien : on la
  // considère `legacy_boolean`, qui EST le régime sous lequel elle a forcément
  // été produite (le régime réel n'existe que depuis ce chantier).
  if (cs.emargementGenereeAt && cs.emargementDocumentId && !opts?.force) {
    const existing = await prisma.documentGenere.findUnique({
      where: { id: cs.emargementDocumentId },
      select: { id: true, numero: true, metadata: true },
    });
    if (existing && regimeDeLaPiece(existing.metadata) === cs.regimePreuve) {
      return { documentId: existing.id, numero: existing.numero };
    }
    // Régime différent → on RE-GÉNÈRE. La pièce précédente reste en base, avec
    // son numéro et son empreinte : une preuve émise ne disparaît pas parce
    // qu'elle a été remplacée.
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
    // 🔴 Fige le régime SOUS LEQUEL cette feuille a été calculée.
    //
    // C'est ce marquage, et lui seul, qui permet à l'idempotence ci-dessus de
    // savoir qu'une pièce est devenue obsolète. Le retirer rouvrirait le défaut
    // H.3 en silence : la feuille resservirait indéfiniment des heures calculées
    // sous un régime abandonné.
    metadata: { regimePreuve: cs.regimePreuve },
  });

  await prisma.coachingSession.update({
    where: { id: coachingSessionId },
    data: { emargementDocumentId: generated.id, emargementGenereeAt: new Date() },
  });

  return { documentId: generated.id, numero: generated.numero };
}

/**
 * Régime de preuve sous lequel une pièce a été produite.
 *
 * ⚠️ `metadata` est une colonne `Json` : son type n'est PAS garanti côté
 * application. On teste la forme plutôt que de caster.
 *
 * 🔴 Une pièce sans marquage rend `legacy_boolean`, et ce n'est pas un repli
 * arbitraire : le régime réel n'existe que depuis ce chantier, donc toute pièce
 * antérieure a NÉCESSAIREMENT été calculée sous l'ancien régime. Rendre `null`
 * ou le régime courant ferait passer une feuille périmée pour à jour.
 */
export function regimeDeLaPiece(metadata: unknown): string {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return "legacy_boolean";
  }
  const valeur = (metadata as Record<string, unknown>)["regimePreuve"];
  return typeof valeur === "string" ? valeur : "legacy_boolean";
}
