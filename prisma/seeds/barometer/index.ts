/**
 * Observatoire IA 2026 — SEED DE DÉVELOPPEMENT / DÉMO (idempotent).
 *
 * ⚠️ FIXTURE DEV UNIQUEMENT. Ne JAMAIS lancer au déploiement prod : les
 * réponses synthétiques ne doivent pas être publiées comme un effectif réel.
 * (En prod, l'effectif affiché = vraies réponses du formulaire public.)
 *
 * - Effectif : `SEED_TARGET_RESPONSES` (8 627) réponses synthétiques.
 * - PRNG mulberry32 à graine FIXE (déterministe — pas de Math.random nu).
 * - Idempotent : purge des seules lignes marquées `visitor_id LIKE 'seed:%'`
 *   (les vraies réponses sont préservées), puis ré-insertion.
 * - Distributions marginales + corrélations conformes au cahier des charges.
 * - À la fin : recalcule et persiste `BarometerSnapshot("latest")`.
 *
 * Usage : `pnpm barometer:seed`
 */

import { PrismaClient } from "../../generated/client";
import { STUDY_REGIONS, SEED_TARGET_RESPONSES } from "../../../src/content/observatoire/study";
import {
  USE_CASE_VALUES,
  TOOL_VALUES,
  SECTOR_SLUGS,
} from "../../../src/content/observatoire/questions";
import { recomputeAndPersistSnapshot } from "../../../src/server/observatoire/snapshot";

const prisma = new PrismaClient();

// ─── PRNG déterministe ───────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x0b5e4017); // graine fixe « OBSE 2017 »

type Weights = Record<string, number>;

function pick(w: Weights): string {
  const total = Object.values(w).reduce((s, x) => s + x, 0);
  let r = rng() * total;
  for (const [k, v] of Object.entries(w)) {
    r -= v;
    if (r <= 0) return k;
  }
  return Object.keys(w)[0] ?? "";
}

function chance(p: number): boolean {
  return rng() < p;
}

function pickDate(): Date {
  const start = Date.UTC(2026, 0, 6); // 6 janvier 2026
  const end = Date.UTC(2026, 1, 28, 23, 59); // 28 février 2026
  return new Date(start + rng() * (end - start));
}

// ─── Marginales de base (en points, normalisées par `pick`) ──────────────────
const SIZE_W: Weights = { TPE: 45, PME: 38, ETI: 13, GRANDE_ENTREPRISE: 4 };

// Région pondérée par PIB (SSOT regions.ts) — calculé, jamais hardcodé.
const REGION_W: Weights = Object.fromEntries(
  STUDY_REGIONS.map((r) => [r.slug, r.pibBillionsEur ?? 1]),
);

const MATURITY_BASE: Weights = {
  none: 18,
  exploration: 31,
  poc: 24,
  production: 19,
  scaled: 8,
};
// Décalage de maturité selon la taille (plus grand = plus mûr).
const MATURITY_SHIFT: Record<string, Weights> = {
  TPE: { none: 1.5, exploration: 1.2, poc: 0.9, production: 0.6, scaled: 0.4 },
  PME: { none: 1, exploration: 1, poc: 1, production: 1, scaled: 1 },
  ETI: { none: 0.5, exploration: 0.8, poc: 1.1, production: 1.4, scaled: 1.8 },
  GRANDE_ENTREPRISE: { none: 0.3, exploration: 0.6, poc: 1.1, production: 1.6, scaled: 2.4 },
};

const MATURITY_RANK: Record<string, number> = {
  none: 0,
  exploration: 1,
  poc: 2,
  production: 3,
  scaled: 4,
};

const SECURITY_SENSITIVE_SECTORS = new Set([
  "banque-finance",
  "assurance",
  "sante-biotech",
  "dispositifs-medicaux",
  "administration-publique",
  "juridique",
  "cybersecurite",
]);

function adjust(base: Weights, factor: Weights): Weights {
  const out: Weights = {};
  for (const k of Object.keys(base)) out[k] = (base[k] ?? 0) * (factor[k] ?? 1);
  return out;
}

