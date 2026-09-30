/**
 * Déplacer un rendez-vous rangé chez le mauvais client (chantier visio, PR 4 ;
 * plan V-06).
 *
 * UNE transaction : la rencontre, ses faits et ses participants changent de
 * fiche ensemble, ou rien ne change. Un déplacement à moitié laisserait des
 * faits chez l'ancien client pour une rencontre du nouveau — la base le
 * refuserait d'ailleurs au COMMIT (trigger `faits_client_de_la_rencontre`),
 * mais le code ne s'en remet pas à elle. Garde :
 * `deplacer-une-rencontre-a-moitie-echoue-en-entier.spec.ts`.
 *
 * Ce qui change, et pourquoi :
 *   · la rencontre : nouvelle fiche, nouveau projet (facultatif) ;
 *   · ses faits : nouvelle fiche ; ceux d'un PROJET de l'ancienne fiche vont
 *     dans le projet d'arrivée (obligatoire s'il y en a) ; la personne dont
 *     ils parlent (`contactSujetId`, `contactLocuteurId`) était une personne
 *     de l'ANCIENNE fiche : le lien est retiré (clé composée « même client »),
 *     le contenu du fait ne change pas ;
 *   · ses participants : nouvelle fiche, reliés aux personnes de la nouvelle
 *     fiche qui portent la même adresse ;
 *   · le journal : `RencontreRattachementEvenement(deplace)` et un
 *     `FaitEvenement(deplace)` par fait.
 */

import type { BaseTransactionnelle } from "./base";
import { relierParticipantsAuxPersonnes } from "./rattacher";

export class ErreurDeplacement extends Error {}

export interface EntreeDeplacer {
  readonly rencontreId: string;
  readonly versClientId: string;
  readonly versProjetId?: string | null;
  readonly parAdminId: string;
}

export async function deplacerRencontre(
  db: BaseTransactionnelle,
  e: EntreeDeplacer,
): Promise<{ faits: number; participants: number }> {
  return db.$transaction(async (tx) => {
    const r = await tx.rencontre.findUnique({
      where: { id: e.rencontreId },
      select: { id: true, clientId: true, projetId: true },
    });
    if (r === null) throw new ErreurDeplacement("Rendez-vous introuvable.");
    if (r.clientId === null) {
      throw new ErreurDeplacement("Ce rendez-vous n'est rangé nulle part : utilisez « Ranger ».");
    }
    if (r.clientId === e.versClientId) {
      throw new ErreurDeplacement("Ce rendez-vous est déjà chez ce client.");
    }
    const cible = await tx.client.findUnique({
      where: { id: e.versClientId },
      select: { id: true },
    });
    if (cible === null) throw new ErreurDeplacement("Fiche d'arrivée introuvable.");
    const versProjetId = e.versProjetId ?? null;
    if (versProjetId !== null) {
      const p = await tx.projet.findUnique({
        where: { id: versProjetId },
        select: { clientId: true },
      });
      if (p === null || p.clientId !== e.versClientId) {
        throw new ErreurDeplacement("Le projet d'arrivée n'appartient pas à ce client.");
      }
    }

    const ancienClientId = r.clientId;
    const faits = await tx.fait.findMany({
      where: { rencontreId: e.rencontreId },
      select: { id: true, portee: true, projetId: true },
    });
    // V1-03 : un seul projet d'arrivée ne peut pas recevoir des faits venus de
    // deux projets (le budget de l'audit rejoindrait celui de la formation).
    if (new Set(faits.filter((f) => f.portee === "projet").map((f) => f.projetId)).size > 1) {
      throw new ErreurDeplacement(
        "Les faits de ce rendez-vous sont rangés dans plusieurs projets : un déplacement les réunirait dans un seul. Rangez-les d'abord dans un même projet.",
      );
    }
    if (versProjetId === null && faits.some((f) => f.portee === "projet")) {
      throw new ErreurDeplacement(
        "Des faits de ce rendez-vous sont rangés dans un projet : choisissez le projet d'arrivée.",
      );
    }

    await tx.rencontre.update({
      where: { id: e.rencontreId },
      data: {
        clientId: e.versClientId,
        projetId: versProjetId,
        rattachementStatut: "valide",
        rattacheParId: e.parAdminId,
        rattacheLe: new Date(),
      },
    });

    for (const f of faits) {
      const nouveauProjetId = f.portee === "projet" ? versProjetId : null;
      await tx.fait.update({
        where: { id: f.id },
        data: {
          clientId: e.versClientId,
          projetId: nouveauProjetId,
          contactSujetId: null,
          contactLocuteurId: null,
        },
      });
      await tx.faitEvenement.create({
        data: {
          faitId: f.id,
          action: "deplace",
          ancienClientId,
          nouveauClientId: e.versClientId,
          ancienPortee: f.portee,
          nouveauPortee: f.portee,
          ancienProjetId: f.projetId,
          nouveauProjetId,
          parAdminId: e.parAdminId,
        },
      });
    }

    await tx.rencontreParticipant.updateMany({
      where: { rencontreId: e.rencontreId, role: { not: "axion" } },
      data: { clientId: null, contactId: null },
    });
    const participants = await relierParticipantsAuxPersonnes(tx, e.rencontreId, e.versClientId);

    await tx.rencontreRattachementEvenement.create({
      data: {
        rencontreId: e.rencontreId,
        action: "deplace",
        ancienClientId,
        nouveauClientId: e.versClientId,
        ancienProjetId: r.projetId,
        nouveauProjetId: versProjetId,
        parAdminId: e.parAdminId,
      },
    });
    return { faits: faits.length, participants };
  });
}
