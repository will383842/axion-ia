/**
 * Pastille « À relancer » de la liste des devis.
 *
 * Un devis est « à relancer » quand il est envoyé, non signé par le client, encore valide, envoyé
 * depuis 3 jours ou plus, et qu'aucune relance n'a été garée ou envoyée depuis 7 jours.
 *
 * Lecture seule. UNE requête groupée pour toute la liste (jamais une par ligne).
 */

import {
  ENTITE_DEVIS,
  TEMPLATE_RELANCE_DEVIS,
} from "@/features/dossier-client/fiche/relance-devis";

export const JOURS_AVANT_RELANCE_DEVIS = 3;
export const JOURS_ENTRE_RELANCES_DEVIS = 7;

const JOUR_MS = 24 * 60 * 60 * 1000;

interface LecteurRelancesDevis {
  emailOutbox: {
    findMany: (args: {
      where: {
        template: string;
        entityType: string;
        entityId: { in: string[] };
        statut: { in: Array<"a_valider" | "approuve" | "envoye"> };
        createdAt: { gte: Date };
      };
      select: { entityId: true };
    }) => Promise<Array<{ entityId: string | null }>>;
  };
}

/** Identifiants des devis qui ont une relance garée ou envoyée depuis moins de 7 jours. */
export async function devisAvecRelanceRecente(
  lecteur: LecteurRelancesDevis,
  devisIds: readonly string[],
  maintenant: Date,
): Promise<Set<string>> {
  if (devisIds.length === 0) return new Set();
  const lignes = await lecteur.emailOutbox.findMany({
    where: {
      template: TEMPLATE_RELANCE_DEVIS,
      entityType: ENTITE_DEVIS,
      entityId: { in: [...devisIds] },
      statut: { in: ["a_valider", "approuve", "envoye"] },
      createdAt: { gte: new Date(maintenant.getTime() - JOURS_ENTRE_RELANCES_DEVIS * JOUR_MS) },
    },
    select: { entityId: true },
  });
  return new Set(lignes.flatMap((l) => (l.entityId === null ? [] : [l.entityId])));
}

/**
 * Candidats à la pastille, avant la lecture des relances : envoyé, non signé par le client
 * (`etatListe` vient de `etatListeDevis` : « attente_client » exclut un devis à contresigner),
 * encore valide, envoyé depuis 3 jours ou plus. Sert aussi à ne lire les relances QUE pour eux.
 */
export function estCandidatARelance(
  d: { statut: string; sentAt?: Date | null; dateValidite: Date },
  etatListe: string,
  maintenant: Date,
): boolean {
  return (
    d.statut === "envoye" &&
    etatListe === "attente_client" &&
    d.dateValidite.getTime() >= maintenant.getTime() &&
    d.sentAt != null &&
    maintenant.getTime() - d.sentAt.getTime() >= JOURS_AVANT_RELANCE_DEVIS * JOUR_MS
  );
}

export function estDevisARelancer(
  d: { statut: string; sentAt?: Date | null; dateValidite: Date },
  etatListe: string,
  relanceRecente: boolean,
  maintenant: Date,
): boolean {
  return estCandidatARelance(d, etatListe, maintenant) && !relanceRecente;
}
