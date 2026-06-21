/**
 * Content Generator — Campaign wizard server action (Sprint v7 Phase 3 commit 1).
 *
 * Crée une CoverageCampaign à partir des 4 steps wizard /content-gen/campaigns/new :
 *   Step 1 : Verticale (5 services Axion-IA)
 *   Step 2 : Nom + volume (dailyArticles, totalTargetCount) + scope villes
 *   Step 3 : Mix contenu (9 sliders ContentType actuels — pas encore les 19
 *            de Phase 8 qui ajoute long_tail / case_study_local / etc.)
 *   Step 4 : Récap + Brouillon (status=draft) ou Lancer (status=running)
 *
 * Auth + rate-limit + audit log + Sentry + revalidatePath conformes §6.2 et §9.2.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/content-gen/shared/activity-log";

import { requireAdminWriteRateLimited } from "./_auth";

// ─── Helpers ────────────────────────────────────────────────────────────────

function adminBase(): string {
  return `/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/campaigns`;
}

// ─── Constantes ContentType — Sprint v7 Phase 8 (21 sliders 6 sections) ────
// Source de vérité : `./campaign-wizard-constants.ts` (sans "use server" pour
// importable côté tests vitest sans chaîne next-auth → next/server).

// Note : les constantes (WIZARD_CONTENT_TYPES, WIZARD_SECTIONS, WizardContentType)
// doivent être importées DIRECTEMENT depuis "./campaign-wizard-constants" — un
// fichier "use server" ne peut exporter que des fonctions async (contrainte Next 16).
import {
  WIZARD_CONTENT_TYPES,
  WIZARD_SERVICE_SECTORS,
  WIZARD_SEARCH_INTENTS,
} from "./campaign-wizard-constants";
import { CLIENT_SECTOR_SLUGS } from "@/content/sectors";

// ─── Zod schema (validation Step 4 submit) ──────────────────────────────────

const SERVICE_SECTOR_VALUES = WIZARD_SERVICE_SECTORS.map((s) => s.value) as unknown as [
  string,
  ...string[],
];
const SEARCH_INTENT_VALUES = WIZARD_SEARCH_INTENTS.map((s) => s.value) as unknown as [
  string,
  ...string[],
];
const CLIENT_SECTOR_VALUES = [...CLIENT_SECTOR_SLUGS] as unknown as [string, ...string[]];
// Clé audienceMix « SIZE:ORG » (axe 5). SIZE ∈ enum CompanySize.
const AUDIENCE_KEY_RE = /^(TPE|PME|ETI|GRANDE_ENTREPRISE):[a-z_]+$/;

/** Record pondéré à vocabulaire fermé : ≥ 1 pondération > 0 (proportions). */
function weightedEnumRecord(values: [string, ...string[]]) {
  return z
    .record(z.enum(values), z.number().int().min(0).max(1000))
    .refine((w) => Object.values(w).reduce((s, v) => s + (v ?? 0), 0) > 0, {
      message: "au moins une pondération > 0",
    });
}

const WizardInputSchema = z
  .object({
    serviceSector: z.enum([
      "interventions_formations",
      "audits",
      "implementations",
      "un_a_un",
      "sites_web_augmentes",
    ]),
    name: z.string().min(2).max(120),
    dailyArticles: z.number().int().min(1).max(1000),
    targetPerCity: z.number().int().min(1).max(200),
    villeScopeMode: z.enum(["global_queue", "custom_subset"]),
    customVilleSlugs: z.array(z.string().min(1).max(120)).max(2200),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    mixMode: z.enum(["percentage", "manual"]),
    contentTypeWeights: z
      .record(z.enum(WIZARD_CONTENT_TYPES), z.number().int().min(0).max(1000))
      .refine((w) => Object.values(w).reduce((s, v) => s + v, 0) > 0, {
        message: "Au moins un slider doit être > 0",
      }),
    // ── Axes multi-axes (tous optionnels → rétro-compat) ─────────────────────
    // Axe 2 — % activité (sinon singleton serviceSector). Proportions (sampleWeighted
    // normalise par la somme), pas besoin de = 100.
    serviceSectorWeights: weightedEnumRecord(SERVICE_SECTOR_VALUES).optional(),
    // Axe 3 — % secteur client (santé/BTP/juridique…). Réveille la pain-matrix.
    targetSecteurWeights: weightedEnumRecord(CLIENT_SECTOR_VALUES).optional(),
    // Axe 4 — % intention de recherche (sinon fallback global console).
    searchIntentMix: weightedEnumRecord(SEARCH_INTENT_VALUES).optional(),
    // Axe 5 — % audience « SIZE:ORG » (sinon { default: 100 }).
    audienceMix: z
      .record(z.string().regex(AUDIENCE_KEY_RE), z.number().int().min(0).max(1000))
      .refine((w) => Object.values(w).reduce((s, v) => s + (v ?? 0), 0) > 0, {
        message: "au moins une audience > 0",
      })
      .optional(),
    // Axe 6 — ville & alentours.
    villeSurroundingMode: z.enum(["none", "radius", "same_departement"]).default("none"),
    villeSurroundingRadiusKm: z.number().int().min(5).max(200).optional(),
    // Axe 8 — durée fixe ou illimitée.
    durationMode: z.enum(["fixed", "unlimited"]).default("fixed"),
    action: z.enum(["draft", "launch"]),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.villeScopeMode === "custom_subset" && input.customVilleSlugs.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customVilleSlugs"],
        message: "custom_subset requiert au moins 1 ville sélectionnée",
      });
    }
    if (input.mixMode === "percentage") {
      const sum = Object.values(input.contentTypeWeights).reduce((s, v) => s + v, 0);
      if (Math.abs(sum - 100) > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["contentTypeWeights"],
          message: `mode percentage : somme sliders doit = 100 (actuel : ${sum})`,
        });
      }
    }
  });

