/**
 * « Ce formateur peut-il animer, et si oui : que manque-t-il à son dossier ? »
 *
 * ## Le défaut que ce module ferme
 *
 * 🔴 `D2-5-06` (audit E2E 2026-08-20). Un sous-traitant peut animer **sans
 * contrat de sous-traitance** — pièce que `trainers/conformite.ts` classe
 * pourtant `bloquant` (`REQUIS_SOUS_TRAITANT`).
 *
 * La cause n'était pas l'absence de contrôle : `assignerFormateurAction` calcule
 * bien ces manquements et les remonte à l'écran. Mais **elle n'est pas la seule
 * voie d'affectation** : `createSessionAction` accepte un `trainerId` dès la
 * création, et n'a jamais interrogé la conformité documentaire.
 *
 * Un sous-traitant sans contrat posé à la création traversait donc tout le cycle
 * sans qu'un seul écran ne le signale.
 *
 * ⚠️ Vérifié, pas supposé : ce sont bien les DEUX seules voies.
 * `creerSessionsRecurrentesAction` ne prend aucun `trainerId` — les occurrences
 * naissent sans intervenant. Et le REPORT recopie les formateurs de la session
 * d'origine, ce qui n'est pas une décision d'affectation : avertir à cet endroit
 * ferait réapparaître, à chaque report, un manquement déjà signalé au moment où
 * quelqu'un l'a réellement décidé.
 *
 * 🔑 C'est la forme la plus coûteuse de faux sentiment de sécurité : le contrôle
 * EXISTE, on l'a vu marcher une fois, et on en conclut qu'il couvre le sujet.
 *
 * ## Pourquoi AVERTIR et non bloquer
 *
 * L'habilitation est un refus dur, et le reste : un formateur non habilité sur
 * une formation ne doit pas l'animer, la question ne se discute pas.
 *
 * La conformité documentaire est un signal. Refuser une affectation parce qu'un
 * Kbis n'a pas encore été téléversé empêcherait de planifier une session pour
 * une pièce qui arrivera demain — et une garde qui empêche de travailler finit
 * par être retirée. C'est l'arbitrage déjà écrit dans `assignerFormateurAction`
 * (« AVERTISSEMENT, jamais blocage ») ; ce module l'étend, il ne le change pas.
 *
 * ⚠️ Ce qui rendrait ce module NUISIBLE serait qu'il fasse échouer une
 * affectation déjà écrite en base. Toute la lecture est donc fail-soft : une
 * conformité illisible n'avertit de rien plutôt que d'inventer.
 */

import { getTrainerConformite } from "@/server/qualiopi/trainers/documents";

/**
 * Les manquements BLOQUANTS du dossier d'un formateur, en clair.
 *
 * @returns les messages à afficher, ou `[]` — jamais `null` : l'appelant ne doit
 *          pas avoir à distinguer « rien à signaler » de « je n'ai pas su lire »,
 *          il ne peut rien faire de la différence au moment où il affecte.
 */
export async function avertissementsAffectation(
  trainerId: string | null,
  now: Date = new Date(),
): Promise<string[]> {
  if (trainerId === null) return [];
  try {
    const conformite = await getTrainerConformite(trainerId, now.getFullYear(), now);
    if (conformite === null) return [];
    // ⚠️ `bloquant` SEULEMENT. Les `alerte` (CV obsolète, RC pro absente à
    // l'entrée) sont suivies ailleurs, dans la console. Les remonter ici
    // noierait le manquement qui compte — et un avertissement qu'on apprend à
    // survoler ne vaut pas mieux que pas d'avertissement.
    return conformite.manquements.filter((m) => m.gravite === "bloquant").map((m) => m.message);
  } catch {
    return [];
  }
}
