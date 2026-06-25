/**
 * Content Generator V1 — Seed ContentGenConfig defaults (audit 2026-05-15 P0-20).
 *
 * Initialise les clés ContentGenConfig essentielles avec les défauts métier
 * du master prompt v2.4 §§ 12.5, 24, 25, 26, 27, 28, 29.
 *
 * Pourquoi : sans seed, ContentGenConfig est vide au premier déploiement et
 * les helpers `readContentGenConfig<T>(key, defaults)` retournent les défauts
 * inline (acceptable runtime, mais admin /settings affiche les valeurs depuis
 * la DB → écrans vides au premier load). Ce seed force l'écriture initiale.
 *
 * Idempotent : upsert key par key, l'admin peut overrider via Settings UI
 * sans risque d'écrasement (l'orchestrator n'est appelé qu'au seed initial,
 * pas à chaque deploy).
 */

import type { PrismaClient } from "../../generated/client";

interface ConfigSeed {
  readonly key: string;
  readonly value: unknown;
  readonly description: string;
}

const SEEDS: ReadonlyArray<ConfigSeed> = [
  // §12.5 — Batches & workers
  {
    key: "batches",
    value: {
      workersConcurrency: 3,
      retryMaxAttempts: 3,
      retryBackoffMs: 30_000,
      dailyTargetByType: {},
      antiBurstEnabled: true,
    },
    description:
      "Réglages batches & workers (master prompt §12.5 — v7 phase 4 : per-campaign dailyArticles)",
  },
  // §12.5 — Policies (skip-existing, RSS auto-publish, plagiat, retention)
  {
    key: "policies",
    value: {
      skipVilleIfCopyExists: true,
      rssAutoPublishMinScore: 75,
      plagiarismJaccardInternal: 0.3,
      plagiarismJaccardRss: 0.1,
      tier3RetentionDays: 90,
    },
    description: "Policies content-gen (skip ville, plagiat, retention)",
  },
  // §27 — Boucle qualité
  {
    key: "quality_loop",
    value: {
      // Seuil auto-publication : 70 (filet de sécurité, 2026-06-25). L'archi
      // 2/3-appels produit des articles 78+ de façon fiable ; 70 laisse passer
      // les rares 70-74 au lieu de les router en revue, sans descendre dans la
      // zone « thin content » risquée pour le HCU Google (cf. décision Will).
      enabled: true,
      minScoreThreshold: 70,
      targetScore: 85,
      maxAttemptsAuto: 2,
      monthlyBudgetCapUsd: 100,
    },
    description: "Boucle qualité (re-prompt LLM ciblé sections sous-score)",
  },
  // §29 — Q/R post-process auto
  {
    key: "qa_policies",
    value: {
      autoCreatePages: true,
      minWordCount: 120,
      ctrPromotionThreshold: 0.05,
    },
    description: "Q/R post-process auto (création pages /faq/[slug])",
  },
  // §26 — Distribution intention de recherche
  {
    key: "search_intent_distribution",
    value: {
      informational: 0.4,
      commercial_investigation: 0.25,
      transactional: 0.15,
      navigational: 0.1,
      local: 0.1,
    },
    description: "Distribution % par intention de recherche (§26)",
  },
  // §24 — Kill switch global (off par défaut)
  {
    key: "kill_switch",
    value: {
      active: false,
      reason: null,
      activatedAt: null,
    },
    description: "Kill switch global content-gen (pause workers)",
  },
  // §9 — Variants landing actives
  {
    key: "landing_variants_active",
    value: ["default"],
    description: "Variants landing-ville actives (default V1, V2 ajoute focus_*)",
  },
  // §9bis — llms.txt content (placeholder, édition admin)
  {
    key: "llms_txt",
    value: `# Axion-IA — Cabinet IA opérationnel français

> Cabinet IA opérationnel français pour PME, ETI et grands comptes.
> Auteur principal : Manon (IA disclosed, doctrine éditoriale v2.1).
> Périmètre : audit IA, intervention, implémentation, conseil stratégique.

## Pages canoniques
- /fr — accueil
- /fr/interventions — taxonomie 4 familles
- /fr/audit — audit IA opérationnel
- /fr/implementation — implémentation IA
- /fr/methodologie — méthodologie 5 étapes
`,
    description: "llms.txt machine-readable (édition admin)",
  },
  // §25 — Geo order custom (vide V1 = ordre INSEE alpha)
  {
    key: "geo_order",
    value: [],
    description: "Ordre custom villes (geo cockpit drag&drop)",
  },
  // §28 — RSS sources (vide V1 — admin add via UI)
  {
    key: "rss_sources",
    value: [],
    description: "Sources RSS configurées (admin /content-gen/rss)",
  },
  // §28 — RSS items LRU dedup (vide initial)
  {
    key: "rss_items_seen",
    value: [],
    description: "RSS items vus (LRU cap 5000) — dedup hash(url+title)",
  },
];

export async function seedContentGenConfig(prisma: PrismaClient): Promise<number> {
  let count = 0;
  for (const seed of SEEDS) {
    await prisma.contentGenConfig.upsert({
      where: { key: seed.key },
      // Update minimal : ne réécrit PAS la value (l'admin a pu la modifier).
      // On ne sync que la description pour rester explicit.
      update: {
        description: seed.description,
      },
      create: {
        key: seed.key,
        value: seed.value as never,
        description: seed.description,
      },
    });
    count += 1;
  }
  return count;
}