export type CampaignWizardInput = z.infer<typeof WizardInputSchema>;

export interface CampaignWizardResult {
  readonly campaignId: string;
  readonly status: "draft" | "running";
}

// ─── Action ─────────────────────────────────────────────────────────────────

export async function createCampaignFromWizard(rawInput: unknown): Promise<CampaignWizardResult> {
  const session = await requireAdminWriteRateLimited("campaign-wizard-create", {
    limit: 10,
    windowSec: 60,
  });
  const input = WizardInputSchema.parse(rawInput);

  try {
    const totalTargetCount = input.dailyArticles * 30;
    // Axe 5 — audience pilotée par la campagne si fournie, sinon défaut historique.
    const audienceMix =
      input.audienceMix && Object.keys(input.audienceMix).length > 0
        ? input.audienceMix
        : { default: 100 };
    const typeDistribution = input.contentTypeWeights as Record<string, number>;

    const campaign = await prisma.coverageCampaign.create({
      data: {
        name: input.name,
        status: input.action === "launch" ? "running" : "draft",
        scope: "ville",
        // Activité « primaire » = fallback rétro-compat + catégorisation. L'axe 2
        // (serviceSectorWeights) prime à l'échantillonnage par job s'il est fourni.
        serviceSector: input.serviceSector,
        totalTargetCount,
        typeDistribution: typeDistribution as never,
        audienceMix: audienceMix as never,
        dailyArticles: input.dailyArticles,
        villeScopeMode: input.villeScopeMode,
        customVilleSlugs: input.customVilleSlugs,
        mixMode: input.mixMode,
        contentTypeWeights: input.contentTypeWeights as never,
        // ── Axes multi-axes (conditionnels : NULL = comportement historique) ──
        ...(input.serviceSectorWeights
          ? { serviceSectorWeights: input.serviceSectorWeights as never }
          : {}),
        ...(input.targetSecteurWeights
          ? { targetSecteurWeights: input.targetSecteurWeights as never }
          : {}),
        ...(input.searchIntentMix ? { searchIntentMix: input.searchIntentMix as never } : {}),
        villeSurroundingMode: input.villeSurroundingMode,
        ...(input.villeSurroundingRadiusKm
          ? { villeSurroundingRadiusKm: input.villeSurroundingRadiusKm }
          : {}),
        durationMode: input.durationMode,
        ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
        createdBy: session.userId,
        ...(input.action === "launch" ? { startedAt: new Date() } : {}),
      },
      select: { id: true, status: true },
    });

    revalidatePath(adminBase());
    revalidatePath(`${adminBase()}/${campaign.id}`);

    await logActivity({
      session,
      action:
        input.action === "launch" ? "content-gen.campaign.launch" : "content-gen.campaign.draft",
      targetType: "CoverageCampaign",
      targetId: campaign.id,
      changes: {
        name: input.name,
        serviceSector: input.serviceSector,
        dailyArticles: input.dailyArticles,
        villeScopeMode: input.villeScopeMode,
        customSubsetSize: input.customVilleSlugs.length,
        mixMode: input.mixMode,
        // Axes multi-axes activés (traçabilité).
        serviceSectorMixKeys: input.serviceSectorWeights
          ? Object.keys(input.serviceSectorWeights).length
          : 0,
        targetSecteurMixKeys: input.targetSecteurWeights
          ? Object.keys(input.targetSecteurWeights).length
          : 0,
        searchIntentMixKeys: input.searchIntentMix ? Object.keys(input.searchIntentMix).length : 0,
        audienceMixKeys: input.audienceMix ? Object.keys(input.audienceMix).length : 0,
        villeSurroundingMode: input.villeSurroundingMode,
        durationMode: input.durationMode,
        status: campaign.status,
      },
    });

    return {
      campaignId: campaign.id,
      status: campaign.status === "running" ? "running" : "draft",
    };
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: "content-gen", action: "createCampaignFromWizard" },
    });
    throw e;
  }
}
