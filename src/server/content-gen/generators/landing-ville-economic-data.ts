/**
 * Generator A — Economic Data LLM (Sprint Indexable 2000+ villes 2026-05-26).
 *
 * Produit un subset de `VilleEconomicData` via Claude Sonnet à partir de la
 * connaissance pré-entraînée Wikipedia/INSEE. Sert d'INPUT à `ville-hub-copy.ts`
 * pour les ~2000 villes qui n'ont pas de TS hand-crafted dans `economic-data/`.
 *
 * Source = "claude-knowledge:wikipedia-pretraining" — la data est sourçable
 * via Wikipedia/sites officiels mais non vérifiée 1-à-1. Si Will veut une
 * review humaine ultérieure, l'objet est versionné avec generatedAt.
 *
 * Anti-fabrication : le prompt rappelle 4 fois de NE PAS inventer ; si Claude
 * ne connaît pas une entité, il la passe (output array vide).
 */

import { z } from "zod";
import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { parseLlmJson } from "../shared/parse-llm-json";
import { escapeLlmInput } from "../shared/prompt-input-escape";
import type { VilleEconomicData } from "@/content/villes/economic-data/types";

// ---------------------------------------------------------------------------
// Output schema — subset de VilleEconomicData strictement nécessaire à
// `ville-hub-copy.ts::buildKbContext()`. Le LLM injecte source et verifiedOn
// fixes (pas de prose), validés Zod.
// ---------------------------------------------------------------------------

const SourceMeta = {
  source: "claude-knowledge:wikipedia-pretraining" as const,
  verifiedOn: new Date().toISOString().slice(0, 10),
};

const TopSectorSchema = z.object({
  naf: z.string().min(1).max(8),
  label: z.string().min(2).max(60),
  rank: z.number().int().min(1).max(20).optional(),
});

const PoleCompetitiviteSchema = z.object({
  nom: z.string().min(2).max(80),
  secteur: z.string().min(2).max(80),
  type: z.enum(["siege", "rayonnement"]).default("rayonnement"),
});

const GrandGroupeSchema = z.object({
  nom: z.string().min(2).max(80),
  secteur: z.string().min(2).max(80),
  typeImplantation: z
    .enum(["siege_social", "site_majeur", "centre_rd", "usine_principale", "heritage"])
    .default("site_majeur"),
});

const ZoneActiviteSchema = z.object({
  nom: z.string().min(2).max(100),
  type: z.enum(["zac", "parc_tech", "technopole", "district_eco", "autre"]).default("autre"),
  secteurDominant: z.string().min(2).max(80).optional(),
});

const EcoleSchema = z.object({
  nom: z.string().min(2).max(120),
  type: z.enum([
    "ecole_ingenieur",
    "ecole_commerce",
    "universite",
    "iut",
    "ens",
    "sciences_po",
    "autre",
  ]),
  specialites: z.array(z.string().min(2).max(60)).max(5).optional(),
});

const PoleRechercheSchema = z.object({
  nom: z.string().min(2).max(120),
  organisme: z.enum(["inria", "cea", "cnrs", "anr", "inserm", "inrae", "autre"]),
  domaine: z.string().min(2).max(60).optional(),
});

const IncubateurSchema = z.object({
  nom: z.string().min(2).max(80),
  focus: z.string().min(2).max(60).optional(),
});

const DistancesSchema = z.object({
  gareTgv: z
    .object({
      nom: z.string().min(2).max(80),
      distanceKm: z.number().min(0).max(500),
    })
    .optional(),
  aeroportPrincipal: z
    .object({
      nom: z.string().min(2).max(80),
      distanceKm: z.number().min(0).max(500),
    })
    .optional(),
  metroOuTram: z
    .object({
      lignes: z.number().int().min(0).max(50),
    })
    .optional(),
});

const StatsInseeSchema = z.object({
  etablissementsActifs: z.number().int().min(0).max(2_000_000).optional(),
  creationsEntreprises: z.number().int().min(0).max(500_000).optional(),
  anneeReference: z.number().int().min(2020).max(2026),
});

const FrenchTechSchema = z.object({
  statut: z.enum(["capitale", "communaute", "siege_national"]),
  nomChapitre: z.string().min(2).max(80).optional(),
});

