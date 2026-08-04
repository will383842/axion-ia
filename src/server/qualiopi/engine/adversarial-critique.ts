/**
 * Qualiopi — Formation Engine T5 : Critique adversariale.
 *
 * 2e appel IA (après évaluation grille T4). Rôle : adversaire constructif.
 * Analyse 5 angles pédagogiques, note 0-10 + critique + risques par angle.
 * Parsing défensif : strip ```, clamp 0-10, dégradé si parse fail.
 *
 * Module PUR sauf l'appel IA (anthropicProvider.generate).
 */

import { anthropicProvider } from "@/server/content-gen/providers/anthropic";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AngleAdversarial =
  "engagement" | "transferabilite" | "memorisation" | "adequation_public" | "realisme_exercices";

export interface AngleResult {
  score: number;
  critique: string;
  risques: string[];
}

export interface AdversarialCritiqueResult {
  scoreGlobal: number;
  angles: Record<AngleAdversarial, AngleResult>;
  pointsForts: string[];
  axesAmelioration: string[];
  verdict: "OK" | "ATTENTION" | "CRITIQUE";
  meta: {
    model: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  };
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const ANGLES_FR: Record<AngleAdversarial, string> = {
  engagement:
    "Engagement des apprenants — la formation maintient-elle l'attention et la motivation tout au long du parcours ?",
  transferabilite:
    "Transférabilité — les compétences acquises sont-elles réellement mobilisables en situation de travail ?",
  memorisation:
    "Mémorisation — la structure favorise-t-elle la rétention à long terme (espacements, révisions, récapitulatifs) ?",
  adequation_public:
    "Adéquation public — le niveau, le vocabulaire et les exemples correspondent-ils au profil des apprenants visés ?",
  realisme_exercices:
    "Réalisme des exercices — les mises en situation sont-elles réalistes, réalisables et formatives ?",
};

function buildSystemPrompt(): string {
  return `Tu es un critique pédagogique expert, adversarial et constructif. Ton rôle est d'identifier les faiblesses d'un programme de formation pour aider à l'améliorer AVANT sa diffusion.

Consigne absolue : réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaire hors JSON.

Format attendu :
{
  "engagement":        { "score": <0-10>, "critique": "<texte FR>", "risques": ["<risque1>", "..."] },
  "transferabilite":   { "score": <0-10>, "critique": "<texte FR>", "risques": ["<risque1>", "..."] },
  "memorisation":      { "score": <0-10>, "critique": "<texte FR>", "risques": ["<risque1>", "..."] },
  "adequation_public": { "score": <0-10>, "critique": "<texte FR>", "risques": ["<risque1>", "..."] },
  "realisme_exercices":{ "score": <0-10>, "critique": "<texte FR>", "risques": ["<risque1>", "..."] },
  "points_forts":       ["<point1>", "..."],
  "axes_amelioration":  ["<axe1>", "..."]
}

Règles de notation :
- 0-4 : déficience majeure, blocage à la validation
- 5-7 : insuffisances notables, corrections attendues
- 8-10 : niveau satisfaisant à excellent

Angles à évaluer :
${(Object.entries(ANGLES_FR) as [AngleAdversarial, string][]).map(([k, v]) => `- ${k} : ${v}`).join("\n")}`;
}

function buildUserPrompt(input: {
  formationId: string;
  structure: string;
  persona: unknown;
  backwardDesign: unknown;
}): string {
  return `## Identifiant formation
${input.formationId}

## Structure pédagogique
${input.structure}

## Persona apprenant
${JSON.stringify(input.persona, null, 2)}

## Backward Design (objectifs → contenu → évaluation)
${JSON.stringify(input.backwardDesign, null, 2)}

Analyse ce programme selon les 5 angles définis dans tes instructions. Sois sévère et précis.`;
}

// ── Parsing défensif ──────────────────────────────────────────────────────────

function stripMarkdown(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function clamp010(val: unknown): number {
  if (typeof val === "number") return Math.max(0, Math.min(10, Math.round(val)));
  if (typeof val === "string") {
    const n = parseFloat(val);
    if (!isNaN(n)) return Math.max(0, Math.min(10, Math.round(n)));
  }
  return 0;
}

function extractStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string");
}

function extractAngleResult(val: unknown): AngleResult {
  if (typeof val !== "object" || val === null) {
    return { score: 0, critique: "Non évalué.", risques: [] };
  }
  const obj = val as Record<string, unknown>;
  return {
    score: clamp010(obj["score"]),
    critique: typeof obj["critique"] === "string" ? obj["critique"] : "Non évalué.",
    risques: extractStringArray(obj["risques"]),
  };
}

const ANGLE_KEYS: AngleAdversarial[] = [
  "engagement",
  "transferabilite",
  "memorisation",
  "adequation_public",
  "realisme_exercices",
];

function buildDegradedResult(meta: AdversarialCritiqueResult["meta"]): AdversarialCritiqueResult {
  const emptyAngle: AngleResult = { score: 0, critique: "Erreur de parsing.", risques: [] };
  return {
    scoreGlobal: 0,
    angles: {
      engagement: emptyAngle,
      transferabilite: emptyAngle,
      memorisation: emptyAngle,
      adequation_public: emptyAngle,
      realisme_exercices: emptyAngle,
    },
    pointsForts: [],
    axesAmelioration: ["Relancer la critique adversariale (erreur technique)."],
    verdict: "CRITIQUE",
    meta,
  };
}

// ── Critique adversariale principale ─────────────────────────────────────────

/**
 * Lance une critique adversariale sur la structure d'une formation.
 *
 * - Appelle `anthropicProvider.generate()` avec contentType `qualiopi_adversarial_critique`.
 * - temperature 0.4 (légère créativité pour la critique).
 * - En cas d'erreur ou de parse fail → résultat dégradé (verdict CRITIQUE, score 0).
 */
export async function runAdversarialCritique(input: {
  formationId: string;
  structure: string;
  persona: unknown;
  backwardDesign: unknown;
}): Promise<AdversarialCritiqueResult> {
  const jobId = `AXI-ADVERSARIAL-${input.formationId}`;
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  let rawOutput: string;
  let model: string;
  let tokensInput: number;
  let tokensOutput: number;
  let costUsd: number;

  try {
    const response = await anthropicProvider.generate({
      jobId,
      contentType: "qualiopi_adversarial_critique",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
      temperature: 0.4,
    });

    rawOutput = response.output;
    model = response.model;
    tokensInput = response.tokensInput;
    tokensOutput = response.tokensOutput;
    costUsd = response.costUsd;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[qualiopi:adversarial] appel IA échoué :", msg);
    return buildDegradedResult({
      model: "unknown",
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
    });
  }

  const meta = { model, tokensInput, tokensOutput, costUsd };

  // Parsing défensif
  let parsed: Record<string, unknown> | null = null;
  try {
    const cleaned = stripMarkdown(rawOutput);
    const json = JSON.parse(cleaned);
    if (typeof json === "object" && json !== null && !Array.isArray(json)) {
      parsed = json as Record<string, unknown>;
    }
  } catch {
    parsed = null;
  }

  if (!parsed) {
    console.warn("[qualiopi:adversarial] parse fail. Brut :", rawOutput.slice(0, 200));
    return buildDegradedResult(meta);
  }

  // Extraction des angles
  const angles = {} as Record<AngleAdversarial, AngleResult>;
  for (const key of ANGLE_KEYS) {
    angles[key] = extractAngleResult(parsed[key]);
  }

  // Score global = moyenne arrondie des 5 angles
  const somme = ANGLE_KEYS.reduce((acc, k) => acc + angles[k].score, 0);
  const scoreGlobal = Math.round(somme / ANGLE_KEYS.length);

  // Points forts + axes amélioration
  const pointsForts = extractStringArray(parsed["points_forts"]);
  const axesAmelioration = extractStringArray(parsed["axes_amelioration"]);

  // Verdict
  let verdict: "OK" | "ATTENTION" | "CRITIQUE";
  if (scoreGlobal >= 8) {
    verdict = "OK";
  } else if (scoreGlobal >= 6) {
    verdict = "ATTENTION";
  } else {
    verdict = "CRITIQUE";
  }

  return {
    scoreGlobal,
    angles,
    pointsForts,
    axesAmelioration,
    verdict,
    meta,
  };
}
