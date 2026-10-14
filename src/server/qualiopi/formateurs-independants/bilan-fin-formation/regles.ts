/**
 * Formateurs indépendants — LE BILAN DE FIN DE FORMATION (lot G2) : les règles PURES.
 *
 * Décision du dirigeant (12/10/2026) : un formateur indépendant n'est payé pour une
 * formation que s'il a fait tout ce qui lui revient. Après la dernière journée, il fait
 * depuis son espace, sur la page de la session :
 *   (a) l'évaluation finale des acquis de chaque stagiaire inscrit et présent (même
 *       donnée que la saisie de la console : `EvaluationAcquis`, type « finale ») ;
 *   (b) son avis sur la session (appréciation de qualité « formateur », off.30) ;
 *   (c) « Terminer », qui fige l'ensemble.
 *
 * Ici : quand le bloc apparaît, qui est à évaluer, quand « Terminer » est possible, quand
 * le bilan est exigé pour le paiement, et la relance (J+2, J+7) et l'alerte (J+10).
 * La condition de paiement elle-même est `paiement/formation-complete.ts`.
 *
 * Module neutre (ni `server-only`, ni Next, ni Prisma) : le worker le lit.
 */

import { FENETRE_ENVOI_PAR_DEFAUT, type RegleCampagne } from "@/lib/relances/campagne";
import { estInscriptionActive } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import type { FaitsCampagne } from "@/server/relances/registre-campagnes";

import {
  instantParis,
  jourDeColonneDate,
  jourParis,
  joursEntre,
  type JourCivil,
} from "../argent/dates";

const JOUR_MS = 86_400_000;

/** L'ancre de la page de session où vit le bloc (e-mail, accueil, console). */
export const ANCRE_BILAN = "fin-de-formation";

// ─────────────────────────────────────────────────────────────────────────────
// Quand le bloc apparaît
// ─────────────────────────────────────────────────────────────────────────────

/** La dernière journée (colonne `@db.Date`) et son heure de fin, ou `null`. */
export function derniereJourneeDe(
  jours: ReadonlyArray<{ readonly date: Date; readonly heureFin: string }>,
): { jour: JourCivil; heureFin: string } | null {
  let d: { jour: JourCivil; heureFin: string } | null = null;
  for (const j of jours) {
    const jour = jourDeColonneDate(j.date);
    if (d === null || jour > d.jour || (jour === d.jour && j.heureFin > d.heureFin)) {
      d = { jour, heureFin: j.heureFin };
    }
  }
  return d;
}

/**
 * La dernière journée est-elle PASSÉE (son horaire de fin dépassé, heure de Paris) ?
 * Sans aucune journée : non — rien ne permet de dater la fin.
 */
export function derniereJourneePassee(
  jours: ReadonlyArray<{ readonly date: Date; readonly heureFin: string }>,
  maintenant: Date,
): boolean {
  const d = derniereJourneeDe(jours);
  if (d === null) return false;
  let fin: Date;
  try {
    fin = instantParis(d.jour, d.heureFin);
  } catch {
    // Heure illisible : la fin de la journée civile, prudemment.
    return jourParis(maintenant) > d.jour;
  }
  return maintenant.getTime() >= fin.getTime();
}

// ─────────────────────────────────────────────────────────────────────────────
// Qui est à évaluer, et quand « Terminer » est possible
// ─────────────────────────────────────────────────────────────────────────────

export interface InscritLu {
  readonly enrollmentId: string;
  readonly statut: string;
  /** Au moins une présence constatée (créneau présent ou signature d'émargement). */
  readonly present: boolean;
}

/** Les inscrits ACTIFS (ni abandon, ni exclusion) et PRÉSENTS. */
export function stagiairesAEvaluer<T extends InscritLu>(inscrits: readonly T[]): T[] {
  return inscrits.filter((i) => estInscriptionActive(i.statut) && i.present);
}

export interface EtatDuBilan {
  /** Stagiaires à évaluer encore sans évaluation finale. */
  readonly restants: number;
  readonly termine: boolean;
  readonly peutTerminer: boolean;
}

/**
 * « Terminer » exige une évaluation finale pour CHAQUE stagiaire présent (saisie par le
 * formateur ou déjà par la console) ET l'avis du formateur. Terminé : figé.
 */
