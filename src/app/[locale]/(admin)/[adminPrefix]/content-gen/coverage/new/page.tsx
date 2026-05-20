/**
 * Content Generator — Coverage campaign create (§ 25.2).
 *
 * V1 form simplifié : nom + scope + slugs (CSV) + total cible + distributions
 * JSON. Le launch immédiat ou en draft est laissé à l'admin via boutons distincts.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createCampaign,
  estimateCampaign,
  launchCampaign,
  type EstimateCampaignResult,
} from "@/server/actions/content-gen/coverage";
import {
  listAudienceMixProfiles,
  listDistributionProfiles,
} from "@/server/actions/content-gen/distribution";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import { CoverageNewV2 } from "./_v2/CoverageNewV2";
import type {
  CoverageScope,
  ServiceSector,
} from "../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ dryRun?: string }>;
}

const SCOPES: ReadonlyArray<CoverageScope> = ["ville", "departement", "region", "multi"];

// § 25.3 — Distribution éditoriale uniquement. `landing_ville` et `blog_from_rss`
// ont leurs propres pipelines (coverage villes / RSS worker).
const DEFAULT_TYPE_DIST = `{
  "blog_from_title": 30,
  "blog_from_keywords": 25,
  "comparison": 20,
  "guide_pilier": 15,
  "faq_standalone": 10
}`;
const DEFAULT_AUDIENCE_MIX = `{
  "TPE:entreprise_privee": 25,
  "PME:entreprise_privee": 40,
  "ETI:entreprise_privee": 20,
  "GE:entreprise_privee": 10,
  "PME:secteur_public": 5
}`;

function decodeDryRun(raw: string | undefined): EstimateCampaignResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as EstimateCampaignResult;
  } catch {
    return null;
  }
}

export default async function NewCampaignPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <CoverageNewV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

