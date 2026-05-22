/**
 * Content Generator — LLM-as-judge (B.8 P0-3 P1.5 2026-05-21).
 *
 * Audit P1 (2026-05-21) findings A16 + A03 :
 *   - Quality-improver-worker = skeleton seul (increment counter + bascule status)
 *   - Aucune review LLM systematique des articles generes
 *   - Pas de scoring multi-dimensionnel
 *   - Pas de boucle improve avec re-prompt cible
 *
 * Cette implementation livre :
 *   - Reviewer Claude Sonnet 4.6 (distinct du generator pour eviter self-judge bias)
 *   - Rubric 7 dimensions (factual_accuracy, depth, originality, readability,
 *     seo_completeness, value_to_reader, tone_axionia_alignment)
 *   - Verdict : publish (>= 8.5) | improve (7-8.5) | reject (< 7)
 *   - Issues[] avec severity + section + fix suggestion
 *   - Cost tracking via provider anthropic existing
 *
 * Seuils editorial Will (D1 décision 2026-05-21 — aligné P5 D-P5-2 60/100) :
 *   - publish : globalScore >= 8.5 ET 0 P0 issue
 *   - improve : globalScore 6.0-8.4 OU >=1 P1 issue (max 2-3 iter via worker)
 *   - reject : globalScore < 6.0 OU >=1 P0 issue (escalate humain)
 */

import { anthropicProvider } from "@/server/content-gen/providers/anthropic";
import {
  analyzeDiversity,
  type DiversityScore,
} from "@/server/content-gen/linguistic/diversity-checker";

// ── Constants ────────────────────────────────────────────────────────────────

export const JUDGE_MODEL = "claude-sonnet-4-6" as const;

