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

interface LecteurOutbox {
  emailOutbox: {
    findFirst: (args: {
      where: {
        template: string;
        entityType: string;
        entityId: string;
        OR: Array<
          { statut: EmailOutboxStatus } | { statut: EmailOutboxStatus; approuveAt: { gte: Date } }
        >;
      };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

export async function emailDevisEnAttente(
  db: LecteurOutbox,
  devisId: string,
  maintenant: Date = new Date(),
): Promise<boolean> {
  const seuilApprouve = new Date(maintenant.getTime() - AGE_APPROUVE_ENCORE_EN_COURS_MIN * 60_000);
  const ligne = await db.emailOutbox.findFirst({
    where: {
      template: GABARIT_DEVIS_ENVOI,
      entityType: "Devis",
      entityId: devisId,
      OR: [{ statut: "a_valider" }, { statut: "approuve", approuveAt: { gte: seuilApprouve } }],
    },
    select: { id: true },
  });
  return ligne !== null;
}
