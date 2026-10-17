/**
 * Chantier QNC, lot L04 — demander la LISTE DES STAGIAIRES à l'entreprise, une
 * fois la convention signée, et la relancer (NC1). Module PUR.
 *
 * Le positionnement ne part qu'à des inscrits : tant que l'entreprise n'a pas
 * dit QUI viendra, il n'y a personne à qui l'envoyer. La demande partait de la
 * mémoire de quelqu'un ; elle part désormais seule, et sa trace (rang, date
 * serveur) est la preuve de la diligence de l'organisme.
 *
 * ⚠️ Même doctrine que `relance-positionnement.ts` : un ÉTAT, pas une fenêtre de
 * date. Tant que la liste est incomplète et la session à venir, la session reste
 * candidate ; une exécution manquée n'est jamais définitive.
 */

const MS_JOUR = 24 * 60 * 60 * 1000;

/** Code stable de l'objet, dans `relances_journal` et `remises_retours`. */
export const OBJET_LISTE_STAGIAIRES = "liste_stagiaires";

/** Délai entre deux envois (demande ou relance). */
export const DELAI_RELANCE_LISTE_JOURS = 3;

/** Deux relances après la demande, pas plus — même plafond que les questionnaires. */
export const RELANCES_LISTE_MAX = 2;

export type GesteListe = "demander" | "relancer" | "rien";

export interface EtatListe {
  /** Envois déjà faits (demande comprise). */
  readonly envois: number;
  readonly dernierEnvoiLe: Date | null;
  readonly inscrits: number;
  readonly prevus: number;
  readonly dateDebut: Date;
  readonly maintenant: Date;
}

export function gesteListeStagiaires(e: EtatListe): GesteListe {
  // La liste est là : on ne réclame plus rien.
  if (e.prevus <= 0 || e.inscrits >= e.prevus) return "rien";
  // La session a commencé : réclamer une liste n'a plus d'objet.
  if (e.dateDebut.getTime() <= e.maintenant.getTime()) return "rien";
  if (e.envois === 0 || e.dernierEnvoiLe === null) return "demander";
  if (e.envois >= 1 + RELANCES_LISTE_MAX) return "rien";
  if (e.maintenant.getTime() - e.dernierEnvoiLe.getTime() < DELAI_RELANCE_LISTE_JOURS * MS_JOUR) {
    return "rien";
  }
  return "relancer";
}