export const JUDGE_THRESHOLDS = {
  /** globalScore minimum pour publish direct. */
  PUBLISH_MIN: 8.5,
  /** globalScore minimum pour improve loop. D1=6.0, cohérent avec D-P5-2 (60/100). */
  IMPROVE_MIN: 6.0,
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export type JudgeVerdict = "publish" | "improve" | "reject";
export type IssueSeverity = "P0" | "P1" | "P2";

export interface ArticleForReview {
  readonly jobId: string;
  readonly title: string;
  readonly metaTitle?: string;
  readonly metaDescription?: string;
  readonly bodyHtml: string;
  readonly bodyText?: string;
  readonly faq?: ReadonlyArray<{ question: string; answer: string }>;
  readonly primaryKeyword?: string;
  /** Pour cost tracking + audit. Default 'editorial_review' si non fourni. */
  readonly contentType?: string;
}

export interface DimensionScore {
  readonly score: number; // 0-10
  readonly comment: string;
}

export interface JudgeIssue {
  readonly severity: IssueSeverity;
  readonly section: string;
  readonly issue: string;
  readonly suggestedFix: string;
}

export interface LinguisticDiversityDimension {
  /** Score brut retourné par analyzeDiversity. */
  readonly score: DiversityScore;
  /**
   * Score 0-10 calculé depuis les métriques de diversité.
   *
   * Déductions :
   *   ttr < 0.50          → -3 (P1 issue ajoutée)
   *   ttr [0.50, 0.65[    → -1
   *   stdSentenceLength < 3 → -2 (P2 issue ajoutée)
   *   passiveVoiceRatio > 0.30 → -2 (P1 issue ajoutée)
   *   passiveVoiceRatio [0.20, 0.30] → -1
   */
  readonly dimensionScore: number;
}

export interface JudgeResult {
  readonly verdict: JudgeVerdict;
  readonly globalScore: number; // 0-10 (moyenne ponderee)
  readonly dimensions: {
    readonly factualAccuracy: DimensionScore;
    readonly depth: DimensionScore;
    readonly originality: DimensionScore;
    readonly readability: DimensionScore;
    readonly seoCompleteness: DimensionScore;
    readonly valueToReader: DimensionScore;
    readonly toneAxioniaAlignment: DimensionScore;
  };
  /** 8e dimension — calculée localement, sans appel LLM. Optionnelle si bodyText absent. */
  readonly linguisticDiversity?: LinguisticDiversityDimension;
  readonly issues: ReadonlyArray<JudgeIssue>;
  readonly reasoning: string;
}

// ── Prompt (XML tagged for Claude) ───────────────────────────────────────────

export const JUDGE_SYSTEM_PROMPT = `Tu es un editeur senior B2B specialise dans le contenu IA conformite (RGPD, AI Act, Google HCU). Tu evalues des articles generes pour le site axion-ia.com (cabinet IA operationnel : interventions, audits, implementations, coaching 1-to-1, sites-web augmentes).

Ton job : noter l'article sur 7 dimensions (0-10 chacune) et donner un verdict ferme (publish / improve / reject). Tu ne diluies pas tes scores. Un score de 7 est correct mais perfectible. Un 9+ est exceptionnel.

<rubric>
1. **factual_accuracy** (0-10) : Affirmations chiffrees defendables ? Citations reelles ? Conformite RGPD/AI Act exacte ?
2. **depth** (0-10) : Va au-dela des generalites ? Apporte exemples concrets, etapes precises, cas terrain ?
3. **originality** (0-10) : Pas du copy-paste ChatGPT generique ? Point de vue cabinet IA distinct ?
4. **readability** (0-10) : Phrases courtes, structure h2/h3 logique, paragraphes < 4 lignes, jargon explique ?
5. **seo_completeness** (0-10) : title <= 60 chars optimise ? meta description 140-160 chars ? keyword dans h1 + 2 h2 ? FAQ couvrant longue traine ?
6. **value_to_reader** (0-10) : Le lecteur PME/ETI repart avec actions concretes ou juste de la theorie creuse ?
7. **tone_axionia_alignment** (0-10) : Ton consultatif precis sans sur-promesses. Pas de "magique"/"revolutionnaire". Axion-IA = cabinet operationnel, pas usine a contenu.
</rubric>

<thresholds>
- globalScore >= 8.5 ET 0 P0 issue → verdict = "publish"
- globalScore 6.0-8.4 OU >=1 P1 issue → verdict = "improve"
- globalScore < 6.0 OU >=1 P0 issue → verdict = "reject"
</thresholds>

<issues_severity>
- P0 : factual error, content filter risk, HCU/AI Act non-compliance, doctrine violation (SIREN/SIRET/RCS hardcode)
- P1 : structure cassee, seo incomplet, ton off-brand, depth manquant sur sujet annonce
- P2 : suggestion d'amelioration mineure, pas bloquant
</issues_severity>

<output_format>
Tu DOIS retourner un JSON strict (pas de markdown, pas de \`\`\`json, juste le JSON brut). Structure :

{
  "verdict": "publish" | "improve" | "reject",
  "globalScore": number (0-10, decimales OK),
  "dimensions": {
    "factualAccuracy": { "score": number, "comment": "string court" },
    "depth": { "score": number, "comment": "string court" },
    "originality": { "score": number, "comment": "string court" },
    "readability": { "score": number, "comment": "string court" },
    "seoCompleteness": { "score": number, "comment": "string court" },
    "valueToReader": { "score": number, "comment": "string court" },
    "toneAxioniaAlignment": { "score": number, "comment": "string court" }
  },
  "issues": [
    { "severity": "P0|P1|P2", "section": "h2 title or 'meta' or 'faq'", "issue": "description", "suggestedFix": "what to change" }
  ],
  "reasoning": "1-3 phrases expliquant le verdict global"
}
</output_format>`;

// ── Service ──────────────────────────────────────────────────────────────────

function buildUserPrompt(article: ArticleForReview): string {
  const parts: string[] = [];
  if (article.primaryKeyword) {
    parts.push(`<primary_keyword>${article.primaryKeyword}</primary_keyword>`);
  }
  parts.push(`<title>${article.title}</title>`);
  if (article.metaTitle) parts.push(`<meta_title>${article.metaTitle}</meta_title>`);
  if (article.metaDescription) {
    parts.push(`<meta_description>${article.metaDescription}</meta_description>`);
  }
  parts.push(`<body>${article.bodyText ?? article.bodyHtml}</body>`);
  if (article.faq && article.faq.length > 0) {
    const faqStr = article.faq
      .map((q, i) => `${i + 1}. Q: ${q.question}\n   A: ${q.answer}`)
      .join("\n");
    parts.push(`<faq>\n${faqStr}\n</faq>`);
  }
  parts.push(
    `\nEvalue cet article selon le rubric system. Retourne UNIQUEMENT le JSON, sans \`\`\` ni texte hors JSON.`,
  );
  return parts.join("\n\n");
}

// ── Parse + validation (testable purement) ───────────────────────────────────

const DIMENSION_KEYS = [
  "factualAccuracy",
  "depth",
  "originality",
  "readability",
  "seoCompleteness",
  "valueToReader",
  "toneAxioniaAlignment",
] as const;

/**
 * Poids des 7 dimensions LLM (total = 0.90) + linguisticDiversity 0.10.
 * Total = 1.00 exact.
 *
 * Phase G — Diversification Linguistique :
 *   Les 7 dimensions LLM passent de 1/7 chacune (~0.143) à ~0.129 chacune,
 *   la différence (0.10) va à linguisticDiversity.
 */
const LLM_DIM_WEIGHT = 0.9 / DIMENSION_KEYS.length; // ~0.1286 chacune
const LINGUISTIC_DIVERSITY_WEIGHT = 0.1;

/**
 * Calcule le dimensionScore (0-10) de la dimension linguisticDiversity
 * depuis les métriques de DiversityScore.
 *
 * Déductions appliquées :
 *   ttr < 0.50           → -3
 *   ttr [0.50, 0.65[     → -1
 *   stdSentenceLength < 3 → -2
 *   passiveVoiceRatio > 0.30 → -2
 *   passiveVoiceRatio [0.20, 0.30] → -1
 */
export function computeLinguisticDimensionScore(d: DiversityScore): number {
  let score = 10;
  if (d.ttr < 0.5) {
    score -= 3;
  } else if (d.ttr < 0.65) {
    score -= 1;
  }
  if (d.stdSentenceLength < 3) {
    score -= 2;
  }
  if (d.passiveVoiceRatio > 0.3) {
    score -= 2;
  } else if (d.passiveVoiceRatio > 0.2) {
    score -= 1;
  }
  return Math.max(0, Math.min(10, score));
}

function clampScore(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10, n));
}

