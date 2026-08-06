// ============================================================================
// CATALOGUE V2 — dérivation horaire du déroulé (présentation).
//
// Le SSOT `catalog-v2.ts` stocke le déroulé en DURÉES (« 15' », « 60' »,
// « Pause ») — pratique pour la pédagogie/Qualiopi (PHASE B), mais la timeline
// publique (`DayScheduleSection`) attend de VRAIES HEURES d'horloge, comme les
// anciennes fiches `/interventions` (« 9 h 00 » → « 17 h 00 »).
//
// Cette couche convertit les durées en heures d'horloge À L'AFFICHAGE, sans
// jamais muter les données du catalogue (elles restent utilisées par le HowTo
// JSON-LD et le kit pédagogique). Convention :
//   • section « Matin » / « Demi-journée » / « Jour X »  → démarre à 09 h 00
//   • section « Après-midi »                             → démarre à 14 h 00
//   • « Pause »                                          → heure + 15 min
//   • marqueur non numérique (« Jour 1 », « Fin J1 », …) → conservé verbatim
// ============================================================================

import type { FormationProgrammeSection } from "./catalog-v2";

export interface DerivedScheduleItem {
  /** Heure d'horloge (« 9 h 00 ») ou marqueur verbatim (« Jour 1 »). */
  time: string;
  title: string;
}

export interface DerivedScheduleSection {
  label: string;
  items: DerivedScheduleItem[];
}

const MORNING_START_MIN = 9 * 60; // 09 h 00
const AFTERNOON_START_MIN = 14 * 60; // 14 h 00
const PAUSE_MIN = 15; // pause café par défaut

/** Minutes depuis minuit → « 9 h 00 », « 14 h 30 » (format des anciennes fiches). */
function formatClock(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** « 35' » / « 60 » → minutes ; tout le reste (« Pause », « Jour 1 ») → null. */
function parseDurationMin(temps: string | undefined): number | null {
  if (!temps) return null;
  const match = /^(\d+)\s*'?$/.exec(temps.trim());
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

/** Demi-journée à laquelle une section appartient. */
type DemiJournee = "matin" | "apresMidi";

/** Repère de calendrier porté par l'intitulé d'une section. */
interface RepereSection {
  /** Numéro de jour (« J2 », « Jour 2 »), ou `null` si l'intitulé n'en porte pas. */
  jour: number | null;
  /** Demi-journée, ou `null` si l'intitulé n'en porte pas. */
  demi: DemiJournee | null;
}

/**
 * Lit le repère de calendrier d'un intitulé de section, sans rien décider.
 *
 * Les trois conventions de nommage du catalogue coexistent et doivent toutes
 * être lues : « Matin — … » (fiche découpée en demi-journées), « Matin · Module
 * 2 — … » (fiche découpée en modules), « Matin J2 · Module 4 — … » (fiche sur
 * plusieurs jours). Un intitulé qui ne porte aucun repère — un simple titre de
 * module — rend `null` sur les deux champs : il POURSUIT ce qui précède.
 */
function lireRepere(label: string): RepereSection {
  const l = label.trim().toLowerCase();
  const mJour = /\bj(?:our)?\s*(\d+)\b/.exec(l);
  const jour = mJour?.[1] !== undefined ? Number.parseInt(mJour[1], 10) : null;

  let demi: DemiJournee | null = null;
  if (/apr[eè]s[-\s]midi/.test(l)) demi = "apresMidi";
  else if (/\bmatin\b|\bdemi-journ[ée]e\b|\bjour\b|\bj\s*\d+\b/.test(l)) demi = "matin";

  return { jour, demi };
}

/**
 * Heure à laquelle une section démarre, ou `null` si elle poursuit l'horloge en
 * cours.
 *
 * 🔴 Deux corrections successives, le 2026-08-06, sur le même défaut.
 *
 * La version d'origine rendait TOUJOURS une heure : l'horloge repartait à 9 h 00
 * au début de chaque section. Invisible tant que les programmes ne se
 * découpaient qu'en « Matin » / « Après-midi ».
 *
 * La première correction ne repositionnait que sur « après-midi », « jour » ou
 * « matin » — mais les 22 squelettes révisés nomment leurs sections « Matin ·
 * Module 1 », « Matin · Module 2 ». Chaque module d'une même matinée
 * redéclenchait donc la remise à 9 h 00, et les modules 1 et 2 s'affichaient
 * intégralement superposés sur la fiche publique.
 *
 * La règle juste ne porte pas sur la PRÉSENCE d'un repère, mais sur son
 * CHANGEMENT : on ne repositionne l'horloge qu'en passant d'une demi-journée à
 * une autre, ou d'un jour au suivant. « Matin · Module 2 » après « Matin ·
 * Module 1 » désigne la même matinée : l'horloge continue d'avancer.
 */
function debutSection(repere: RepereSection, precedent: RepereSection | null): number | null {
  // Première section : elle pose l'horloge, sur sa demi-journée ou par défaut.
  if (precedent === null) {
    return repere.demi === "apresMidi" ? AFTERNOON_START_MIN : MORNING_START_MIN;
  }
  // Un intitulé sans repère poursuit toujours ce qui précède.
  if (repere.jour === null && repere.demi === null) return null;

  const memeJour = repere.jour === null || repere.jour === precedent.jour;
  const memeDemi = repere.demi === null || repere.demi === precedent.demi;
  if (memeJour && memeDemi) return null;

  const demi = repere.demi ?? precedent.demi;
  return demi === "apresMidi" ? AFTERNOON_START_MIN : MORNING_START_MIN;
}

/**
 * Convertit le déroulé en durées du catalogue en une timeline horaire.
 * Pure, déterministe, sans effet de bord. Robuste aux programmes hétérogènes
 * (4 h mono-section, 1 j Matin/Après-midi, 2-3 j à marqueurs grossiers).
 */
export function deriveProgrammeSchedule(
  programme: ReadonlyArray<FormationProgrammeSection>,
): DerivedScheduleSection[] {
  // L'horloge TRAVERSE les sections : un module enchaîne sur le précédent. Elle
  // n'est repositionnée qu'au CHANGEMENT de demi-journée ou de jour.
  let clock = MORNING_START_MIN;
  // Repère courant, toujours résolu : un intitulé muet hérite du précédent, de
  // sorte qu'une section ultérieure se compare à un état complet et non à des
  // trous. Sans cela, « Après-midi · Module 5 » après un titre de module nu
  // comparerait son jour à `null` et repositionnerait à tort.
  let precedent: RepereSection | null = null;

  return programme.map((section) => {
    const repere = lireRepere(section.titreFr);
    const impose = debutSection(repere, precedent);
    if (impose !== null) clock = impose;
    precedent = {
      jour: repere.jour ?? precedent?.jour ?? null,
      demi:
        repere.demi ?? precedent?.demi ?? (impose === AFTERNOON_START_MIN ? "apresMidi" : "matin"),
    };
    const items: DerivedScheduleItem[] = section.steps.map((step) => {
      const dur = parseDurationMin(step.temps);
      if (dur !== null) {
        const time = formatClock(clock);
        clock += dur;
        return { time, title: step.titre };
      }
      if (step.temps === "Pause") {
        const time = formatClock(clock);
        clock += PAUSE_MIN;
        return { time, title: step.titre };
      }
      // Marqueur non convertible (« Jour 1 », « Fin J1 », vide) : verbatim,
      // l'horloge ne progresse pas (aucune durée fiable à ajouter).
      return { time: step.temps ?? "", title: step.titre };
    });
    return { label: section.titreFr, items };
  });
}
