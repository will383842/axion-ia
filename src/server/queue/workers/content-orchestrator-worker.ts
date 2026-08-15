/**
 * Content Generator — Orchestrator worker (§ 25.3 master prompt v1.7).
 *
 * Pick CoverageCampaign WHERE status='running' AND generatedCount < totalTargetCount.
 * Pour chaque campagne :
 *  1. Sample distribution selon typeDistribution + audienceMix + searchIntentMix
 *  2. Crée N ContentGenJob rows (batch tick = min(perCampaignTick, restant))
 *  3. Enqueue jobs vers queue 'content-gen' (worker primaire pick)
 *  4. Met à jour CoverageCampaign.generatedCount
 *
 * Cron toutes les 15 minutes (96 ticks/jour). Budget par campagne (V2) :
 *  - si dailyTargetByType configuré → anti-burst par type
 *  - sinon → ceil(campaign.dailyArticles / 96) par tick
 *
 * Idempotency : ContentGenJob.idempotencyKey = hash(campaign.id + tickIndex)
 * pour éviter doublons si le worker tick re-trigger plus tôt que prévu.
 */

import { Queue, Worker, type Job } from "bullmq";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { resolveIntentDistribution } from "@/server/content-gen/intent-distribution-schema";
import {
  computeAntiBurstSchedule,
  computeCampaignTickBudget,
  msSinceStartOfDay,
} from "@/server/content-gen/scheduler/anti-burst";
// Fix 2026-08-15 — reprise du retard (drain des échecs transitoires + déblocage
// des jobs figés) et lecture fail-safe du kill switch.
import {
  DEFAULT_RECOVERY_SETTINGS,
  drainFailedJobs,
  sweepStrandedQualityJobs,
  sweepStuckJobs,
  type BacklogRecoverySettings,
} from "@/server/content-gen/recovery/backlog-recovery";
import { readKillSwitchFailSafe } from "@/server/content-gen/config-store";
import { CONTENT_GEN_JOB_OPTIONS } from "@/server/content-gen/queue/job-options";
import { buildWeightedSequence } from "@/server/content-gen/scheduler/type-sequence";
// Fix 2026-07-18 — resync des compteurs de campagne (failedCount/publishedCount).
import { syncCampaignCounters } from "@/server/content-gen/campaigns/sync-counters";
import { isContentTypeRegistered } from "@/server/content-gen/generators/registered-types";
import { alertCampaignDone } from "@/server/content-gen/shared/content-gen-alerts";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type {
  CityProcessingMode,
  CompanySize,
  ContentType,
  OrganisationType,
  SearchIntent,
  ServiceSector,
} from "../../../../prisma/generated/client";

const QUEUE_NAME = "content-orchestrator";

// 2026-06-14 — L'orchestrateur ne force PLUS de mot-clé template pour
// `blog_from_keywords`. Auparavant il injectait `inputPayload.primaryKeyword`
// via un mini-template à 5 valeurs (« audit IA » + ville), ce qui
// court-circuitait la rotation atomique du vrai pool (~2000 mots-clés longue
// traîne) déjà câblée dans le content-gen-worker (selectKeyword, filtré par
// vertical de la campagne). Désormais on laisse `primaryKeyword` vide : le
// worker pioche dans le pool riche, et la ville reste portée séparément par
// `anchorVilleSlug` (la localisation du contenu n'en dépend pas). Résultat :
// diversité longue traîne réellement exploitée, zéro régression géo.

interface BatchSettings {
  readonly workersConcurrency: number;
  readonly dailyTargetByType?: Partial<Record<ContentType, number>>;
  readonly antiBurstEnabled?: boolean;
}

// L'interface locale `KillSwitchState` a été retirée le 2026-08-15 : l'état du
// kill switch est désormais lu par `readKillSwitchFailSafe`, qui porte son
// propre type (et traite une erreur DB comme un arrêt, au lieu de retomber sur
// un défaut permissif).

let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set");
  contentGenQueue = new Queue("content-gen", {
    connection: { url: redisUrl },
    // Fix 2026-08-15 — sans `defaultJobOptions`, une queue créée à la volée
    // hérite du défaut BullMQ (`attempts: 1`) au lieu de la politique de
    // `queues.ts`. Un job qui rencontrait une pause kill switch mourait donc
    // définitivement dès la première tentative.
    defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
  });
  return contentGenQueue;
}

let qualityImproverQueue: Queue | null = null;
function getQualityImproverQueue(): Queue | null {
  if (qualityImproverQueue) return qualityImproverQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  qualityImproverQueue = new Queue("content-quality-improver", {
    connection: { url: redisUrl },
    defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
  });
  return qualityImproverQueue;
}

/**
 * Sélection déterministe par slot index. Garantit une distribution exacte
 * sur N slots sans dérive aléatoire (remplace Math.random()).
 * seed = offset pour décorreler type / intent / audience sur le même slotIndex.
 * Ex : dist={A:40,B:30,C:30}, slotIndex=0→A, slotIndex=40→B, slotIndex=70→C.
 */
function sampleWeighted<K extends string>(
  dist: Record<K, number>,
  slotIndex: number,
  seed = 0,
): K | null {
  const entries = Object.entries(dist) as Array<[K, number]>;
  if (entries.length === 0) return null;
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return null;
  const position = (slotIndex + seed) % total;
  let cumulative = 0;
  for (const [key, w] of entries) {
    cumulative += w;
    if (position < cumulative) return key;
  }
  return entries[entries.length - 1]![0];
}

