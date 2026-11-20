/**
 * Un e-mail `devis-envoi` de ce devis attend-il (garé « à valider » ou « approuvé », donc en
 * attente ou en cours d'envoi) ? Lot B2, PR 3 : tant qu'il attend, le devis reste brouillon et aucun
 * lien de signature n'existe ; on ne le renvoie pas, on ne le remet pas en main propre, on ne le modifie pas.
 *
 * OUT-1 : une ligne « approuvé » compte QUEL QUE SOIT SON ÂGE. Le balayage horaire de santé
 * des e-mails (`health.ts`) est le seul juge : il remet la ligne « à valider » ou la passe « envoyé »,
 * et c'est alors seulement que le devis se libère. Deux règles à deux seuils avaient produit un
 * verrou perpétuel.
 *
 * Lecture seule, filtrée sur gabarit + type + identifiant + statut. Aucun contenu de ligne n'est
 * lu : ni payload, ni adresse.
 */

import type { EmailOutboxStatus } from "../../../../prisma/generated/client";

export const GABARIT_DEVIS_ENVOI = "devis-envoi" as const;

export const MSG_EMAIL_EN_ATTENTE_MODIF =
  "Un e-mail de ce devis attend validation : refusez-le avant de modifier le devis.";

const STATUTS_EN_ATTENTE: EmailOutboxStatus[] = ["a_valider", "approuve"];

interface LecteurOutbox {
  emailOutbox: {
    findFirst: (args: {
      where: {
        template: string;
        entityType: string;
        entityId: string;
        statut: { in: EmailOutboxStatus[] };
      };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

interface LecteurOutboxGroupe {
  emailOutbox: {
    findMany: (args: {
      where: {
        template: string;
        entityType: string;
        entityId: { in: string[] };
        statut: { in: EmailOutboxStatus[] };
      };
      select: { entityId: true };
    }) => Promise<Array<{ entityId: string | null }>>;
  };
}

export async function emailDevisEnAttente(db: LecteurOutbox, devisId: string): Promise<boolean> {
  const ligne = await db.emailOutbox.findFirst({
    where: {
      template: GABARIT_DEVIS_ENVOI,
      entityType: "Devis",
      entityId: devisId,
      statut: { in: STATUTS_EN_ATTENTE },
    },
    select: { id: true },
  });
  return ligne !== null;
}

/**
 * Version groupée, pour une liste : UNE seule requête, même règle. Rend l'ensemble des devis
 * de `ids` qui ont un e-mail `devis-envoi` en attente. Liste vide : aucune requête.
 */
export async function devisAvecEmailEnAttente(
  db: LecteurOutboxGroupe,
  ids: readonly string[],
): Promise<Set<string>> {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return new Set();
  const lignes = await db.emailOutbox.findMany({
    where: {
      template: GABARIT_DEVIS_ENVOI,
      entityType: "Devis",
      entityId: { in: uniques },
      statut: { in: STATUTS_EN_ATTENTE },
    },
    select: { entityId: true },
  });
  return new Set(lignes.flatMap((l) => (l.entityId === null ? [] : [l.entityId])));
}
