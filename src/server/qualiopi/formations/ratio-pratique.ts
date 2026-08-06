/**
 * Qualiopi — RATIO DE PRATIQUE d'une formation (module PUR, aucun accès Prisma).
 *
 * ## Ce que ce fichier corrige
 *
 * 🔴 Constaté le 2026-08-06 : `catalog-import.ts` écrivait
 * `RATIO_PRATIQUE_PCT = 70` EN DUR pour les 22 formations du catalogue, et le
 * poussait dans `Formation.ratioPratiquePct` — c'est-à-dire dans le programme
 * officiel remis au client et à l'OPCO. Personne n'avait jamais vérifié ce
 * chiffre. Les minutages reconstitués par cinq contrôleurs donnent en réalité
 * entre 41 % et 62 % : un écart de 8 à 29 points, sur une donnée opposable.
 *
 * Tant qu'aucun programme n'était minuté, l'écart était invérifiable. Le publier
 * le rendrait auditable — et contredit par nos propres chiffres.
 *
 * ## Le principe retenu
 *
 * On ne déclare QUE ce qu'on sait calculer. Un programme sans durées ne produit
 * pas un chiffre de repli : il produit `null`. Une case vide se corrige ; un
 * chiffre faux se défend en audit.
 *
 * ## Le seuil dépend du FORMAT, pas d'une règle unique
 *
 * Le référentiel Qualiopi n'impose AUCUN pourcentage de pratique — il exige que
 * les contenus soient adaptés aux objectifs (indicateur 6) et que leur atteinte
 * soit mesurée (indicateur 11). Le seuil est donc une exigence MAISON, et une
 * exigence unique était inadaptée : une découverte de 4 heures doit poser le
 * cadre (régimes d'usage, ce qui ne sort jamais, méthode) là où un atelier de
 * deux jours peut produire presque tout le temps.
 *
 * Décision de Will, 2026-08-06 : 40 % en 4 h, 50 % en 1 jour, 60 % au-delà.
 */

import type { FormationDuree } from "@/content/pricing";

/**
 * Ce qui compte comme du temps de PRATIQUE.
 *
 * Le participant manipule, produit ou corrige. Une démonstration faite par le
 * formateur, un exposé ou un tour de table n'en sont pas — sans cette
 * définition, chacun compte comme il l'entend et deux contrôleurs ne trouvent
 * jamais le même chiffre.
 */
export const BLOCS_COMPTES_COMME_PRATIQUE = ["pratique", "verification"] as const;

/** Seuil attendu par format. Exigence maison, pas exigence Qualiopi. */
export const SEUIL_PRATIQUE_PAR_FORMAT: Record<FormationDuree, number> = {
  "4h": 40,
  "1j": 50,
  "2j": 60,
  "3j": 60,
};

/** Temps de face-à-face dû, en minutes. Le déjeuner n'en fait pas partie. */
export const MINUTES_DUES_PAR_FORMAT: Record<FormationDuree, number> = {
  "4h": 240,
  "1j": 420,
  "2j": 840,
  "3j": 1260,
};

export interface RatioPratique {
  /**
   * Ratio en pourcentage entier, ou `null` si le programme ne porte pas de
   * durées. `null` signifie « on ne sait pas », jamais « zéro ».
   */
  pct: number | null;
  /** Minutes de pratique et de vérification identifiées. */
  minutesPratique: number;
  /** Minutes totales programmées (tous blocs). */
  minutesProgrammees: number;
  /** Minutes dues au titre du format vendu. */
  minutesDues: number;
  /** Seuil attendu pour ce format. */
  seuilPct: number;
  /** Le ratio atteint-il le seuil ? `false` si inconnu — on ne présume pas. */
  atteintSeuil: boolean;
  /** Minutes vendues mais non programmées (0 si le programme est complet). */
  minutesNonProgrammees: number;
}

/**
 * Calcule le ratio de pratique d'un programme.
 *
 * ⚠️ Le dénominateur est le temps VENDU, jamais le temps écrit. Rapporter la
 * pratique au seul temps programmé ferait MONTER le ratio à mesure qu'on écrit
 * moins — un programme à moitié vide afficherait le meilleur score du
 * catalogue. C'est la convention qui a fait diverger les contrôleurs de cinq à
 * dix points ; elle est tranchée ici, une fois.
 */
export function calculerRatioPratique(modules: unknown[], format: FormationDuree): RatioPratique {
  return calculerRatioPratiquePourMinutes(modules, MINUTES_DUES_PAR_FORMAT[format]);
}