function asDimension(value: unknown): DimensionScore {
  if (value && typeof value === "object" && "score" in value) {
    const obj = value as { score?: unknown; comment?: unknown };
    return {
      score: clampScore(obj.score),
      comment: typeof obj.comment === "string" ? obj.comment : "",
    };
  }
  return { score: 0, comment: "" };
}

function asIssues(value: unknown): JudgeIssue[] {
  if (!Array.isArray(value)) return [];
  const out: JudgeIssue[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const sev = r["severity"];
    const severity: IssueSeverity = sev === "P0" || sev === "P1" || sev === "P2" ? sev : "P2";
    out.push({
      severity,
      section: typeof r["section"] === "string" ? r["section"] : "unknown",
      issue: typeof r["issue"] === "string" ? r["issue"] : "",
      suggestedFix: typeof r["suggestedFix"] === "string" ? r["suggestedFix"] : "",
    });
  }
  return out;
}

function deriveVerdict(globalScore: number, issues: ReadonlyArray<JudgeIssue>): JudgeVerdict {
  const hasP0 = issues.some((i) => i.severity === "P0");
  const hasP1 = issues.some((i) => i.severity === "P1");
  if (globalScore < JUDGE_THRESHOLDS.IMPROVE_MIN || hasP0) return "reject";
  if (globalScore < JUDGE_THRESHOLDS.PUBLISH_MIN || hasP1) return "improve";
  return "publish";
}

/**
 * Parse + valide la reponse LLM brute (JSON string ou objet).
 *
 * Tolerant :
 *  - Strip markdown ```json fences si presents.
 *  - Clamp scores 0-10.
 *  - Verdict recompute deterministiquement depuis globalScore + issues
 *    (n'accepte pas le verdict LLM tel quel — anti-hallucination).
 *  - Si parse fail (JSON invalide) → throw avec contexte.
 */
export function parseJudgeResponse(raw: string): JudgeResult {
  // Strip ```json ... ``` fences si presents.
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/, "")
      .trim();
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `LLM-judge: invalid JSON response (${err instanceof Error ? err.message : "unknown"})`,
    );
  }

  // Build dimensions from object.
  const dimensionsRaw = (obj["dimensions"] as Record<string, unknown>) ?? {};
  const dimensions: JudgeResult["dimensions"] = {
    factualAccuracy: asDimension(dimensionsRaw["factualAccuracy"]),
    depth: asDimension(dimensionsRaw["depth"]),
    originality: asDimension(dimensionsRaw["originality"]),
    readability: asDimension(dimensionsRaw["readability"]),
    seoCompleteness: asDimension(dimensionsRaw["seoCompleteness"]),
    valueToReader: asDimension(dimensionsRaw["valueToReader"]),
    toneAxioniaAlignment: asDimension(dimensionsRaw["toneAxioniaAlignment"]),
  };

  // Compute globalScore : somme pondérée des 7 dimensions LLM × LLM_DIM_WEIGHT.
  // La dimension linguisticDiversity (weight 0.10) est ajoutée dans reviewArticle
  // lorsque bodyText est disponible. Ici on ne connaît pas encore ce score, donc
  // on normalise sur 0.90 et on ajustera si nécessaire dans reviewArticle.
  // Formule : sum(score_i × w_i) / 0.90 → score sur 10.
  // En pratique parseJudgeResponse retourne toujours un score sur les 7 dim LLM seules ;
  // reviewArticle recalcule globalScore final après injection linguisticDiversity.
  const llmWeightedSum = DIMENSION_KEYS.reduce(
    (s, k) => s + dimensions[k].score * LLM_DIM_WEIGHT,
    0,
  );
  // Normalise sur 0.90 pour obtenir un score 0-10 comparable à l'ancien calcul.
  const globalScore = Math.round((llmWeightedSum / 0.9) * 10) / 10;

  const issues = asIssues(obj["issues"]);
  const verdict = deriveVerdict(globalScore, issues);
  const reasoning = typeof obj["reasoning"] === "string" ? obj["reasoning"] : "";

  return { verdict, globalScore, dimensions, issues, reasoning };
}