interface Row {
  locale: "fr" | "en";
  visitorId: string;
  companySize: string;
  sector: string;
  region: string;
  respondentRole: string;
  maturityLevel: string;
  competitorsUseAi: string;
  hasStrategy: string;
  annualBudget: string;
  timeSavedPerDay: string;
  rgpdConcern: string;
  teamTrained: string;
  satisfaction: string | null;
  investmentIntent: string;
  useCases: string[];
  tools: string[];
  barriers: string[];
  rawAnswers: Record<string, unknown>;
  submittedAt: Date;
}

function buildRow(i: number): Row {
  const companySize = pick(SIZE_W);
  const sector = pick(Object.fromEntries(SECTOR_SLUGS.map((s) => [s, 1])));
  const region = pick(REGION_W);
  const isBig = companySize === "ETI" || companySize === "GRANDE_ENTREPRISE";
  const securitySector = SECURITY_SENSITIVE_SECTORS.has(sector);

  const maturityLevel = pick(adjust(MATURITY_BASE, MATURITY_SHIFT[companySize] ?? {}));
  const mRank = MATURITY_RANK[maturityLevel] ?? 0;

  // Rôle : dirigeant chez TPE, DSI/IT chez grands comptes.
  const respondentRole = pick(
    companySize === "TPE"
      ? { ceo_founder: 55, gm_coo: 10, business_director: 12, ops_manager: 13, cio_it: 5, other: 5 }
      : isBig
        ? {
            ceo_founder: 8,
            gm_coo: 18,
            cio_it: 34,
            business_director: 22,
            ops_manager: 14,
            other: 4,
          }
        : {
            ceo_founder: 30,
            gm_coo: 16,
            cio_it: 18,
            business_director: 18,
            ops_manager: 14,
            other: 4,
          },
  );

  // Concurrents IA : corrélé à la maturité.
  const competitorsUseAi = pick({
    yes_clearly: 20 + mRank * 8,
    probably: 38,
    dont_know: 22 - mRank * 3,
    no: 12 - mRank * 2,
  });

  // Stratégie : corrélé taille + maturité (calibré pour ≈ none 59 en moyenne).
  const hasStrategy = pick({
    formalized: 9 + mRank * 4 + (isBig ? 5 : 0),
    in_progress: 28 + mRank,
    none: 66 - mRank * 4 - (isBig ? 5 : 0),
  });

  // Budget : corrélé taille + maturité.
  const budgetShift = (isBig ? 1.6 : companySize === "PME" ? 1.0 : 0.6) + mRank * 0.18;
  const annualBudget = pick({
    zero: 22 / budgetShift,
    lt_1k: 19 / Math.sqrt(budgetShift),
    k1_5: 24,
    k5_20: 18 * budgetShift,
    k20_100: 12 * budgetShift,
    gt_100k: 3 * budgetShift * (isBig ? 1.8 : 1),
    dont_know: 2,
  });

  // Temps gagné : corrélé maturité.
  const timeSavedPerDay = pick({
    none: 21 - mRank * 4,
    lt_30min: 24,
    m30_1h: 26 + mRank * 2,
    h1_2: 17 + mRank * 3,
    h2_3: 8 + mRank * 2,
    gt_3h: 4 + mRank,
  });

  // RGPD : plus fort chez grands + secteurs sensibles (calibré ≈ very+somewhat 73).
  const rgpdShift = (isBig ? 1.2 : 1) * (securitySector ? 1.25 : 1);
  const rgpdConcern = pick({
    very: 30 * rgpdShift,
    somewhat: 43,
    little: 19 / rgpdShift,
    not_at_all: 8 / rgpdShift,
  });

  // Formation : corrélé taille.
  const teamTrained = pick({
    formal: 17 + (isBig ? 16 : 0) + mRank * 3,
    informal: 38,
    none: 45 - (isBig ? 14 : 0) - mRank * 4,
  });

  // Satisfaction : seulement si maturité ≥ POC, corrélé maturité.
  const satisfaction =
    mRank >= 2
      ? pick({
          very_satisfied: 10 + mRank * 4,
          satisfied: 40 + mRank * 2,
          mixed: 30 - mRank * 2,
          disappointed: 14 - mRank * 2,
        })
      : null;

  const investmentIntent = pick({
    strong_increase: 18 + mRank * 2,
    increase: 39,
    stable: 33 - mRank,
    decrease: 4,
    none_budget: 6 - mRank * 0.5,
  });

  // Usages multi (probabilité par usage, ↑ avec maturité). "none" si rien.
  const usageBoost = 0.5 + mRank * 0.18;
  const useCases: string[] = [];
  const usageP: Record<string, number> = {
    automation: 0.54,
    content: 0.49,
    data_analysis: 0.41,
    chatbot: 0.33,
    sales: 0.28,
    dev: 0.24,
    internal_rag: 0.22,
  };
  for (const u of USE_CASE_VALUES) {
    if (u === "none") continue;
    if (chance((usageP[u] ?? 0.2) * usageBoost)) useCases.push(u);
  }
  if (useCases.length === 0) useCases.push("none");

  // Outils multi (↑ avec maturité).
  const tools: string[] = [];
  const toolP: Record<string, number> = {
    chatgpt: 0.62,
    copilot: 0.34,
    claude: 0.22,
    gemini: 0.2,
    mistral: 0.14,
    internal: 0.12,
  };
  for (const t of TOOL_VALUES) {
    if (t === "none") continue;
    if (chance((toolP[t] ?? 0.1) * usageBoost)) tools.push(t);
  }
  if (tools.length === 0) tools.push("none");

  // Freins : max 3, pondérés ; compétences ↑ TPE, sécurité ↑ ETI/GE + secteurs sensibles.
  const barrierW: Weights = {
    skills: 58 * (companySize === "TPE" ? 1.3 : 1),
    roi: 44,
    security_rgpd: 39 * (isBig ? 1.4 : 1) * (securitySector ? 1.4 : 1),
    budget: 37 * (companySize === "TPE" ? 1.2 : 1),
    time: 33,
    data_quality: 31,
    internal_resistance: 26 * (isBig ? 1.3 : 1),
    not_priority: 12,
  };
  const barriers: string[] = [];
  const pool = { ...barrierW };
  const nbBarriers = 1 + Math.floor(rng() * 3); // 1..3
  for (let k = 0; k < nbBarriers && Object.keys(pool).length > 0; k++) {
    const chosen = pick(pool);
    barriers.push(chosen);
    delete pool[chosen];
  }

  const locale: "fr" | "en" = chance(0.12) ? "en" : "fr";

  const rawAnswers: Record<string, unknown> = {
    companySize,
    sector,
    region,
    respondentRole,
    maturityLevel,
    competitorsUseAi,
    hasStrategy,
    useCases,
    tools,
    annualBudget,
    barriers,
    timeSavedPerDay,
    rgpdConcern,
    teamTrained,
    satisfaction,
    investmentIntent,
    _seed: true,
  };

  return {
    locale,
    visitorId: `seed:${i}`,
    companySize,
    sector,
    region,
    respondentRole,
    maturityLevel,
    competitorsUseAi,
    hasStrategy,
    annualBudget,
    timeSavedPerDay,
    rgpdConcern,
    teamTrained,
    satisfaction,
    investmentIntent,
    useCases,
    tools,
    barriers,
    rawAnswers,
    submittedAt: pickDate(),
  };
}

async function main() {
  console.log(`[barometer:seed] starting — target ${SEED_TARGET_RESPONSES} synthetic responses`);

  // Idempotence : purge UNIQUEMENT les lignes seedées (préserve les vraies).
  const purged = await prisma.barometerResponse.deleteMany({
    where: { visitorId: { startsWith: "seed:" } },
  });
  console.log(`  ✓ purged ${purged.count} previous seeded rows`);

  const rows: Row[] = [];
  for (let i = 0; i < SEED_TARGET_RESPONSES; i++) rows.push(buildRow(i));

  // Insertion par lots.
  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const res = await prisma.barometerResponse.createMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: slice as any,
    });
    inserted += res.count;
  }
  console.log(`  ✓ inserted ${inserted} seeded responses`);

  const payload = await recomputeAndPersistSnapshot();
  console.log(
    `  ✓ snapshot "latest" persisted — total=${payload.totalResponses}, ` +
      `insights=${JSON.stringify(payload.insights)}`,
  );
  console.log("[barometer:seed] done");
}

main()
  .catch((e) => {
    console.error("[barometer:seed] FAILED", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
