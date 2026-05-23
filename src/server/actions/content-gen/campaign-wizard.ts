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

// ─── Constantes ContentType (les 9 actuels — Phase 8 ajoutera 12 nouveaux) ──

export const WIZARD_CONTENT_TYPES = [
  "landing_ville",
  "blog_article",
  "blog_from_rss",
  "blog_from_keywords",
  "blog_from_title",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
] as const;

export type WizardContentType = (typeof WIZARD_CONTENT_TYPES)[number];

// ─── Zod schema (validation Step 4 submit) ──────────────────────────────────

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
    const audienceMix = { default: 100 };
    const typeDistribution = input.contentTypeWeights as Record<string, number>;

    const campaign = await prisma.coverageCampaign.create({
      data: {
        name: input.name,
        status: input.action === "launch" ? "running" : "draft",
        scope: "ville",
        serviceSector: input.serviceSector,
        totalTargetCount,
        typeDistribution: typeDistribution as never,
        audienceMix: audienceMix as never,
        dailyArticles: input.dailyArticles,
        villeScopeMode: input.villeScopeMode,
        customVilleSlugs: input.customVilleSlugs,
        mixMode: input.mixMode,
        contentTypeWeights: input.contentTypeWeights as never,
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
