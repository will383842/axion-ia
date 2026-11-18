/**
 * Un e-mail `devis-envoi` de ce devis attend-il (garé « à valider » ou « approuvé », donc en cours
 * d'envoi) ? Lot B2, PR 3 : tant qu'il attend, le devis reste brouillon et aucun lien de signature
 * n'existe ; on ne le renvoie pas, on ne le remet pas en main propre, on ne le modifie pas.
 *
 * Lecture seule, filtrée sur gabarit + type + identifiant + statut. Aucun contenu de ligne n'est
 * lu : ni payload, ni adresse.
 */

export const GABARIT_DEVIS_ENVOI = "devis-envoi" as const;
export const STATUTS_EMAIL_EN_ATTENTE = ["a_valider", "approuve"] as const;

export const MSG_EMAIL_EN_ATTENTE_MODIF =
  "Un e-mail de ce devis attend validation : refusez-le avant de modifier le devis.";

interface LecteurOutbox {
  emailOutbox: {
    findFirst: (args: {
      where: {
        template: string;
        entityType: string;
        entityId: string;
        statut: { in: string[] };
      };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

export async function emailDevisEnAttente(db: LecteurOutbox, devisId: string): Promise<boolean> {
  const ligne = await db.emailOutbox.findFirst({
    where: {
      template: GABARIT_DEVIS_ENVOI,
      entityType: "Devis",
      entityId: devisId,
      statut: { in: [...STATUTS_EMAIL_EN_ATTENTE] },
    },
    select: { id: true },
  });
  return ligne !== null;
}
