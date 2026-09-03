/**
 * Un formateur affecté sur des dates où il s'est déclaré INDISPONIBLE (2026-09-03).
 *
 * `joursEnConflit` existait dans `availability.ts` — et n'était appelé nulle
 * part. Le cockpit savait poser des congés, la session savait poser des dates,
 * personne ne les croisait : une formation vendue sur les congés du formateur
 * ne déclenchait rien, ni à l'affectation, ni après.
 *
 * Ce module est le SEUL endroit qui fait ce croisement. L'affectation
 * (avertissement, non bloquant — décision Will : le système informe) et
 * l'alerte quotidienne (`formateur_indisponible_sur_session`) l'appellent tous
 * deux ; deux calculs diraient un jour deux choses.
 */

import { prisma } from "@/lib/prisma";
import {
  dayKeyOfDateColumn,
  joursEnConflit,
  joursIndisponibles,
  LIBELLE_INDISPO,
  MAX_JOURS_FENETRE,
  type Indisponibilite,
} from "./availability";

export interface SessionDatee {
  dateDebut: Date;
  dateFin: Date | null;
  /** Journées saisies : si présentes, ce sont ELLES les jours de la session. */
  jours?: ReadonlyArray<{ date: Date }>;
}

/**
 * Les jours (clés `AAAA-MM-JJ`) que la session OCCUPE. Journées saisies si
 * elles existent — c'est la vérité la plus fine — sinon tout l'intervalle.
 * Plafonné comme les indisponibilités, pour la même raison.
 */
export function joursDeSession(s: SessionDatee): string[] {
  if (s.jours !== undefined && s.jours.length > 0) {
    return s.jours.map((j) => dayKeyOfDateColumn(j.date));
  }
  const jours: string[] = [];
  const curseur = new Date(
    Date.UTC(s.dateDebut.getUTCFullYear(), s.dateDebut.getUTCMonth(), s.dateDebut.getUTCDate()),
  );
  const finSource = s.dateFin ?? s.dateDebut;
  const fin = new Date(
    Date.UTC(finSource.getUTCFullYear(), finSource.getUTCMonth(), finSource.getUTCDate()),
  );
  while (curseur.getTime() <= fin.getTime() && jours.length < MAX_JOURS_FENETRE) {
    jours.push(dayKeyOfDateColumn(curseur));
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return jours;
}

export interface ConflitIndisponibilite {
  /** Jours de la session tombant sur une indisponibilité, triés. */
  jours: string[];
  /** Les types d'indisponibilité rencontrés (« Congés », « Maladie »…), dédoublonnés. */
  types: string[];
}

/** Croisement PUR : session × indisponibilités du formateur. */
export function conflitIndisponibilite(
  session: SessionDatee,
  indispos: readonly Indisponibilite[],
): ConflitIndisponibilite | null {
  const jours = joursEnConflit(joursDeSession(session), joursIndisponibles(indispos));
  if (jours.length === 0) return null;
  const types = [...new Set(indispos.map((i) => LIBELLE_INDISPO[i.type]))];
  return { jours: [...jours].sort(), types };
}

/** « 3 jours (Congés) : 15/09, 16/09, 17/09 » — la phrase de l'avertissement et de l'alerte. */
export function formulerConflit(c: ConflitIndisponibilite): string {
  const n = c.jours.length;
  const liste = c.jours
    .slice(0, 5)
    .map((j) => `${j.slice(8, 10)}/${j.slice(5, 7)}`)
    .join(", ");
  const suite = n > 5 ? "…" : "";
  return `${n} jour${n > 1 ? "s" : ""} (${c.types.join(", ")}) : ${liste}${suite}`;
}

/**
 * Le croisement pour UN formateur et UNE session, depuis la base. `null` sans
 * conflit — et `null` aussi si la lecture échoue : on n'invente pas un congé.
 */
export async function detecterIndisponibiliteFormateur(
  trainerId: string,
  session: SessionDatee,
): Promise<ConflitIndisponibilite | null> {
  try {
    const fin = session.dateFin ?? session.dateDebut;
    const rows = await prisma.trainerAvailability.findMany({
      where: { trainerId, dateDebut: { lte: fin }, dateFin: { gte: session.dateDebut } },
      select: { trainerId: true, type: true, dateDebut: true, dateFin: true },
    });
    const indispos: Indisponibilite[] = rows.map((r) => ({
      trainerId: r.trainerId,
      type: r.type,
      debut: dayKeyOfDateColumn(r.dateDebut),
      fin: dayKeyOfDateColumn(r.dateFin),
    }));
    return conflitIndisponibilite(session, indispos);
  } catch {
    return null;
  }
}
