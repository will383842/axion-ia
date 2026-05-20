/**
 * Content Generator — Settings providers (§ 12.5).
 *
 * Liste ProviderConfig (5 providers V1 : OpenAI, Anthropic, Perplexity,
 * Unsplash, Voyage). Édition inline par row : toggle, modèle, monthly cap.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  listProviders,
  resetProviderSpend,
  updateProvider,
} from "@/server/actions/content-gen/providers";
import { ProvidersV2 } from "./_v2/ProvidersV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function ProvidersSettingsPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listProviders();

  return (
    <ProvidersV2
      rows={rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        role: r.role,
        apiKeyEnvVar: r.apiKeyEnvVar,
        enabled: r.enabled,
        model: r.model,
        monthlyCapUsd: Number(r.monthlyCapUsd),
        rateLimitRpm: r.rateLimitRpm,
        currentMonthSpentUsd: Number(r.currentMonthSpentUsd),
      }))}
    />
  );
}

