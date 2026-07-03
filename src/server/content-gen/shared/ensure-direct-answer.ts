/**
 * Réparation ciblée du `directAnswer` (P0 auto-publish 2026-07-03).
 *
 * Le gate de complétude `data-quality-gate` exige un `directAnswer` ≥ 40 mots
 * (réponse citable Position 0 / AI Overview / vocal — cf. data-quality-gate.ts).
 * Or le PLAN des générateurs (blog-article, guide-pilier, etc.) rend PARFOIS un
 * `directAnswer` trop court, et la boucle d'expansion n'étoffe QUE le corps
 * (`expandOutlineChunked`) → l'article arrive court au gate et échoue en
 * `failed` à la publication, sans jamais être publié.
 *
 * Ce module ré-génère UNIQUEMENT le `directAnswer` quand il est sous le
 * plancher, via un appel LLM court et ciblé. Il est :
 *   - FAIL-OPEN : toute erreur LLM → l'original est conservé (aucune exception
 *     propagée), le gate reste le garde-fou.
 *   - NON-RÉGRESSIF : le candidat n'est retenu QUE s'il atteint le plancher ;
 *     sinon l'original est conservé. On ne retourne JAMAIS plus court que
 *     l'entrée → aucun article aujourd'hui conforme ne peut être dégradé.
 *
 * Pur (aucune dépendance DB / provider) : la fonction LLM est injectée →
 * testable en isolation (cf. __tests__/ensure-direct-answer.spec.ts).
 */

/** Plancher aligné sur `data-quality-gate.ts` (MIN_DIRECT_ANSWER_WORDS). */
export const MIN_DIRECT_ANSWER_WORDS = 40;
/** Plafond visé (le gate n'impose pas de max ; c'est une cible de concision). */
export const MAX_DIRECT_ANSWER_WORDS = 80;

/** Compte de mots identique à celui du gate (`data-quality-gate.ts`). */
const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Appel LLM injecté (thin wrapper autour de `provider-router.generate`).
 * Retourne le texte brut + le coût USD pour le cost-tracking amont.
 */
export interface DirectAnswerGenerateFn {
  (req: {
    readonly systemPrompt: string;
    readonly userPrompt: string;
    readonly maxTokens: number;
    readonly temperature: number;
  }): Promise<{ readonly output: string; readonly costUsd: number }>;
}

export interface EnsureDirectAnswerParams {
  /** `directAnswer` courant issu du générateur (peut être vide/court). */
  readonly current: string | null | undefined;
  /** Sujet de l'article (titre ou mot-clé) — ancre de la réponse directe. */
  readonly title: string;
  /** Corps rendu (prose) — contexte factuel pour garder la cohérence. */
  readonly bodyText: string;
  /** Appel LLM injecté (fail-open géré par l'appelant OU en interne). */
  readonly generate: DirectAnswerGenerateFn;
}

export interface EnsureDirectAnswerResult {
  /** `directAnswer` final (réparé si possible, sinon l'original tel quel). */
  readonly directAnswer: string;
  /** true UNIQUEMENT si une réparation a remplacé l'original par un ≥ plancher. */
  readonly repaired: boolean;
  /** Coût USD de l'appel de réparation (0 si aucun appel). */
  readonly costUsd: number;
}

/**
 * Garantit un `directAnswer` ≥ MIN_DIRECT_ANSWER_WORDS quand c'est possible,
 * sans jamais dégrader une entrée déjà conforme ni propager d'erreur.
 */
export async function ensureDirectAnswer(
  params: EnsureDirectAnswerParams,
): Promise<EnsureDirectAnswerResult> {
  const current = (params.current ?? "").trim();

  // Déjà conforme → no-op (cas majoritaire, aucun appel LLM).
  if (wordCount(current) >= MIN_DIRECT_ANSWER_WORDS) {
    return { directAnswer: current, repaired: false, costUsd: 0 };
  }

  const context = params.bodyText.trim().slice(0, 1200);
  const title = params.title.trim();
  // Sans sujet exploitable, aucune réparation fiable possible → on garde tel quel.
  if (title.length === 0) {
    return { directAnswer: current, repaired: false, costUsd: 0 };
  }

  const systemPrompt =
    "Tu es un rédacteur SEO/AEO francophone. Tu écris UNIQUEMENT un paragraphe de " +
    "réponse directe, autonome, factuel et citable seul par une IA (AI Overview / " +
    "recherche vocale). Aucune salutation, aucune méta-phrase, aucun titre, aucun " +
    "markdown, aucune liste : seulement le paragraphe de réponse.";
  const userPrompt =
    `Rédige une RÉPONSE DIRECTE au sujet suivant, en français, de ` +
    `${MIN_DIRECT_ANSWER_WORDS} à ${MAX_DIRECT_ANSWER_WORDS} mots ` +
    `(jamais moins de ${MIN_DIRECT_ANSWER_WORDS}), autonome et complète ` +
    `(le « quoi », le « comment » et le « pourquoi » concrets).\n\n` +
    `Sujet : "${title}"` +
    (context.length > 0
      ? `\n\nContexte de l'article (reste factuellement cohérent avec lui) :\n${context}`
      : "");

  let candidate = "";
  let costUsd = 0;
  try {
    const res = await params.generate({
      systemPrompt,
      userPrompt,
      maxTokens: 300,
      temperature: 0.5,
    });
    candidate = (res.output ?? "").trim();
    costUsd = res.costUsd ?? 0;
  } catch {
    // Fail-open : on conserve l'original (le gate reste le garde-fou).
    return { directAnswer: current, repaired: false, costUsd: 0 };
  }

  // Non-régression stricte : le candidat n'est retenu que s'il atteint le
  // plancher. Sinon on conserve l'original (jamais pire que l'entrée).
  if (wordCount(candidate) >= MIN_DIRECT_ANSWER_WORDS) {
    return { directAnswer: candidate, repaired: true, costUsd };
  }
  return { directAnswer: current, repaired: false, costUsd };
}
