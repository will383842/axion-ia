/**
 * Qualiopi — Formation Engine T5 : Validation excellence pédagogique.
 *
 * Module PUR — zéro IA, zéro DB, testable directement.
 *
 * Règles métier :
 * - séquences de modules consécutifs > 45 min sans synthèse/évaluation → FAIL
 * - fil_rouge manquant → WARN
 * - livrables (j0/j1/j30) manquants → WARN
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SynthesisError {
  moduleIndex: number;
  dureeMin: number;
  message: string;
}

export interface ExcellenceValidationResult {
  synthesesOk: boolean;
  synthesesErrors: SynthesisError[];
  filRougeOk: boolean;
  livrablesOk: boolean;
  verdict: "PASS" | "WARN" | "FAIL";
  axesCorrection: string[];
}

// ── Constantes ────────────────────────────────────────────────────────────────

/** Durée maximale acceptable entre deux moments de synthèse/évaluation (minutes). */
const MAX_ACCUMULATION_MIN = 45;

/** Types de modules qui réinitialisent le compteur de durée accumulée. */
const RESET_TYPES = new Set(["synthese", "evaluation"]);

/** Clés de livrables attendus dans le programme. */
const LIVRABLES_KEYS = ["livrables_j0", "livrables_j1", "livrables_j30"] as const;

// ── Validation principale ─────────────────────────────────────────────────────

/**
 * Valide la qualité d'excellence d'un programme de formation.
 *
 * @param programme - Objet programme issu de la génération IA (structure libre).
 *   Champs lus : programme.modules (array), programme.fil_rouge (string),
 *   programme.livrables_j0/j1/j30 (any).
 */
export function validateExcellence(programme: Record<string, unknown>): ExcellenceValidationResult {
  const axesCorrection: string[] = [];

  // ── 1. Vérification des synthèses (séquences > 45 min) ────────────────────

  const synthesesErrors: SynthesisError[] = [];
  const modules = Array.isArray(programme?.["modules"]) ? programme["modules"] : [];

  let accumulatedMin = 0;
  let firstModuleIndex = 0;

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    const duree =
      typeof mod === "object" &&
      mod !== null &&
      typeof (mod as Record<string, unknown>)["dureeMinutes"] === "number"
        ? ((mod as Record<string, unknown>)["dureeMinutes"] as number)
        : 0;
    const type =
      typeof mod === "object" &&
      mod !== null &&
      typeof (mod as Record<string, unknown>)["type"] === "string"
        ? ((mod as Record<string, unknown>)["type"] as string)
        : "";

    if (RESET_TYPES.has(type)) {
      // Ce module est une synthèse/évaluation : reset le compteur
      accumulatedMin = 0;
      firstModuleIndex = i + 1;
    } else {
      accumulatedMin += duree;
      if (accumulatedMin > MAX_ACCUMULATION_MIN) {
        synthesesErrors.push({
          moduleIndex: firstModuleIndex,
          dureeMin: accumulatedMin,
          message: `Séquence de ${accumulatedMin} min sans synthèse ni évaluation (max : ${MAX_ACCUMULATION_MIN} min). Insérer un moment de synthèse à partir du module ${firstModuleIndex}.`,
        });
        // Réinitialise pour ne pas re-signaler la même séquence
        accumulatedMin = 0;
        firstModuleIndex = i + 1;
      }
    }
  }

  const synthesesOk = synthesesErrors.length === 0;

  // ── 2. Vérification fil rouge ──────────────────────────────────────────────

  const filRouge = programme?.["fil_rouge"];
  const filRougeOk = typeof filRouge === "string" && filRouge.trim().length > 0;

  // ── 3. Vérification livrables ─────────────────────────────────────────────

  const livrablesOk = LIVRABLES_KEYS.some((key) => {
    const val = programme?.[key];
    return val !== undefined && val !== null && val !== "";
  });

  // ── 4. Construction du verdict ────────────────────────────────────────────

  if (!synthesesOk) {
    for (const err of synthesesErrors) {
      axesCorrection.push(err.message);
    }
  }

  if (!filRougeOk) {
    axesCorrection.push(
      "Le fil rouge narratif est absent ou vide. Définir une métaphore ou un cas pratique fil conducteur sur toute la formation.",
    );
  }

  if (!livrablesOk) {
    axesCorrection.push(
      "Aucun livrable défini (j0/j1/j30). Préciser les livrables remis à J0 (support), J1 (exercices) et J30 (auto-évaluation différée).",
    );
  }

  let verdict: "PASS" | "WARN" | "FAIL";
  if (!synthesesOk) {
    verdict = "FAIL";
  } else if (!filRougeOk || !livrablesOk) {
    verdict = "WARN";
  } else {
    verdict = "PASS";
  }

  return {
    synthesesOk,
    synthesesErrors,
    filRougeOk,
    livrablesOk,
    verdict,
    axesCorrection,
  };
}
