/**
 * Créer un projet — et y ranger les faits cochés, EN UNE TRANSACTION
 * (chantier visio, plan §3.13 point 1 bis).
 *
 * Pourquoi une transaction : un fait « à ranger » n'est pas validable (CHECK
 * `faits_valide_exige_une_portee`). Sans projet, aucun fait d'un premier
 * rendez-vous ne le serait. Créer le projet puis ranger les faits en deux temps
 * laisserait, à la première erreur, un projet vide et des faits orphelins.
 *
 * Écrit, dans la même transaction :
 *   · `Projet` (numéro `AXI-PRJ-AAAA-NNN`, série hors des pièces officielles) ;
 *   · `ProjetEvenement(cree)` ;
 *   · `ProjetContact` pour chaque personne et son rôle ;
 *   · pour chaque fait coché : `a_ranger` → `projet`, et `FaitEvenement(deplace)`.
 *
 * Un fait d'un AUTRE client, ou déjà rangé, fait échouer le tout : rien n'est
 * écrit à moitié. (La base le refuserait aussi — clés composées — ; le code le
 * dit d'abord, en français.)
 *
 * ⚠️ Module NEUTRE : il reçoit son client Prisma.
 */

import type { ActiviteFacturation, Prisma, RoleDansProjet } from "../../../prisma/generated/client";
import {
  formatNumeroProjet,
  parseSequence,
  prefixeSerieProjet,
} from "@/server/qualiopi/numbering/formats";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";

export interface EntreeCreerProjet {
  readonly clientId: string;
  readonly titre: string;
  readonly activite?: ActiviteFacturation | null;
  readonly contacts?: ReadonlyArray<{ readonly contactId: string; readonly role: RoleDansProjet }>;
  /** Faits « à ranger » cochés par Will. */
  readonly faitsARangerIds?: ReadonlyArray<string>;
  readonly parAdminId: string | null;
  /** Pour tester : l'année du numéro. */
  readonly maintenant?: Date;
}

type BaseProjet = {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

export class ErreurCreationProjet extends Error {}

/** Prochain numéro de la série projet de l'année (borne haute + 1). */
async function prochainNumeroProjet(tx: Prisma.TransactionClient, annee: number): Promise<string> {
  const prefixe = prefixeSerieProjet(annee);
  const existants = await tx.projet.findMany({
    where: { numero: { startsWith: prefixe } },
    select: { numero: true },
  });
  let borne = 0;
  for (const { numero } of existants) {
    const seq = parseSequence(numero, prefixe);
    if (seq !== null && seq > borne) borne = seq;
  }
  return formatNumeroProjet(annee, borne + 1);
}

export async function creerProjet(
  db: BaseProjet,
  e: EntreeCreerProjet,
): Promise<{ id: string; numero: string; faitsRanges: number }> {
  const titre = e.titre.trim();
  if (titre === "") throw new ErreurCreationProjet("Donnez un titre au projet.");
  if (titre.length > 200)
    throw new ErreurCreationProjet("Titre trop long (200 caractères au plus).");
  const faitsIds = [...new Set(e.faitsARangerIds ?? [])];
  const annee = (e.maintenant ?? new Date()).getFullYear();

  return withNumberRetry(() =>
    db.$transaction(async (tx) => {
      const numero = await prochainNumeroProjet(tx, annee);
      const projet = await tx.projet.create({
        data: {
          numero,
          clientId: e.clientId,
          titre,
          ...(e.activite ? { activite: e.activite } : {}),
          creeParId: e.parAdminId,
        },
        select: { id: true, numero: true },
      });
      await tx.projetEvenement.create({
        data: {
          projetId: projet.id,
          action: "cree",
          nouveauStatut: "ouvert",
          parAdminId: e.parAdminId,
        },
      });
      for (const c of e.contacts ?? []) {
        await tx.projetContact.create({
          data: { projetId: projet.id, contactId: c.contactId, clientId: e.clientId, role: c.role },
        });
      }

      for (const faitId of faitsIds) {
        const fait = await tx.fait.findUnique({
          where: { id: faitId },
          select: { id: true, clientId: true, portee: true, projetId: true },
        });
        if (fait === null || fait.clientId !== e.clientId) {
          throw new ErreurCreationProjet(
            "Un des faits cochés n'appartient pas à ce client : rien n'a été créé.",
          );
        }
        if (fait.portee !== "a_ranger") {
          throw new ErreurCreationProjet(
            "Un des faits cochés est déjà rangé : rien n'a été créé. Rechargez la page.",
          );
        }
        await tx.fait.update({
          where: { id: fait.id },
          data: { portee: "projet", projetId: projet.id },
        });
        await tx.faitEvenement.create({
          data: {
            faitId: fait.id,
            action: "deplace",
            ancienClientId: e.clientId,
            nouveauClientId: e.clientId,
            ancienPortee: "a_ranger",
            nouveauPortee: "projet",
            ancienProjetId: null,
            nouveauProjetId: projet.id,
            parAdminId: e.parAdminId,
          },
        });
      }

      return { id: projet.id, numero: projet.numero, faitsRanges: faitsIds.length };
    }),
  );
}
