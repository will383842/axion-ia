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

/**
 * Heure imposée par l'intitulé d'une section, ou `null` si la section poursuit
 * simplement la précédente.
 *
 * 🔴 Corrigé le 2026-08-06. L'ancienne version rendait TOUJOURS une heure, et
 * `deriveProgrammeSchedule` réinitialisait donc l'horloge à 9 h 00 au début de
 * chaque section. Tant que les programmes n'étaient découpés qu'en « Matin » /
 * « Après-midi », le défaut restait invisible ; découpés en modules — ce que le
 * minutage des 22 fiches impose — les six modules d'une journée s'affichaient
 * tous comme démarrant à 9 h 00. Deux sections « Matin » se recouvraient
 * intégralement.
 *
 * Désormais : seuls un « Après-midi » (14 h) ou un nouveau « Jour » (9 h)
 * repositionnent l'horloge. Un module la laisse avancer.
 */
function sectionStartMin(label: string): number | null {
  const l = label.trim().toLowerCase();
  if (l.startsWith("après-midi")) return AFTERNOON_START_MIN;
  if (l.startsWith("jour") || l.startsWith("matin") || l.startsWith("demi-journée")) {
    return MORNING_START_MIN;
  }
  return null;
}

/**
 * Convertit le déroulé en durées du catalogue en une timeline horaire.
 * Pure, déterministe, sans effet de bord. Robuste aux programmes hétérogènes
 * (4 h mono-section, 1 j Matin/Après-midi, 2-3 j à marqueurs grossiers).
 */
export function deriveProgrammeSchedule(
  programme: ReadonlyArray<FormationProgrammeSection>,
): DerivedScheduleSection[] {
  // L'horloge TRAVERSE les sections : un module enchaîne sur le précédent.
  // Elle n'est repositionnée que sur un repère explicite (après-midi, jour).
  let clock = MORNING_START_MIN;
  return programme.map((section) => {
    const impose = sectionStartMin(section.titreFr);
    if (impose !== null) clock = impose;
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
