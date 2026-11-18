/**
 * Un e-mail `devis-envoi` de ce devis attend-il (garé « à valider » ou « approuvé » depuis peu,
 * donc en cours d'envoi) ? Lot B2, PR 3 : tant qu'il attend, le devis reste brouillon et aucun lien de signature
 * n'existe ; on ne le renvoie pas, on ne le remet pas en main propre, on ne le modifie pas.
 *
 * Lecture seule, filtrée sur gabarit + type + identifiant + statut. Aucun contenu de ligne n'est
 * lu : ni payload, ni adresse.
 */

import type { EmailOutboxStatus } from "../../../../prisma/generated/client";

export const GABARIT_DEVIS_ENVOI = "devis-envoi" as const;

/**
 * Une ligne « approuvé » ne compte comme « en attente » que depuis moins de ce délai (minutes).
 * Passé ce délai, l'approbation est abandonnée (processus tombé entre `a_valider → approuve` et
 * la mise en file) : la ligne n'a plus d'écran, ne se refuse pas, et ne doit pas verrouiller le
 * devis pour toujours. Même valeur que le balayage horaire qui la remet « à valider »
 * (`AGE_APPROUVE_ABANDONNE_MIN`, `src/server/email/health.ts`, non importé : module lourd).
 * Une ligne « à valider » compte toujours, quel que soit son âge.
 */
export const AGE_APPROUVE_ENCORE_EN_COURS_MIN = 15;

export const MSG_EMAIL_EN_ATTENTE_MODIF =
  "Un e-mail de ce devis attend validation : refusez-le avant de modifier le devis.";

type CondStatut =
  { statut: EmailOutboxStatus } | { statut: EmailOutboxStatus; approuveAt: { gte: Date } };

interface LecteurOutbox {
  emailOutbox: {
    findFirst: (args: {
      where: {
        template: string;
        entityType: string;
        entityId: string;
        OR: CondStatut[];
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
        OR: CondStatut[];
      };
      select: { entityId: true };
    }) => Promise<Array<{ entityId: string | null }>>;
  };
}

/** LA règle « en attente », partagée par la version unitaire et la version groupée. */
function conditionsEnAttente(maintenant: Date): CondStatut[] {
  const seuilApprouve = new Date(maintenant.getTime() - AGE_APPROUVE_ENCORE_EN_COURS_MIN * 60_000);
  return [{ statut: "a_valider" }, { statut: "approuve", approuveAt: { gte: seuilApprouve } }];
}

export async function emailDevisEnAttente(
  db: LecteurOutbox,
  devisId: string,
  maintenant: Date = new Date(),
): Promise<boolean> {
  const ligne = await db.emailOutbox.findFirst({
    where: {
      template: GABARIT_DEVIS_ENVOI,
      entityType: "Devis",
      entityId: devisId,
      OR: conditionsEnAttente(maintenant),
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
  maintenant: Date = new Date(),
): Promise<Set<string>> {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return new Set();
  const lignes = await db.emailOutbox.findMany({
    where: {
      template: GABARIT_DEVIS_ENVOI,
      entityType: "Devis",
      entityId: { in: uniques },
      OR: conditionsEnAttente(maintenant),
    },
    select: { entityId: true },
  });
  return new Set(lignes.flatMap((l) => (l.entityId === null ? [] : [l.entityId])));
}