/**
 * Seuil attendu pour une durée vendue exprimée en minutes.
 *
 * Le diagnostic d'une formation connaît un nombre d'heures, jamais un format
 * catalogue : une formation créée à la main dans la console peut durer 5 h. Sans
 * cette passerelle, elle serait jugée sur le seuil d'un format qu'elle n'a pas —
 * ou, pire, sur un second seuil écrit ailleurs, ce qui était le cas.
 *
 * On retient le seuil du format le plus proche PAR EXCÈS : une demi-journée
 * allongée reste jugée comme une journée, jamais plus sévèrement que le format
 * vendu au-dessus d'elle.
 */
export function seuilPratiquePourMinutes(minutesDues: number): number {
  if (minutesDues <= MINUTES_DUES_PAR_FORMAT["4h"]) return SEUIL_PRATIQUE_PAR_FORMAT["4h"];
  if (minutesDues <= MINUTES_DUES_PAR_FORMAT["1j"]) return SEUIL_PRATIQUE_PAR_FORMAT["1j"];
  return SEUIL_PRATIQUE_PAR_FORMAT["2j"];
}

/**
 * Cœur du calcul, exprimé en minutes dues. `calculerRatioPratique` n'en est
 * qu'une façade par format.
 */
export function calculerRatioPratiquePourMinutes(
  modules: unknown[],
  minutesDues: number,
): RatioPratique {
  const seuilPct = seuilPratiquePourMinutes(minutesDues);

  let minutesPratique = 0;
  let minutesProgrammees = 0;
  let auMoinsUneDuree = false;

  /** Ajoute une durée au total, et à la pratique si le type s'y prête. */
  const compter = (duree: unknown, nature: string) => {
    if (typeof duree !== "number" || !Number.isFinite(duree) || duree <= 0) return;
    auMoinsUneDuree = true;
    minutesProgrammees += duree;
    if ((BLOCS_COMPTES_COMME_PRATIQUE as readonly string[]).includes(nature)) {
      minutesPratique += duree;
    }
  };

  for (const brut of Array.isArray(modules) ? modules : []) {
    if (brut === null || typeof brut !== "object") continue;
    const m = brut as Record<string, unknown>;

    /**
     * Deux formes coexistent, et le calcul doit lire les deux :
     *  — le module du CATALOGUE, dont les séquences sont une liste, chacune
     *    portant son `type` et sa durée ;
     *  — le module ENRICHI, dont les cinq blocs sont des propriétés nommées
     *    (`objectif`, `pratique`…) portant chacune sa durée.
     *
     * ⚠️ Un module enrichi porte les DEUX : ses cinq blocs de contenu ET ses
     * séquences. Les additionner compterait chaque minute deux fois, et le
     * ratio d'une formation entièrement rédigée doublerait du jour au
     * lendemain. Les séquences font foi quand elles portent des durées : ce
     * sont elles qui sont publiées sur la fiche, elles qui somment au temps
     * vendu, et elles que l'auditeur lit. Les durées des blocs ne servent qu'à
     * répartir le contenu à l'intérieur d'un module non séquencé.
     */
    let compteSurSequences = false;
    const sequences = m["sequences"];
    if (Array.isArray(sequences)) {
      for (const s of sequences) {
        if (s === null || typeof s !== "object") continue;
        const seq = s as { dureeMin?: unknown; type?: unknown };
        if (typeof seq.dureeMin === "number" && seq.dureeMin > 0) compteSurSequences = true;
        compter(seq.dureeMin, typeof seq.type === "string" ? seq.type : "");
      }
    }
    if (compteSurSequences) continue;

    for (const [cle, valeur] of Object.entries(m)) {
      if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) continue;
      compter((valeur as { dureeMin?: unknown }).dureeMin, cle);
    }
  }

  // Une durée vendue nulle ou aberrante ne produit pas `Infinity` : elle produit
  // « on ne sait pas », comme un programme sans durées.
  const calculable = auMoinsUneDuree && Number.isFinite(minutesDues) && minutesDues > 0;
  const pct = calculable ? Math.round((minutesPratique / minutesDues) * 100) : null;

  return {
    pct,
    minutesPratique,
    minutesProgrammees,
    minutesDues,
    seuilPct,
    atteintSeuil: pct !== null && pct >= seuilPct,
    minutesNonProgrammees: Math.max(0, minutesDues - minutesProgrammees),
  };
}

/**
 * Valeur à écrire dans `Formation.ratioPratiquePct`.
 *
 * 🔴 Rend `null` quand le programme ne porte pas de durées. C'est le cœur du
 * correctif : mieux vaut une case vide, qui appelle une correction, qu'un 70 %
 * inventé que l'organisme devrait défendre devant un auditeur.
 */
export function ratioPratiqueDeclarable(modules: unknown[], format: FormationDuree): number | null {
  return calculerRatioPratique(modules, format).pct;
}
