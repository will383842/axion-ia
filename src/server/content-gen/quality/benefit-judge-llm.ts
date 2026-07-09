/**
 * Content Generator — Juge LLM du benefit-gate (PH3, plan §4).
 *
 * Évalue, via un LLM, qu'un contenu COMMERCIAL parle au client (bénéfice perçu,
 * résonance métier, scénario, objection traitée). Porté du pack v2 `03` (runLLMJudge)
 * MAIS :
 *   - ✅ passe par `provider-router.generate` (COST-TRACKÉ + kill-switch + cap mensuel),
 *     JAMAIS `new Anthropic()` (le pack court-circuitait le cost-tracker).
 *   - fail-open : retourne `null` en cas d'échec/parse raté → l'appelant ignore le
 *     juge (jamais de blocage par erreur d'infra).
 *   - DORMANT : appelé uniquement par le worker quand le profil=commercial, qu'un
 *     `sectorPainContext` est résolu (pain-matrix) ET que le flag `benefit_gate.llmJudge`
 *     est ON. Coût ~1 appel court (maxTokens 300) par article commercial évalué.
 */

import { generate as routerGenerate } from "@/server/content-gen/providers/provider-router";

export interface BenefitJudgeContext {
  /** Douleur client ciblée (pain-matrix.painStatement). */
  readonly painStatement: string;
  /** Bénéfice à communiquer (pain-matrix.benefitMeasured). */
  readonly benefitMeasured: string;
  /** Vocabulaire métier attendu (pain-matrix.sectorLexicon). */
  readonly sectorLexicon: ReadonlyArray<string>;
}

export interface BenefitJudgeVerdict {
  /** total >= 70 (échelle 0-100). */
  readonly passed: boolean;
  /** Score 0-100. */
  readonly score: number;
  /** 1 phrase sur le principal défaut. */
  readonly feedback: string;
}

const JUDGE_SYSTEM_PROMPT = `Tu es un expert en marketing B2B pour des PME françaises. Tu évalues un contenu web écrit pour des entreprises (pas pour des développeurs).
Évalue sur 4 critères (0-25 chacun) :
1. BÉNÉFICE PERÇU : le chef d'entreprise non-tech comprend-il IMMÉDIATEMENT ce qu'il gagne ? (0=vague, 25=limpide et chiffré)
2. RÉSONANCE MÉTIER : le contenu parle-t-il le langage du client (pas de l'IA) ? (0=jargon tech, 25=vocabulaire métier pur)
3. SCÉNARIO CONCRET : situation réelle avant/après clairement identifiable ? (0=abstrait, 25=narratif clair)
4. CONFIANCE : traite-t-il au moins une objection de façon convaincante ? (0=aucune, 25=objection traitée cash)
Réponds UNIQUEMENT en JSON valide, sans markdown :
{"total":0,"feedback_court":"1 phrase max sur le principal défaut","passed":false}
"passed"=true si total >= 70.`;

function buildJudgeUserPrompt(content: string, ctx: BenefitJudgeContext): string {
  return (
    `CONTEXTE MÉTIER ATTENDU :\n` +
    `- Douleur client : "${ctx.painStatement}"\n` +
    `- Bénéfice à communiquer : "${ctx.benefitMeasured}"\n` +
    `- Vocabulaire métier : ${ctx.sectorLexicon.join(", ")}\n\n` +
    `CONTENU À ÉVALUER :\n---\n${content.slice(0, 3000)}\n---`
  );
}

function parseVerdict(raw: string): BenefitJudgeVerdict | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      total?: number;
      passed?: boolean;
      feedback_court?: string;
    };
    const score = typeof parsed.total === "number" ? Math.max(0, Math.min(100, parsed.total)) : 0;
    return {
      score,
      passed: parsed.passed === true || score >= 70,
      feedback: typeof parsed.feedback_court === "string" ? parsed.feedback_court : "",
    };
  } catch {
    return null;
  }
}

/**
 * Juge LLM (cost-tracké). Retourne `null` en cas d'échec → fail-open.
 */
export async function judgeBenefitConcreteness(args: {
  readonly content: string;
  readonly context: BenefitJudgeContext;
  readonly jobId: string;
  readonly contentType: string;
}): Promise<BenefitJudgeVerdict | null> {
  try {
    const res = await routerGenerate({
      jobId: args.jobId,
      contentType: args.contentType,
      role: "text",
      // Will 2026-07-09 : juge bénéfices sur OpenAI (plus de Claude). `text` ne
      // route plus que vers openai ; on force explicitement pour rester robuste
      // si le resolver `preferredProvider` revoyait anthropic un jour.
      preferredProvider: "openai",
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userPrompt: buildJudgeUserPrompt(args.content, args.context),
      maxTokens: 300,
      temperature: 0,
    });
    return parseVerdict(res.output);
  } catch {
    return null;
  }
}
