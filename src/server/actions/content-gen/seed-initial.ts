"use server";

import { prisma } from "@/lib/prisma";
import { seedKbFacts } from "../../../../prisma/seeds/content-gen/seed-kb-facts";
import { seedCampaignTemplates } from "../../../../prisma/seeds/content-gen/seed-campaign-templates";

export interface SeedResult {
  kbFacts: number;
  campaignTemplates: number;
  ok: boolean;
  error?: string;
}

export async function runInitialSeed(): Promise<SeedResult> {
  try {
    const [kbFacts, campaignTemplates] = await Promise.all([
      seedKbFacts(prisma as Parameters<typeof seedKbFacts>[0]),
      seedCampaignTemplates(prisma as Parameters<typeof seedCampaignTemplates>[0]),
    ]);
    return { kbFacts, campaignTemplates, ok: true };
  } catch (e) {
    return { kbFacts: 0, campaignTemplates: 0, ok: false, error: String(e) };
  }
}