const CommuneBassinSchema = z.object({
  slug: z.string().min(2).max(80),
  nameFr: z.string().min(2).max(80),
  distanceKm: z.number().min(0).max(80).optional(),
});

export const EconomicDataLlmSchema = z.object({
  topSectorsNaf: z.array(TopSectorSchema).min(3).max(8),
  polesCompetitivite: z.array(PoleCompetitiviteSchema).max(4).default([]),
  grandsGroupesImplantes: z.array(GrandGroupeSchema).min(2).max(10),
  zonesActivitesParcs: z.array(ZoneActiviteSchema).max(5).default([]),
  grandesEcolesEtUniversites: z.array(EcoleSchema).min(1).max(6),
  polesRechercheRD: z.array(PoleRechercheSchema).max(3).default([]),
  incubateursAccelerateurs: z.array(IncubateurSchema).max(3).default([]),
  distances: DistancesSchema,
  statsInsee: StatsInseeSchema,
  capitaleFrenchTech: FrenchTechSchema.optional(),
  communesBassin: z.array(CommuneBassinSchema).min(3).max(6),
  kbSectorTags: z.array(z.string().min(2).max(40)).min(2).max(6),
});

export type EconomicDataLlmOutput = z.infer<typeof EconomicDataLlmSchema>;

export interface GenerateEconomicDataInput {
  readonly villeSlug: string;
  readonly nameFr: string;
  readonly regionFr: string;
  readonly departmentFr: string;
  readonly population: number;
  readonly inseeCode: string;
  readonly jobId?: string;
}

export interface GenerateEconomicDataResult {
  readonly villeSlug: string;
  readonly data: VilleEconomicData;
  readonly qualityScore: number;
  readonly modelUsed: string;
  readonly totalCostUsd: number;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly promptHash: string;
  readonly iterations: number;
}

const QUALITY_THRESHOLD = 65;
const MAX_ITERATIONS = 2;
const BUDGET_CAP_USD = 0.05;

function computeQualityScore(o: EconomicDataLlmOutput): {
  readonly score: number;
  readonly issues: ReadonlyArray<string>;
  readonly retryFeedback: string;
} {
  const issues: string[] = [];
  let score = 100;

  if (o.topSectorsNaf.length < 4) {
    issues.push(`topSectorsNaf insuffisant (${o.topSectorsNaf.length} < 4)`);
    score -= 8;
  }
  if (o.grandsGroupesImplantes.length < 3) {
    issues.push(`grandsGroupesImplantes insuffisant (${o.grandsGroupesImplantes.length} < 3)`);
    score -= 12;
  }
  if (o.grandesEcolesEtUniversites.length < 2) {
    issues.push(
      `grandesEcolesEtUniversites insuffisant (${o.grandesEcolesEtUniversites.length} < 2)`,
    );
    score -= 8;
  }
  if (o.communesBassin.length < 4) {
    issues.push(`communesBassin insuffisant (${o.communesBassin.length} < 4)`);
    score -= 5;
  }
  if (!o.distances.gareTgv && !o.distances.aeroportPrincipal) {
    issues.push("aucune distance gare TGV ou aéroport renseignée");
    score -= 10;
  }
  if (o.statsInsee.etablissementsActifs === undefined) {
    issues.push("statsInsee.etablissementsActifs manquant");
    score -= 5;
  }

  const fb =
    issues.length > 0
      ? `Champs INSUFFISANTS — atteins les minimums : ${issues.join(" / ")}. NE PAS inventer — si tu ne connais pas l'info, écris null/omis. Si tu connais bien la ville, complète davantage.`
      : "";

  return { score: Math.max(0, score), issues, retryFeedback: fb };
}