/**
 * Review un article via Claude Sonnet (reviewer LLM).
 *
 * Cost approx : ~$0.03-0.06 par article (input ~3-5k tokens + output ~500-800).
 * Latency : ~5-15s (streaming).
 *
 * Phase G — Diversification Linguistique :
 *   Si article.bodyText est fourni, calcule localement la dimension linguisticDiversity
 *   (0 appel LLM supplémentaire) et l'intègre au globalScore final (poids 0.10).
 *   Issues P1/P2 injectées dans le résultat si TTR ou passiveVoiceRatio dégradés.
 *
 * Echec gracieux : si l'API throw (rate limit, auth, etc.) — la fonction relais
 * l'erreur au caller (worker logue + bascule status `error`).
 */
export async function reviewArticle(article: ArticleForReview): Promise<JudgeResult> {
  const userPrompt = buildUserPrompt(article);
  const response = await anthropicProvider.generate({
    jobId: article.jobId,
    contentType: article.contentType ?? "editorial_review",
    role: "text",
    model: JUDGE_MODEL,
    systemPrompt: JUDGE_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 2048,
    temperature: 0.2,
  });

  const baseResult = parseJudgeResponse(response.output);

  // ── Dimension linguisticDiversity (Phase G) ──────────────────────────────
  const textForAnalysis = article.bodyText ?? article.bodyHtml;
  if (!textForAnalysis || textForAnalysis.trim().length === 0) {
    // bodyText absent → dégradation gracieuse, pas de dimension linguistique.
    return baseResult;
  }

  const diversityScore = analyzeDiversity(textForAnalysis);
  const dimensionScore = computeLinguisticDimensionScore(diversityScore);

  // Issues supplémentaires injectées depuis les métriques locales.
  const extraIssues: JudgeIssue[] = [];
  if (diversityScore.ttr < 0.5) {
    extraIssues.push({
      severity: "P1",
      section: "body",
      issue: `TTR trop bas (${diversityScore.ttr.toFixed(2)}) — vocabulaire trop répétitif`,
      suggestedFix:
        "Varier le lexique : synonymes, reformulations, termes sectoriels complémentaires.",
    });
  }
  if (diversityScore.stdSentenceLength < 3) {
    extraIssues.push({
      severity: "P2",
      section: "body",
      issue: `Longueur des phrases trop uniforme (std=${diversityScore.stdSentenceLength.toFixed(1)})`,
      suggestedFix: "Alterner phrases courtes (<10 mots) et développements plus longs.",
    });
  }
  if (diversityScore.passiveVoiceRatio > 0.3) {
    extraIssues.push({
      severity: "P1",
      section: "body",
      issue: `Trop de voix passive (${(diversityScore.passiveVoiceRatio * 100).toFixed(0)}%)`,
      suggestedFix: "Reformuler les constructions passives en voix active pour plus d'impact.",
    });
  }

  const allIssues: ReadonlyArray<JudgeIssue> = [...baseResult.issues, ...extraIssues];

  // Recalcul du globalScore final avec les 8 dimensions pondérées.
  // Poids : 7 dim LLM × LLM_DIM_WEIGHT (0.90 total) + linguisticDiversity × 0.10.
  const llmWeightedSum = DIMENSION_KEYS.reduce(
    (s, k) => s + baseResult.dimensions[k].score * LLM_DIM_WEIGHT,
    0,
  );
  const finalGlobalScore =
    Math.round((llmWeightedSum + dimensionScore * LINGUISTIC_DIVERSITY_WEIGHT) * 10) / 10;

  const finalVerdict = deriveVerdict(finalGlobalScore, allIssues);

  const linguisticDiversity: LinguisticDiversityDimension = {
    score: diversityScore,
    dimensionScore,
  };

  return {
    verdict: finalVerdict,
    globalScore: finalGlobalScore,
    dimensions: baseResult.dimensions,
    linguisticDiversity,
    issues: allIssues,
    reasoning: baseResult.reasoning,
  };
}