/**
 * Filtre une distribution de types sur les types RÉELLEMENT générables (REGISTRY).
 * Retire les types sans générateur (ex. `landing_ville`, CLI-only) AVANT
 * l'échantillonnage → l'orchestrateur ne crée plus de jobs voués à échouer
 * « No generator registered ». Re-normalisation implicite (les % restants se
 * répartissent sur les types valides). Si AUCUN type valide → renvoie tel quel
 * (le worker tranchera, mais on log) pour ne pas générer un vide silencieux.
 */
function registeredTypeDist(dist: Record<ContentType, number>): Record<ContentType, number> {
  const filtered = Object.fromEntries(
    Object.entries(dist).filter(([t]) => isContentTypeRegistered(t as ContentType)),
  ) as Record<ContentType, number>;
  const dropped = Object.keys(dist).filter((t) => !isContentTypeRegistered(t as ContentType));
  if (dropped.length > 0) {
    console.warn(
      `[orchestrator] types non générables ignorés (CLI-only/absents): ${dropped.join(", ")}`,
    );
  }
  return Object.keys(filtered).length > 0 ? filtered : dist;
}

function sampleAudienceMix(
  mix: Record<string, number>,
  slotIndex: number,
): { size: CompanySize; org: OrganisationType } | null {
  const key = sampleWeighted(mix, slotIndex, 37);
  if (!key) return null;
  const [size, org] = key.split(":") as [string, string];
  if (!size || !org) return null;
  return { size: size as CompanySize, org: org as OrganisationType };
}

/**
 * Échantillonne l'ACTIVITÉ Axion-IA (axe 2 multi-axes) pour un slot.
 * Si `serviceSectorWeights` est renseigné → tirage pondéré déterministe (seed 91,
 * décorrélé des autres axes). Sinon → fallback sur le singleton `serviceSector`
 * de la campagne (rétro-compat des campagnes mono-activité).
 */
export function sampleServiceSector(
  weights: Record<string, number> | null,
  slotIndex: number,
  fallback: ServiceSector | null,
): ServiceSector | null {
  if (weights && Object.keys(weights).length > 0) {
    const picked = sampleWeighted(weights, slotIndex, 91);
    if (picked) return picked as ServiceSector;
  }
  return fallback;
}

/**
 * Échantillonne le SECTEUR CLIENT (axe 3 multi-axes) pour un slot.
 * `null` si la campagne ne cible aucun secteur (→ pain-matrix dormante,
 * comportement historique). Seed 53, décorrélé des autres axes.
 */
export function sampleTargetSecteur(
  weights: Record<string, number> | null,
  slotIndex: number,
): string | null {
  if (weights && Object.keys(weights).length > 0) {
    return sampleWeighted(weights, slotIndex, 53);
  }
  return null;
}

/**
 * Étend une liste de villes d'ancrage aux communes « alentours » (axe 6).
 * - `radius` : ajoute les communes dans `radiusKm` (défaut 50) de chaque ancre.
 * - `same_departement` : ajoute les communes du même département que chaque ancre.
 * Dédupliqué, ordre stable (ancres d'abord), borné à `MAX_EXPANDED` pour éviter
 * l'explosion du pool. `none` ou liste vide → renvoyé tel quel.
 */
const MAX_EXPANDED_VILLES = 300;
const NEARBY_PER_ANCHOR = 25;
// Import paresseux de geo/villes (modules lourds : ~2150 communes + case-studies)
// → l'orchestrateur ne les charge QUE si une campagne utilise « ville & alentours ».
export async function expandVilleAnchors(
  baseSlugs: string[],
  mode: string,
  radiusKm: number | null,
): Promise<string[]> {
  if (mode === "none" || baseSlugs.length === 0) return baseSlugs;
  const [{ getNearbyVilles }, { getVille }] = await Promise.all([
    import("@/lib/geo"),
    import("@/content/villes"),
  ]);
  const out = new Set<string>(baseSlugs);
  const radius = radiusKm && radiusKm > 0 ? radiusKm : 50;
  for (const slug of baseSlugs) {
    if (out.size >= MAX_EXPANDED_VILLES) break;
    const origin = getVille(slug);
    if (!origin) continue;
    if (mode === "radius") {
      const nearby = getNearbyVilles(origin.geo, NEARBY_PER_ANCHOR, {
        excludeSlug: slug,
        maxKm: radius,
      });
      for (const n of nearby) {
        if (out.size >= MAX_EXPANDED_VILLES) break;
        out.add(n.ville.slug);
      }
    } else if (mode === "same_departement") {
      const nearby = getNearbyVilles(origin.geo, NEARBY_PER_ANCHOR, { excludeSlug: slug });
      for (const n of nearby) {
        if (out.size >= MAX_EXPANDED_VILLES) break;
        if (n.ville.departement === origin.departement) out.add(n.ville.slug);
      }
    }
  }
  return Array.from(out);
}

/**
 * Crée 1 ContentGenJob row + enqueue BullMQ pour un slot donné.
 * Factorisée pour partager la logique entre mode parallel et sequential.
 *
 * @returns true si enqueue réussi, false si idempotency hit ou erreur soft
 */