function buildUserPrompt(
  input: GenerateEconomicDataInput,
  kbContext: string,
  retryFeedback: string,
): string {
  const safeVille = escapeLlmInput(input.nameFr, { maxLen: 80 });
  const safeRegion = escapeLlmInput(input.regionFr, { maxLen: 80 });
  const safeDept = escapeLlmInput(input.departmentFr, { maxLen: 80 });
  const fb = retryFeedback ? `\n\n## ⚠️ FEEDBACK — corrige IMPÉRATIVEMENT\n${retryFeedback}\n` : "";

  return `Produis le JSON economic-data de la ville française **${safeVille}** (${safeDept}, région ${safeRegion}, population ${input.population.toLocaleString("fr")} habitants, code INSEE ${input.inseeCode}).

## 🚨 CONTRAT ANTI-INVENTION
- NE FABRIQUE JAMAIS un nom d'entreprise/école/pôle/incubateur si tu n'en es pas certain (Wikipedia/site officiel)
- Si tu ne connais pas 5 grands groupes implantés à ${safeVille}, écris-en 2-3 que tu connais SÛREMENT et arrête là (mieux vaut court et juste que long et faux)
- Mêmes règles pour pôles compétitivité / écoles / zones activité / incubateurs
- Pour distances : utilise les vraies distances vers gare TGV et aéroport principal (si tu ne connais pas, omettre le champ)
- Pour statsInsee.etablissementsActifs : donne un ORDRE DE GRANDEUR plausible (×1000 vs population — ratio FR moyen) avec anneeReference: 2024

## CONTRAT DE FORMAT
- topSectorsNaf : 4-6 secteurs B2B dominants à ${safeVille}, libellés courts (max 50 chars). naf = code NAF approximatif (ex "47", "62", "64", "72") ou "00" si inconnu. rank = 1 le plus dominant.
- polesCompetitivite : 0-3 pôles labellisés France Phase V (2023-2026) actifs dans la région ${safeRegion}. Si aucun, [].
- grandsGroupesImplantes : 3-8 entreprises avec siège social, site majeur, centre R&D ou usine à ${safeVille}. Noms RÉELS.
- zonesActivitesParcs : 0-5 ZAC / technopôles / parcs activité de ${safeVille}. Noms officiels.
- grandesEcolesEtUniversites : 2-6 écoles ou universités présentes à ${safeVille}. type au choix.
- polesRechercheRD : 0-3 antennes Inria/CEA/CNRS/INSERM/INRAE/ANR à ${safeVille}. Si aucune, [].
- incubateursAccelerateurs : 0-3 incubateurs ou pépinières d'entreprises à ${safeVille}.
- distances : gareTgv (nom + km depuis ${safeVille}), aeroportPrincipal (nom + km), metroOuTram (nombre de lignes — 0 si pas de réseau).
- statsInsee : etablissementsActifs ordre de grandeur, creationsEntreprises ordre de grandeur (optionnel), anneeReference: 2024.
- capitaleFrenchTech : si ${safeVille} a un chapitre French Tech officiel (https://lafrenchtech.com), statut + nomChapitre. Sinon, omet.
- communesBassin : 4-6 communes du bassin économique de ${safeVille} (distance ≤ 30km), avec slug kebab-case, nameFr, distanceKm approx.
- kbSectorTags : 2-5 tags secteurs dominants (ex ["industrie-aerospatiale","tourisme","tech-numerique","commerce"]).

${kbContext}${fb}

## Output attendu — JSON strict, AUCUNE balise markdown autour
{
  "topSectorsNaf": [{"naf": "...", "label": "...", "rank": 1}, ...],
  "polesCompetitivite": [{"nom": "...", "secteur": "...", "type": "rayonnement"}, ...],
  "grandsGroupesImplantes": [{"nom": "...", "secteur": "...", "typeImplantation": "site_majeur"}, ...],
  "zonesActivitesParcs": [{"nom": "...", "type": "technopole", "secteurDominant": "..."}, ...],
  "grandesEcolesEtUniversites": [{"nom": "...", "type": "universite", "specialites": ["...", "..."]}, ...],
  "polesRechercheRD": [{"nom": "...", "organisme": "cnrs", "domaine": "..."}, ...],
  "incubateursAccelerateurs": [{"nom": "...", "focus": "..."}, ...],
  "distances": {"gareTgv": {"nom": "...", "distanceKm": 0}, "aeroportPrincipal": {"nom": "...", "distanceKm": 0}, "metroOuTram": {"lignes": 0}},
  "statsInsee": {"etablissementsActifs": 0, "creationsEntreprises": 0, "anneeReference": 2024},
  "capitaleFrenchTech": {"statut": "communaute", "nomChapitre": "..."},
  "communesBassin": [{"slug": "...", "nameFr": "...", "distanceKm": 0}, ...],
  "kbSectorTags": ["...", "..."]
}`;
}

