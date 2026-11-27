/**
 * Pastille « À relancer » de la liste des devis.
 *
 * Un devis est « à relancer » quand il est envoyé, non signé par le client, encore valide, envoyé
 * depuis 3 jours ou plus, et qu'aucune relance n'est garée ni n'a été approuvée ou envoyée depuis 7 jours, et qu'il n'a pas été remis en main propre, ni délai demandé par le client en cours (`delai-client.ts`).
 *
 * Lecture seule. UNE requête groupée pour toute la liste (jamais une par ligne).
 */

import {
  ENTITE_DEVIS,
  TEMPLATE_RELANCE_DEVIS,
} from "@/features/dossier-client/fiche/relance-devis";
import { ACTION_REMIS_MAIN_PROPRE } from "@/server/qualiopi/devis/canal-emission";

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
        OR: Array<
          | { statut: "a_valider" }
          | {
              statut: { in: Array<"approuve" | "envoye"> };
              OR: Array<{ approuveAt: { gte: Date } } | { envoyeAt: { gte: Date } }>;
            }
        >;
      };
      select: { entityId: true };
    }) => Promise<Array<{ entityId: string | null }>>;
  };
}

/**
 * Identifiants des devis dont la relance est ENCORE garée (`a_valider`, quelle que soit son
 * ancienneté) ou a été approuvée ou envoyée depuis moins de 7 jours. Une relance refusée ne compte pas.
 */
export async function devisAvecRelanceRecente(
  lecteur: LecteurRelancesDevis,
  devisIds: readonly string[],
  maintenant: Date,
): Promise<Set<string>> {
  if (devisIds.length === 0) return new Set();
  const seuil = new Date(maintenant.getTime() - JOURS_ENTRE_RELANCES_DEVIS * JOUR_MS);
  const lignes = await lecteur.emailOutbox.findMany({
    where: {
      template: TEMPLATE_RELANCE_DEVIS,
      entityType: ENTITE_DEVIS,
      entityId: { in: [...devisIds] },
      OR: [
        { statut: "a_valider" },
        {
          statut: { in: ["approuve", "envoye"] },
          OR: [{ approuveAt: { gte: seuil } }, { envoyeAt: { gte: seuil } }],
        },
      ],
    },
    select: { entityId: true },
  });
  return new Set(lignes.flatMap((l) => (l.entityId === null ? [] : [l.entityId])));
}

interface LecteurRemisesMainPropre {
  activityLog: {
    findMany: (args: {
      where: { action: string; targetType: string; targetId: { in: string[] } };
      select: { targetId: true };
    }) => Promise<Array<{ targetId: string | null }>>;
  };
}

/** Devis remis en main propre (trace dans `activityLog`) : « Préparer une relance » les refuse. */
export async function devisRemisEnMainPropreParmi(
  lecteur: LecteurRemisesMainPropre,
  devisIds: readonly string[],
): Promise<Set<string>> {
  if (devisIds.length === 0) return new Set();
  const lignes = await lecteur.activityLog.findMany({
    where: {
      action: ACTION_REMIS_MAIN_PROPRE,
      targetType: "Devis",
      targetId: { in: [...devisIds] },
    },
    select: { targetId: true },
  });
  return new Set(lignes.flatMap((l) => (l.targetId === null ? [] : [l.targetId])));
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