async function createJobForSlot(opts: {
  campaign: {
    id: string;
    name: string;
  };
  contentType: ContentType;
  /** Activité Axion-IA résolue pour CE slot (axe 2) — pilote vertical + KB. */
  serviceSector: ServiceSector | null;
  /** Secteur client échantillonné pour CE slot (axe 3) — réveille la pain-matrix. */
  targetSecteur: string | null;
  aud: { size: CompanySize; org: OrganisationType } | null;
  searchIntent: SearchIntent | "informational";
  /**
   * Garde-fou intent (2026-06-25) : true quand l'intent de CE slot est le défaut
   * hardcodé "informational" (ni `searchIntentMix` campagne ni config globale).
   * Propagé au worker (`inputPayload.allowKeywordIntent`) qui pourra alors laisser
   * l'intent NATIF du mot-clé sélectionné primer. Si la campagne a choisi une
   * distribution d'intent, false → l'intent campagne gagne (zéro régression).
   */
  allowKeywordIntent: boolean;
  anchorVilleSlug?: string;
  anchorDepartementCode?: string;
  anchorRegionSlug?: string;
  slotIndex: number;
}): Promise<boolean> {
  const {
    campaign,
    contentType,
    serviceSector,
    targetSecteur,
    aud,
    searchIntent,
    allowKeywordIntent,
    anchorVilleSlug,
    anchorDepartementCode,
    anchorRegionSlug,
    slotIndex,
  } = opts;
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(
      `${campaign.id}::${slotIndex}::${contentType}::${anchorVilleSlug ?? anchorRegionSlug ?? "global"}`,
    )
    .digest("hex")
    .slice(0, 32);

  // Sprint A-suite P6 — Item 3. correlationId UUID v4 pour traçabilité
  // end-to-end orchestrateur → gen-worker → publish-worker.
  const correlationId = crypto.randomUUID();

  try {
    const job = await prisma.contentGenJob.create({
      data: {
        idempotencyKey,
        contentType: contentType as ContentType,
        status: "queued",
        priority: 5,
        campaignId: campaign.id,
        // Catégorisation 2026-06-16 — propage l'activité (échantillonnée par slot
        // en multi-axes, sinon singleton campagne) au job → categoryId au publish.
        ...(serviceSector ? { serviceSector } : {}),
        correlationId,
        inputPayload: {
          campaignName: campaign.name,
          slotIndex,
          // Pas de primaryKeyword forcé : le content-gen-worker sélectionne dans
          // le pool riche via selectKeyword (rotation atomique, filtré vertical).
          // `vertical` (= activité du slot) pilote KB + pain-matrix côté worker.
          ...(serviceSector ? { vertical: serviceSector } : {}),
          // `targetSecteur` (secteur client) réveille la pain-matrix sectorielle
          // (cf. prompt-augmentation.ts, gated QUALITY_PROFILES_ENABLED + commercial).
          ...(targetSecteur ? { targetSecteur } : {}),
          // Garde-fou intent : on ne pose le flag QUE quand l'intent est le défaut
          // (campagne sans distribution) → le worker laisse alors l'intent natif du
          // mot-clé primer. Absent sinon = l'intent campagne reste souverain.
          ...(allowKeywordIntent ? { allowKeywordIntent: true } : {}),
        },
        targetLocale: "fr",
        ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
        ...(anchorDepartementCode ? { anchorDepartementCode } : {}),
        ...(anchorRegionSlug ? { anchorRegionSlug } : {}),
        ...(aud ? { targetAudienceSize: aud.size, targetAudienceOrganisation: aud.org } : {}),
        targetSearchIntent: searchIntent as SearchIntent,
        primaryProvider: "openai",
        fallbackProvider: "anthropic",
      },
    });
    await getContentGenQueue().add(
      "generate",
      {
        contentGenJobId: job.id,
        contentType: job.contentType,
        targetSearchIntent: job.targetSearchIntent,
        inputPayload: job.inputPayload,
      },
      { jobId: `gen-${job.id}` },
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Unique constraint")) {
      console.error("[orchestrator] insert ContentGenJob failed:", msg);
      return false;
    }

    // Fix 2026-08-15 — livelock d'idempotence.
    //
    // La création du job, son enfilement et l'incrément de `generatedCount` ne
    // sont pas atomiques. Si le processus s'arrête entre les deux premiers et le
    // troisième (redéploiement, coupure Redis), la ligne existe mais le compteur
    // n'a pas bougé : au tick suivant, le même `slotIndex` reproduit la même
    // `idempotencyKey`, la contrainte unique rejette l'insert, `enqueued` reste à
    // zéro — donc le compteur ne bouge toujours pas. La campagne était alors gelée
    // POUR TOUJOURS, en silence (la collision n'était même pas journalisée).
    //
    // On traite désormais la collision pour ce qu'elle est : ce slot A ÉTÉ servi.
    // On le compte comme consommé pour que la campagne avance, et on répare au
    // passage le job orphelin s'il n'a jamais rejoint la file.
    try {
      const existing = await prisma.contentGenJob.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          status: true,
          contentType: true,
          targetSearchIntent: true,
          inputPayload: true,
        },
      });
      if (existing && existing.status === "queued") {
        const jobId = `gen-${existing.id}`;
        const bullJob = await getContentGenQueue().getJob(jobId);
        if (!bullJob) {
          await getContentGenQueue().add(
            "generate",
            {
              contentGenJobId: existing.id,
              contentType: existing.contentType,
              targetSearchIntent: existing.targetSearchIntent,
              inputPayload: existing.inputPayload,
            },
            { jobId },
          );
          console.warn(
            `[orchestrator] slot ${slotIndex} — job orphelin ré-enfilé (${existing.id})`,
          );
        }
      }
    } catch (repairErr) {
      console.warn(
        "[orchestrator] réparation du slot en collision impossible:",
        repairErr instanceof Error ? repairErr.message : repairErr,
      );
    }
    // `true` = slot consommé : la campagne progresse au lieu de rejouer ce slot
    // indéfiniment.
    return true;
  }
}

/**
 * Résout la liste de villes pour une campagne :
 *  - custom_subset → customVilleSlugs (ou anchorVilleSlugs en fallback)
 *  - global_queue  → top-200 de CityGenerationOrder (pinned d'abord, puis rank)
 *  - (héritage)    → anchorVilleSlugs de la campagne
 */