export function etatDuBilan(e: {
  readonly stagiaires: ReadonlyArray<{
    readonly enrollmentId: string;
    readonly finaleExiste: boolean;
  }>;
  readonly avisDonne: boolean;
  readonly termineAt: Date | null;
}): EtatDuBilan {
  const restants = e.stagiaires.filter((s) => !s.finaleExiste).length;
  const termine = e.termineAt !== null;
  return { restants, termine, peutTerminer: !termine && restants === 0 && e.avisDonne };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quand le bilan est exigé pour le paiement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exigé pour un formateur INDÉPENDANT en nom propre (ni salarié, ni dirigeant, ni
 * formateur d'un organisme sous-traitant), quand l'interrupteur est allumé, et pour une
 * session dont la dernière journée est au jour de l'allumage ou après : allumer ne bloque
 * jamais rétroactivement une formation finie avant.
 */
export function bilanExige(e: {
  readonly statut: string;
  readonly organismeSousTraitantId: string | null;
  /** Lot 8A — ce formateur anime-t-il la dernière journée (`remetLeBilan`) ? */
  readonly remetLeBilan: boolean;
  /** Jour (Paris) d'allumage de `formateurs.bilan_fin_formation` ; `null` = éteint. */
  readonly allumeLe: JourCivil | null;
  readonly derniereJournee: JourCivil;
}): boolean {
  if (e.allumeLe === null) return false;
  if (e.statut !== "sous_traitant" || e.organismeSousTraitantId !== null) return false;
  if (!e.remetLeBilan) return false;
  return e.derniereJournee >= e.allumeLe;
}

/**
 * Lot 8A (décision du dirigeant) — sur une session à plusieurs formateurs, SEUL le
 * formateur qui anime la DERNIÈRE journée remet le bilan ; les autres sont payés sur leurs
 * feuilles de présence seules (dernier mois compris).
 *
 * La dernière journée est la plus tardive (date, puis heure de fin). Son formateur est
 * celui qui y est désigné (`SessionJour.trainerId`), sinon le formateur principal de la
 * session (`formateurPrincipalId`, sinon l'affectation de rôle « principal »). Sans aucun
 * de ces repères, personne n'est écarté : chacun garde le bilan, comme avant.
 */
export function remetLeBilan(
  trainerId: string,
  s: {
    readonly formateurPrincipalId?: string | null;
    readonly sessionFormateurs?: ReadonlyArray<{
      readonly trainerId: string;
      readonly role?: string;
    }>;
    readonly jours: ReadonlyArray<{
      readonly date: Date;
      readonly heureFin: string;
      readonly trainerId: string | null;
    }>;
  },
): boolean {
  // Les journées qui finissent le plus tard (date, puis heure de fin). Plusieurs à égalité
  // (groupes en parallèle) : chacun de leurs formateurs remet le bilan — jamais un choix
  // qui dépendrait de l'ordre des lignes en base.
  let fin: { jour: JourCivil; heureFin: string } | null = null;
  let dernieres: Array<string | null> = [];
  for (const j of s.jours) {
    const jour = jourDeColonneDate(j.date);
    if (fin === null || jour > fin.jour || (jour === fin.jour && j.heureFin > fin.heureFin)) {
      fin = { jour, heureFin: j.heureFin };
      dernieres = [j.trainerId];
    } else if (jour === fin.jour && j.heureFin === fin.heureFin) {
      dernieres.push(j.trainerId);
    }
  }
  if (fin === null) return true;
  const principal =
    s.formateurPrincipalId ??
    s.sessionFormateurs?.find((sf) => sf.role === "principal")?.trainerId ??
    null;
  const animateurs = dernieres.map((t) => t ?? principal);
  // Un animateur inconnu : personne n'est écarté (comme avant).
  if (animateurs.some((a) => a === null)) return true;
  return animateurs.includes(trainerId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Relance (J+2, J+7) et alerte interne (J+10)
// ─────────────────────────────────────────────────────────────────────────────

export const ID_CAMPAGNE_BILAN = "bilan-fin-formation";
export const GABARIT_RELANCE_BILAN = "formateur-bilan-fin-formation" as const;
export const ALERTE_BILAN_JOURS = 10;

/** J+2 puis J+7 après la dernière journée ; rien après 14 jours, une par jour, 8 h - 19 h. */
export const REGLE_RELANCE_BILAN: RegleCampagne<"j2" | "j7"> = {
  etapes: [
    { id: "j2", delaiMs: 2 * JOUR_MS },
    { id: "j7", delaiMs: 7 * JOUR_MS },
  ],
  ecartMinMs: 2 * JOUR_MS,
  silenceApresMs: 14 * JOUR_MS,
  max: 2,
  unParJour: true,
  fenetre: FENETRE_ENVOI_PAR_DEFAUT,
};

/** Ce qui est lu en base pour un couple (formateur, session). */
export interface LigneRelanceBilan {
  readonly trainerId: string;
  readonly sessionId: string;
  readonly email: string;
  readonly prenom: string;
  readonly intitule: string;
  readonly derniereJournee: JourCivil;
  readonly termine: boolean;
  readonly payerQuandMeme: boolean;
  /** Collaboration finie. */
  readonly fermee: boolean;
  /** Relances de CETTE session déjà tentées. */
  readonly relances: readonly Date[];
  readonly adresseMorte: boolean;
  readonly opposition: boolean;
}

const estEffacee = (adresse: string): boolean =>
  adresse.endsWith("@erased.local") || adresse === "[erased-rgpd-art17]";

/** Midi UTC du jour civil : le jour de Paris est le même en toute saison. */
const midiDu = (jour: JourCivil): Date => new Date(`${jour}T12:00:00Z`);

/** Les faits de campagne d'un couple, ou `null` sans lien vers l'espace. */
export function faitsRelanceBilan(l: LigneRelanceBilan, lien: string | null): FaitsCampagne | null {
  if (lien === null) return null;
  return {
    entityId: l.trainerId,
    personneId: l.trainerId,
    // La session entre dans la clé d'envoi : une relance par session, jamais doublée.
    origineId: l.sessionId,
    destinataire: l.email,
    etat: {
      origine: midiDu(l.derniereJournee),
      envois: l.relances,
      efface: estEffacee(l.email),
      opposition: l.opposition,
      adresseMorte: l.adresseMorte,
      close: l.fermee,
      actionFaite: l.termine || l.payerQuandMeme,
      reponseHumaine: false,
    },
    payload: {
      ...(l.prenom.trim() ? { prenom: l.prenom.trim() } : {}),
      lien,
      valeurs: { intitulé: l.intitule },
    },
  };
}

/** L'alerte interne est due à partir de J+10, si le bilan manque toujours. */
export function bilanAAlerter(
  l: Pick<LigneRelanceBilan, "derniereJournee" | "termine" | "payerQuandMeme" | "fermee">,
  maintenant: Date,
): boolean {
  if (l.termine || l.payerQuandMeme || l.fermee) return false;
  return joursEntre(l.derniereJournee, jourParis(maintenant)) >= ALERTE_BILAN_JOURS;
}