const SYSTEM_PROMPT = `Tu es analyste économique territorial expert France. Tu produis UNIQUEMENT du JSON structuré décrivant l'économie locale d'une ville française.

🚨 RÈGLE #1 — AUCUNE INVENTION
- Si tu ne connais pas une entité avec certitude (Wikipedia/site officiel), N'ÉCRIS PAS son nom
- Mieux vaut un array court mais juste qu'un array long inventé
- Tu peux retourner [] pour les champs optionnels si tu ne connais aucune entité réelle

🚨 RÈGLE #2 — Pas de marketing
- Aucun adjectif élogieux ("dynamique", "innovant", "leader")
- Faits seulement : noms, distances, codes NAF, chiffres INSEE plausibles

Tu connais bien : grandes entreprises FR (CAC40, sièges sociaux notoires), écoles d'ingénieurs/commerce (top 30), grands organismes recherche (Inria, CEA, CNRS), pôles compétitivité Phase V, French Tech chapitres officiels, distances entre métropoles et infrastructures notoires.`;

/**
 * Construit un objet `VilleEconomicData` complet à partir du JSON LLM, en
 * ajoutant les métadonnées de source uniformes (claude-knowledge + date).
 */
function mapLlmOutputToEconomicData(o: EconomicDataLlmOutput): VilleEconomicData {
  const stamp = SourceMeta;
  const data: VilleEconomicData = {
    topSectorsNaf: o.topSectorsNaf.map((s) => ({
      naf: s.naf,
      label: s.label,
      ...(s.rank !== undefined ? { rank: s.rank } : {}),
      ...stamp,
    })),
    polesCompetitivite: o.polesCompetitivite.map((p) => ({
      nom: p.nom,
      secteur: p.secteur,
      type: p.type,
      ...stamp,
    })),
    grandsGroupesImplantes: o.grandsGroupesImplantes.map((g) => ({
      nom: g.nom,
      secteur: g.secteur,
      typeImplantation: g.typeImplantation,
      ...stamp,
    })),
    zonesActivitesParcs: o.zonesActivitesParcs.map((z) => ({
      nom: z.nom,
      type: z.type,
      ...(z.secteurDominant ? { secteurDominant: z.secteurDominant } : {}),
      ...stamp,
    })),
    grandesEcolesEtUniversites: o.grandesEcolesEtUniversites.map((e) => ({
      nom: e.nom,
      type: e.type,
      ...(e.specialites ? { specialites: e.specialites } : {}),
      ...stamp,
    })),
    polesRechercheRD: o.polesRechercheRD.map((p) => ({
      nom: p.nom,
      organisme: p.organisme,
      ...(p.domaine ? { domaine: p.domaine } : {}),
      ...stamp,
    })),
    incubateursAccelerateurs: o.incubateursAccelerateurs.map((i) => ({
      nom: i.nom,
      ...(i.focus ? { focus: i.focus } : {}),
      ...stamp,
    })),
    distances: {
      ...(o.distances.gareTgv ? { gareTgv: { ...o.distances.gareTgv, source: stamp.source } } : {}),
      ...(o.distances.aeroportPrincipal
        ? {
            aeroportPrincipal: {
              ...o.distances.aeroportPrincipal,
              source: stamp.source,
            },
          }
        : {}),
      ...(o.distances.metroOuTram
        ? { metroOuTram: { ...o.distances.metroOuTram, source: stamp.source } }
        : {}),
      verifiedOn: stamp.verifiedOn,
    },
    statsInsee: {
      ...(o.statsInsee.etablissementsActifs !== undefined
        ? { etablissementsActifs: o.statsInsee.etablissementsActifs }
        : {}),
      ...(o.statsInsee.creationsEntreprises !== undefined
        ? { creationsEntreprises: o.statsInsee.creationsEntreprises }
        : {}),
      anneeReference: o.statsInsee.anneeReference,
      ...stamp,
    },
    kbSectorTags: o.kbSectorTags,
    communesBassin: o.communesBassin.map((c) => ({
      slug: c.slug,
      nameFr: c.nameFr,
      ...(c.distanceKm !== undefined ? { distanceKm: c.distanceKm } : {}),
      ...stamp,
    })),
    ...(o.capitaleFrenchTech
      ? {
          capitaleFrenchTech: {
            statut: o.capitaleFrenchTech.statut,
            ...(o.capitaleFrenchTech.nomChapitre
              ? { nomChapitre: o.capitaleFrenchTech.nomChapitre }
              : {}),
            ...stamp,
          },
        }
      : {}),
    lastReviewedOn: stamp.verifiedOn,
    reviewedBy: "llm-generator:landing-ville-economic-data@1.0",
  };
  return data;
}