async function resolveVilleAnchors(campaign: {
  villeScopeMode: string;
  customVilleSlugs: string[];
  anchorVilleSlugs: string[];
  scope: string;
  villeSurroundingMode?: string;
  villeSurroundingRadiusKm?: number | null;
}): Promise<string[]> {
  const surroundingMode = campaign.villeSurroundingMode ?? "none";
  const radiusKm = campaign.villeSurroundingRadiusKm ?? null;

  // Listes de villes EXPLICITES (custom_subset / anchors) → on peut étendre aux
  // alentours (axe 6). La file globale top-200 n'est PAS étendue (déjà large +
  // explosion combinatoire). « ville & alentours » = choisir des villes précises.
  if (campaign.villeScopeMode === "custom_subset") {
    const base =
      campaign.customVilleSlugs.length > 0 ? campaign.customVilleSlugs : campaign.anchorVilleSlugs;
    return expandVilleAnchors(base, surroundingMode, radiusKm);
  }
  if (campaign.anchorVilleSlugs.length > 0) {
    return expandVilleAnchors(campaign.anchorVilleSlugs, surroundingMode, radiusKm);
  }
  if (campaign.scope === "ville" || campaign.scope === "multi") {
    const rows = await prisma.cityGenerationOrder.findMany({
      orderBy: [{ pinned: "desc" }, { rank: "asc" }],
      take: 200,
      select: { villeSlug: true },
    });
    return rows.map((r) => r.villeSlug);
  }
  return [];
}

/**
 * Mode séquentiel : traite une seule ville à la fois.
 * Attend que tous les jobs de la ville courante soient terminés avant de passer à la suivante.
 * Met à jour currentCityIndex après enqueue de la nouvelle ville.
 */
async function processSequentialCampaign(
  campaign: {
    id: string;
    name: string;
    serviceSector: ServiceSector | null;
    serviceSectorWeights: unknown;
    targetSecteurWeights: unknown;
    anchorDepartementCodes: string[];
    anchorRegionSlugs: string[];
    typeDistribution: unknown;
    contentTypeWeights: unknown;
    audienceMix: unknown;
    searchIntentMix: unknown;
    scope: string;
    currentCityIndex: number | null;
    generatedCount: number;
    totalTargetCount: number;
    cityProcessingMode: CityProcessingMode;
  },
  toEnqueue: number,
  hasPerTypeMode: boolean,
  remainingByType: Partial<Record<ContentType, number>>,
  villeAnchors: string[],
): Promise<number> {
  if (villeAnchors.length === 0) {
    // Pas de villes → fallback parallel (scope non-ville)
    return processParallelCampaign(
      campaign,
      toEnqueue,
      hasPerTypeMode,
      remainingByType,
      undefined,
      villeAnchors,
    );
  }

  const currentCityIdx = campaign.currentCityIndex ?? 0;
  if (currentCityIdx >= villeAnchors.length) {
    // Toutes les villes terminées → ne rien enqueue
    console.log(
      `[orchestrator] sequential campaign=${campaign.id} all cities done (idx=${currentCityIdx}/${villeAnchors.length})`,
    );
    return 0;
  }

  const currentCitySlug = villeAnchors[currentCityIdx]!;

  // Fix 2026-08-15 — le mode séquentiel n'attendait jamais rien.
  //
  // L'index de ville était avancé JUSTE APRÈS l'enfilement (en fin de fonction),
  // si bien qu'au tick suivant le comptage « jobs en cours » portait sur la ville
  // SUIVANTE, qui n'avait évidemment aucun job : la condition d'attente ne
  // pouvait structurellement jamais se déclencher. Deux conséquences :
  // chaque ville ne recevait que le budget d'UN tick (souvent 1 seul article au
  // lieu de sa couverture), et après autant de ticks que de villes la campagne
  // n'enfilait plus rien tout en restant `running` — un tick à vide éternel,
  // sans alerte.
  //
  // La couverture visée par ville est déduite de la cible globale répartie sur
  // les villes du périmètre. L'index n'avance QUE lorsque la ville a reçu sa
  // couverture ET que tous ses jobs sont retombés dans un état terminal.
  const perCityTarget =
    campaign.totalTargetCount > 0
      ? Math.max(1, Math.ceil(campaign.totalTargetCount / villeAnchors.length))
      : 1;

  const cityCreated = await prisma.contentGenJob.count({
    where: {
      campaignId: campaign.id,
      anchorVilleSlug: currentCitySlug,
      status: { not: "cancelled" },
    },
  });

  if (cityCreated >= perCityTarget) {
    // `needs_review` est volontairement EXCLU des états « en cours » : c'est une
    // issue terminale du pipeline (rejet automatique ou attente de relecture),
    // pas une étape. L'y inclure aurait bloqué la campagne entière sur un seul
    // article recalé.
    const cityPending = await prisma.contentGenJob.count({
      where: {
        campaignId: campaign.id,
        anchorVilleSlug: currentCitySlug,
        status: {
          in: [
            "queued",
            "running",
            "generating_text",
            "generating_image",
            "running_qa",
            "quality_improving",
            "approved",
            "publishing",
          ],
        },
      },
    });

    if (cityPending > 0) {
      console.log(
        `[orchestrator] sequential campaign=${campaign.id} ville=${currentCitySlug} — couverture atteinte, ${cityPending} job(s) en cours, on attend`,
      );
      return 0;
    }

    await prisma.coverageCampaign.update({
      where: { id: campaign.id },
      data: { currentCityIndex: currentCityIdx + 1 },
    });
    console.log(
      `[orchestrator] sequential campaign=${campaign.id} ville=${currentCitySlug} terminée (${currentCityIdx + 1}/${villeAnchors.length}) → ville suivante au prochain tick`,
    );
    return 0;
  }

  // Ville courante encore à couvrir → on complète son quota, sans dépasser le
  // budget du tick (qui porte, lui, le rythme quotidien de la campagne).
  const cityRoom = perCityTarget - cityCreated;
  const cityToEnqueue = Math.min(toEnqueue, cityRoom);

  // Ville courante terminée (ou jamais démarrée) → créer les jobs pour cette ville
  const typeDist = registeredTypeDist(
    (campaign.contentTypeWeights != null
      ? campaign.contentTypeWeights
      : campaign.typeDistribution) as Record<ContentType, number>,
  );
  const audienceMix = campaign.audienceMix as Record<string, number>;
  const intentMix = campaign.searchIntentMix as Record<SearchIntent, number> | null;
  const serviceSectorWeights = campaign.serviceSectorWeights as Record<string, number> | null;
  const targetSecteurWeights = campaign.targetSecteurWeights as Record<string, number> | null;

  // Séquence de types entrelacée pour toute la campagne, indexée par slot global.
  const typeSeq = buildWeightedSequence(
    typeDist,
    Math.max(campaign.totalTargetCount, campaign.generatedCount + cityToEnqueue),
  );

  let enqueued = 0;
  for (let i = 0; i < cityToEnqueue; i++) {
    const slotIndex = campaign.generatedCount + i;
    let contentType: ContentType | null;
    if (hasPerTypeMode) {
      const next = Object.entries(remainingByType).find(([, count]) => (count ?? 0) > 0);
      if (!next) break;
      contentType = next[0] as ContentType;
      remainingByType[contentType] = (remainingByType[contentType] ?? 1) - 1;
    } else {
      contentType = typeSeq[slotIndex] ?? sampleWeighted(typeDist, slotIndex);
    }
    if (!contentType) continue;
    const aud = sampleAudienceMix(audienceMix, slotIndex);
    const searchIntent = intentMix ? sampleWeighted(intentMix, slotIndex, 73) : "informational";
    const serviceSector = sampleServiceSector(
      serviceSectorWeights,
      slotIndex,
      campaign.serviceSector,
    );
    const targetSecteur = sampleTargetSecteur(targetSecteurWeights, slotIndex);
    const ok = await createJobForSlot({
      campaign,
      contentType,
      serviceSector,
      targetSecteur,
      aud,
      searchIntent: (searchIntent ?? "informational") as SearchIntent,
      // !intentMix = même condition que le défaut "informational" ci-dessus :
      // ni mix campagne ni config globale → l'intent du mot-clé pourra primer.
      allowKeywordIntent: !intentMix,
      anchorVilleSlug: currentCitySlug,
      slotIndex,
    });
    if (ok) enqueued++;
  }

  // L'index de ville n'est PLUS avancé ici : c'est précisément ce qui rendait
  // l'attente inopérante (cf. le commentaire en tête de cette fonction). Il
  // avance en début de tick, une fois la ville réellement couverte et ses jobs
  // terminés.
  console.log(
    `[orchestrator] sequential campaign=${campaign.id} ville=${currentCitySlug} (${currentCityIdx + 1}/${villeAnchors.length}) — ${cityCreated + enqueued}/${perCityTarget} enfilés`,
  );
  return enqueued;
}

/**
 * Mode parallèle : comportement original — toutes les villes simultanément.
 * forcedVilleSlug permet de forcer une ville (appelé depuis sequential pour scope non-ville).
 */
async function processParallelCampaign(
  campaign: {
    id: string;
    name: string;
    serviceSector: ServiceSector | null;
    serviceSectorWeights: unknown;
    targetSecteurWeights: unknown;
    anchorDepartementCodes: string[];
    anchorRegionSlugs: string[];
    typeDistribution: unknown;
    contentTypeWeights: unknown;
    audienceMix: unknown;
    searchIntentMix: unknown;
    scope: string;
    generatedCount: number;
    totalTargetCount: number;
  },
  toEnqueue: number,
  hasPerTypeMode: boolean,
  remainingByType: Partial<Record<ContentType, number>>,
  forcedVilleSlug: string | undefined,
  villeAnchors: string[],
): Promise<number> {
  const typeDist = registeredTypeDist(
    (campaign.contentTypeWeights != null
      ? campaign.contentTypeWeights
      : campaign.typeDistribution) as Record<ContentType, number>,
  );
  const audienceMix = campaign.audienceMix as Record<string, number>;
  const intentMix = campaign.searchIntentMix as Record<SearchIntent, number> | null;
  const serviceSectorWeights = campaign.serviceSectorWeights as Record<string, number> | null;
  const targetSecteurWeights = campaign.targetSecteurWeights as Record<string, number> | null;
  const deptAnchors = campaign.anchorDepartementCodes;
  const regionAnchors = campaign.anchorRegionSlugs;

  // Séquence de types entrelacée pour toute la campagne, indexée par slot global.
  const typeSeq = buildWeightedSequence(
    typeDist,
    Math.max(campaign.totalTargetCount, campaign.generatedCount + toEnqueue),
  );

  let enqueued = 0;
  for (let i = 0; i < toEnqueue; i++) {
    const slotIndex = campaign.generatedCount + i;
    let contentType: ContentType | null;
    if (hasPerTypeMode) {
      const next = Object.entries(remainingByType).find(([, count]) => (count ?? 0) > 0);
      if (!next) break;
      contentType = next[0] as ContentType;
      remainingByType[contentType] = (remainingByType[contentType] ?? 1) - 1;
    } else {
      contentType = typeSeq[slotIndex] ?? sampleWeighted(typeDist, slotIndex);
    }
    if (!contentType) continue;
    const aud = sampleAudienceMix(audienceMix, slotIndex);
    const searchIntent = intentMix ? sampleWeighted(intentMix, slotIndex, 73) : "informational";
    const serviceSector = sampleServiceSector(
      serviceSectorWeights,
      slotIndex,
      campaign.serviceSector,
    );
    const targetSecteur = sampleTargetSecteur(targetSecteurWeights, slotIndex);

    let anchorVilleSlug: string | undefined = forcedVilleSlug;
    let anchorDepartementCode: string | undefined;
    let anchorRegionSlug: string | undefined;

    if (!anchorVilleSlug) {
      if (campaign.scope === "ville" && villeAnchors.length > 0) {
        anchorVilleSlug = villeAnchors[slotIndex % villeAnchors.length];
      } else if (campaign.scope === "departement" && deptAnchors.length > 0) {
        anchorDepartementCode = deptAnchors[slotIndex % deptAnchors.length];
      } else if (campaign.scope === "region" && regionAnchors.length > 0) {
        anchorRegionSlug = regionAnchors[slotIndex % regionAnchors.length];
      } else if (campaign.scope === "multi") {
        if (villeAnchors.length > 0) {
          anchorVilleSlug = villeAnchors[slotIndex % villeAnchors.length];
        } else if (regionAnchors.length > 0) {
          anchorRegionSlug = regionAnchors[slotIndex % regionAnchors.length];
        }
      }
    }
    const ok = await createJobForSlot({
      campaign,
      contentType,
      serviceSector,
      targetSecteur,
      aud,
      searchIntent: (searchIntent ?? "informational") as SearchIntent,
      // !intentMix = même condition que le défaut "informational" ci-dessus.
      allowKeywordIntent: !intentMix,
      ...(anchorVilleSlug ? { anchorVilleSlug } : {}),
      ...(anchorDepartementCode ? { anchorDepartementCode } : {}),
      ...(anchorRegionSlug ? { anchorRegionSlug } : {}),
      slotIndex,
    });
    if (ok) enqueued++;
  }
  return enqueued;
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  // Kill switch — lecture fail-SAFE (2026-08-15) : une erreur DB ne doit pas
  // « dé-geler » silencieusement un arrêt d'urgence en retombant sur le défaut
  // `{active:false}`. État illisible = production considérée arrêtée.
  const killSwitch = await readKillSwitchFailSafe();
  if (killSwitch.active) {
    console.log(
      `[orchestrator] kill switch actif (${killSwitch.reason ?? "sans motif"}), tick ignoré`,
    );
    return;
  }

  // Fix 2026-07-18 — resynchronise failedCount/publishedCount (personne ne les
  // écrivait : la console affichait 0/0 sur toutes les campagnes). Placé AVANT
  // l'early-return « no running campaigns » pour corriger aussi les campagnes
  // paused/completed. Fail-open : ne bloque jamais l'orchestration.
  try {
    const resynced = await syncCampaignCounters();
    if (resynced > 0) {
      console.log(`[orchestrator] compteurs de campagne resynchronisés (${resynced})`);
    }
  } catch (err) {
    console.warn(
      "[orchestrator] sync compteurs échoué (non bloquant):",
      err instanceof Error ? err.message : err,
    );
  }

  // Reprise du retard (2026-08-15) — AVANT l'early-return « aucune campagne en
  // cours », pour deux raisons : une partie des jobs en échec n'appartient à
  // aucune campagne (enqueues directs, RSS), et le retard doit continuer à se
  // résorber même quand toutes les campagnes sont en pause.
  //
  // Sans ce bloc, les échecs restent perdus DÉFINITIVEMENT : le compteur de slots
  // d'une campagne ne redescend jamais, donc l'orchestrateur ne repasse jamais
  // sur un slot déjà servi. Une remise de crédit ne régénérerait que du neuf.
  try {
    const recovery = await readContentGenConfig<BacklogRecoverySettings>(
      "backlog_recovery",
      DEFAULT_RECOVERY_SETTINGS,
    );
    const genQueue = getContentGenQueue();
    const stuck = await sweepStuckJobs(genQueue, recovery);
    const drained = await drainFailedJobs(genQueue, recovery);
    const improver = getQualityImproverQueue();
    const stranded = improver
      ? await sweepStrandedQualityJobs(improver, recovery)
      : { requeued: 0, skipped: 0 };
    const total = stuck.requeued + drained.requeued + stranded.requeued;
    if (total > 0) {
      console.log(
        `[orchestrator] reprise du retard — ${drained.requeued} échec(s) relancé(s), ` +
          `${stuck.requeued} job(s) figé(s) débloqué(s), ${stranded.requeued} en boucle qualité`,
      );
    }
  } catch (err) {
    // Fail-open : la reprise du retard ne doit jamais empêcher la production neuve.
    console.warn(
      "[orchestrator] reprise du retard échouée (non bloquant):",
      err instanceof Error ? err.message : err,
    );
  }

  const batchSettings = await readContentGenConfig<BatchSettings>("batches", {
    workersConcurrency: 3,
  });

  const runningCampaigns = await prisma.coverageCampaign.findMany({
    where: { status: "running" },
    orderBy: { createdAt: "asc" },
  });

  if (runningCampaigns.length === 0) {
    console.log("[orchestrator] no running campaigns, skip tick");
    return;
  }

  // 2026-06-15 — Fallback global d'intention de recherche : avant, une campagne
  // SANS searchIntentMix retombait toujours sur "informational" (réglage console
  // /settings/search-intent-distribution dormant, jamais lu). Désormais on l'utilise
  // comme distribution par défaut. Mapping vers les valeurs enum SearchIntent
  // (commercial → commercial_investigation). Appliqué en place aux campagnes
  // dépourvues de mix propre (leur mix per-campagne reste prioritaire).
  // Lecture directe de la config (clé `search_intent_distribution`) — PAS via
  // policies.ts (use-server → tire next-auth, casse le worker). Même clé/défauts.
  // ⚠️ Défaut `{}` volontaire. Une répartition se lit d'un bloc : passer des
  // défauts ici les ferait fusionner clé par clé avec la configuration stockée,
  // qui est en fractions (somme 1) là où ces défauts sont en pourcentages
  // (somme 100). Le mélange donnerait `commercial: 25` face à des voisins à
  // 0,1 — soit une part commerciale écrasant tout. Les défauts s'appliquent
  // en bloc dans `resolveIntentDistribution`, et seulement si rien
  // d'exploitable n'est stocké.
  const rawIntentDist = await readContentGenConfig<unknown>("search_intent_distribution", {});
  // Robustesse intent (P1) — `resolve` valide les clés contre l'ensemble connu
  // (enum SearchIntent + alias FR/simplifiés) puis replie sur les défauts EN
  // BLOC. FAIL-OPEN : une clé inconnue/typo (ex. "commercia") est warn +
  // ignorée, jamais throw — l'orchestration continue avec les clés valides.
  // Les poids sont RELATIFS ici (tirage pondéré) : l'échelle n'a pas
  // d'importance, seule leur cohérence entre eux en a.
  const intentDist: {
    informational?: number;
    commercial?: number;
    local?: number;
    transactional?: number;
    navigational?: number;
  } = resolveIntentDistribution(rawIntentDist);
  const globalIntentMix: Partial<Record<SearchIntent, number>> = {
    informational: intentDist.informational ?? 0,
    commercial_investigation: intentDist.commercial ?? 0,
    local: intentDist.local ?? 0,
    transactional: intentDist.transactional ?? 0,
    navigational: intentDist.navigational ?? 0,
  };
  const hasGlobalIntent = Object.values(globalIntentMix).some((v) => (v ?? 0) > 0);
  for (const c of runningCampaigns) {
    if (hasGlobalIntent && c.searchIntentMix == null) {
      (c as { searchIntentMix: unknown }).searchIntentMix = globalIntentMix;
    }
  }

  // Sprint 7 V2 : si dailyTargetByType configuré, on dérive `perCampaignTick`
  // depuis les décisions anti-burst (somme des enqueueCount actuels). Sinon
  // fallback V2 = ceil(campaign.dailyArticles / 96) par campagne.
  const perTypeTargets = batchSettings.dailyTargetByType ?? {};
  const hasPerTypeMode = Object.values(perTypeTargets).some((v) => (v ?? 0) > 0);

  let tickBudget = 0;
  let perTypeDecisions: ReadonlyArray<{ contentType: ContentType; enqueueCount: number }> = [];
  if (hasPerTypeMode) {
    const startOfDayUtc = new Date();
    startOfDayUtc.setUTCHours(0, 0, 0, 0);
    const createdTodayRaw = await prisma.contentGenJob.groupBy({
      by: ["contentType"],
      where: { createdAt: { gte: startOfDayUtc }, status: { not: "cancelled" } },
      _count: { _all: true },
    });
    const createdTodayByType: Partial<Record<ContentType, number>> = {};
    for (const row of createdTodayRaw) {
      createdTodayByType[row.contentType as ContentType] = row._count._all;
    }
    perTypeDecisions = computeAntiBurstSchedule({
      targetByType: perTypeTargets,
      createdTodayByType,
      msSinceStartOfDay: msSinceStartOfDay(),
      antiBurstEnabled: batchSettings.antiBurstEnabled ?? true,
    });
    tickBudget = perTypeDecisions.reduce((sum, d) => sum + d.enqueueCount, 0);
    if (tickBudget === 0) {
      console.log("[orchestrator] per-type schedule says nothing to enqueue this tick");
      return;
    }
  }
  // !hasPerTypeMode → budget V2 per-campaign (dailyArticles / 96 ticks/day), computed in loop

  // Sprint 7 V2 : compteur résiduel par type pour distribuer entre campagnes
  const remainingByType: Partial<Record<ContentType, number>> = {};
  for (const d of perTypeDecisions) {
    remainingByType[d.contentType] = d.enqueueCount;
  }

  let totalEnqueued = 0;

  for (const campaign of runningCampaigns) {
    // Sprint Campaign Controls — skip si endDate dépassée (deadline-checker gère le passage completed)
    if (campaign.endDate && campaign.endDate <= new Date()) {
      console.log(`[orchestrator] campaign=${campaign.id} endDate passed, skip tick`);
      continue;
    }

    // Axe 8 — durée : une campagne `unlimited` ne se complète JAMAIS par compteur
    // (totalTargetCount ignoré) ; seuls l'arrêt manuel (pause/stop) ou endDate la
    // terminent. `fixed` conserve le comportement historique (stop à la cible).
    const isUnlimited = campaign.durationMode === "unlimited";
    const remaining = isUnlimited
      ? Number.MAX_SAFE_INTEGER
      : campaign.totalTargetCount - campaign.generatedCount;
    if (!isUnlimited && remaining <= 0) {
      // Fix 2026-08-15 — ne clore la campagne que lorsque plus aucun job n'est en
      // vol. `generatedCount` compte les ENQUEUES : une campagne pouvait donc être
      // marquée « terminée » alors que ses derniers jobs tournaient encore, ou
      // pire, alors qu'une panne provider venait de tous les faire échouer. Une
      // campagne close ne reprend jamais — la clore trop tôt perdait le reliquat.
      const stillActive = await prisma.contentGenJob.count({
        where: {
          campaignId: campaign.id,
          status: {
            in: [
              "queued",
              "running",
              "generating_text",
              "generating_image",
              "running_qa",
              "quality_improving",
              "approved",
              "publishing",
            ],
          },
        },
      });
      if (stillActive > 0) {
        console.log(
          `[orchestrator] campaign=${campaign.id} cible atteinte mais ${stillActive} job(s) en cours — clôture différée`,
        );
        continue;
      }
      await prisma.coverageCampaign.update({
        where: { id: campaign.id },
        data: { status: "completed", completedAt: new Date() },
      });
      // P1-17 fix audit opérationnel — alerte Telegram "Campagne terminée".
      try {
        const stats = await prisma.contentGenJob.aggregate({
          where: { campaignId: campaign.id },
          _sum: { costUsd: true },
          _avg: { qualityScore: true },
        });
        const published = await prisma.contentGenJob.count({
          where: { campaignId: campaign.id, status: "published" },
        });
        const failed = await prisma.contentGenJob.count({
          where: { campaignId: campaign.id, status: "failed" },
        });
        void alertCampaignDone(
          campaign.name,
          campaign.id,
          campaign.totalTargetCount,
          Number(stats._sum.costUsd ?? 0),
          Number(stats._avg.qualityScore ?? 0),
          published,
          failed,
        ).catch(() => undefined);
      } catch {
        // best-effort
      }
      continue;
    }

    // V2 : budget par campagne — per-type ou per-campaign dailyArticles.
    //
    // Fix 2026-08-15 — le mode per-campaign (le défaut) appliquait
    // `max(1, ceil(dailyArticles / 96))`, sans jamais compter ce qui avait déjà
    // été créé dans la journée. Le plancher à 1 faisait donc enqueue un job à
    // CHACUN des 96 ticks quotidiens : ~96 jobs/jour quelle que soit la cible.
    // Mesuré en prod les 23-24/07 : ~88 jobs/jour pour une campagne réglée à 20,
    // soit un crédit provider consommé près de 5× trop vite.
    let perCampaignTick: number;
    if (hasPerTypeMode) {
      perCampaignTick = Math.max(1, Math.floor(tickBudget / runningCampaigns.length));
    } else {
      const startOfDayUtc = new Date();
      startOfDayUtc.setUTCHours(0, 0, 0, 0);
      const createdToday = await prisma.contentGenJob.count({
        where: {
          campaignId: campaign.id,
          createdAt: { gte: startOfDayUtc },
          status: { not: "cancelled" },
        },
      });
      perCampaignTick = computeCampaignTickBudget({
        dailyTarget: (campaign.dailyArticles ?? 30) as number,
        createdToday,
        msSinceStartOfDay: msSinceStartOfDay(),
        antiBurstEnabled: batchSettings.antiBurstEnabled ?? true,
      });
      if (perCampaignTick === 0) {
        console.log(
          `[orchestrator] campaign=${campaign.id} cible du jour tenue (${createdToday}/${campaign.dailyArticles ?? 30}), rien à enfiler`,
        );
        continue;
      }
    }
    const toEnqueue = Math.min(perCampaignTick, remaining);
    const villeAnchors = await resolveVilleAnchors(campaign);

    // Sprint Campaign Controls — dispatch selon cityProcessingMode
    let enqueued: number;
    if (campaign.cityProcessingMode === "sequential") {
      enqueued = await processSequentialCampaign(
        campaign,
        toEnqueue,
        hasPerTypeMode,
        remainingByType,
        villeAnchors,
      );
    } else {
      enqueued = await processParallelCampaign(
        campaign,
        toEnqueue,
        hasPerTypeMode,
        remainingByType,
        undefined,
        villeAnchors,
      );
    }
    totalEnqueued += enqueued;

    // P1 2026-06-13 — Fix dérive : incrémenter du nombre RÉELLEMENT enqueué
    // (`enqueued`), pas du nombre visé (`toEnqueue`). En mode séquentiel, une
    // ville en cours retourne 0 ; l'ancien `toEnqueue` gonflait `generatedCount`
    // et marquait la campagne `completed` (remaining<=0) sans avoir atteint la
    // cible réelle. Skip l'update si rien n'a été produit (évite un write inutile).
    if (enqueued > 0) {
      await prisma.coverageCampaign.update({
        where: { id: campaign.id },
        data: { generatedCount: { increment: enqueued } },
      });
    }
  }

  console.log(
    `[orchestrator] tick OK — ${totalEnqueued} jobs enqueued across ${runningCampaigns.length} campaigns ` +
      `(mode=${hasPerTypeMode ? "per-type-antiburst" : "per-campaign-dailyArticles"}, tickBudget=${tickBudget})`,
  );
}

let workerInstance: Worker | null = null;

export function startOrchestratorWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — orchestrator-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-orchestrator-worker] job ${job?.id} failed:`, err);
    // Sprint S+4-C (audit content-gen deep 2026-05-18 P1-7) — Sentry capture
    // pour observer les fails du tick orchestrator (campaign scan + enqueue).
    // Volume tick = 1 toutes les 15 min → low cardinality, fingerprint stable.
    captureWorkerError("orchestrator", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopOrchestratorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (contentGenQueue) {
    await contentGenQueue.close();
    contentGenQueue = null;
  }
}