/**
 * Génère un VilleEconomicData via Claude Sonnet pour les villes sans data TS.
 * Retourne `null` si toutes les passes échouent ou si budget dépassé.
 */
export async function generateVilleEconomicData(
  input: GenerateEconomicDataInput,
): Promise<GenerateEconomicDataResult | null> {
  // KB RAG retrieve — facts villes-economy (tagged "villes")
  let kbContext = "";
  try {
    const chunks = await kbRetrieve({
      query: `${input.nameFr} économie écosystème entreprises secteurs ${input.regionFr}`,
      locale: "fr",
      k: 6,
      filters: { audiences: ["public"], types: ["industry_use_case", "methodology", "doctrine"] },
      mode: "hybrid",
    });
    if (chunks.length > 0) {
      kbContext = `\n\n## Knowledge Base — facts vérifiés (priorité absolue sur ta connaissance générale)\n${chunks
        .map((c, i) => `[${i + 1}] ${c.title}\n${c.excerpt ?? ""}`)
        .join("\n\n")}`;
    }
  } catch {
    kbContext = "";
  }

  let bestOutput: EconomicDataLlmOutput | null = null;
  let bestScore = -1;
  let bestModel = "";
  let bestPromptHash = "";
  let bestTokensInput = 0;
  let bestTokensOutput = 0;
  let totalCostUsd = 0;
  let retryFeedback = "";
  let iteration = 0;

  while (iteration <= MAX_ITERATIONS) {
    if (totalCostUsd >= BUDGET_CAP_USD) break;

    const userPrompt = buildUserPrompt(input, kbContext, retryFeedback);
    const promptHash = hashPrompt(SYSTEM_PROMPT + userPrompt);
    const temperature = iteration === 0 ? 0.3 : 0.15;

    const llm = await routerGenerate({
      jobId: input.jobId ?? `economic-data-${input.villeSlug}-${Date.now()}-iter${iteration}`,
      contentType: "landing_ville",
      role: "text",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2200,
      temperature,
      preferredProvider: "anthropic",
    });

    totalCostUsd += llm.costUsd;
    iteration++;

    let parsedRaw: unknown;
    try {
      parsedRaw = parseLlmJson(llm.output);
    } catch (err) {
      retryFeedback = `JSON invalide — retourne UNIQUEMENT du JSON pur. Erreur : ${err instanceof Error ? err.message : "parse"}`;
      continue;
    }
    const parseRes = EconomicDataLlmSchema.safeParse(parsedRaw);
    if (!parseRes.success) {
      const flat = parseRes.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 6)
        .join(" / ");
      retryFeedback = `Schema Zod invalide — corrige : ${flat}`;
      continue;
    }
    const out = parseRes.data;
    const { score, retryFeedback: nextFb } = computeQualityScore(out);
    console.log(
      `[economic-data] ${input.villeSlug} iter${iteration} — score ${score}/100 (cost $${llm.costUsd.toFixed(4)}, cumulé $${totalCostUsd.toFixed(4)})`,
    );

    if (score > bestScore) {
      bestScore = score;
      bestOutput = out;
      bestModel = llm.model;
      bestPromptHash = promptHash;
      bestTokensInput = llm.tokensInput;
      bestTokensOutput = llm.tokensOutput;
    }
    if (score >= QUALITY_THRESHOLD) break;
    retryFeedback = nextFb;
  }

  if (!bestOutput) return null;

  return {
    villeSlug: input.villeSlug,
    data: mapLlmOutputToEconomicData(bestOutput),
    qualityScore: bestScore,
    modelUsed: bestModel,
    totalCostUsd,
    tokensInput: bestTokensInput,
    tokensOutput: bestTokensOutput,
    promptHash: bestPromptHash,
    iterations: iteration,
  };
}
