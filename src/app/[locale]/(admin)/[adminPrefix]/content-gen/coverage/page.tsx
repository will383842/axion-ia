/**
 * Content Generator — Campagnes de couverture list (§ 25).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCampaigns } from "@/server/actions/content-gen/coverage";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import { CoverageListV2 } from "./_v2/CoverageListV2";
import type {
  CoverageStatus,
  ServiceSector,
} from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUSES: ReadonlyArray<CoverageStatus> = [
  "draft",
  "running",
  "paused",
  "completed",
  "cancelled",
];

function sectorLabel(s: ServiceSector | null): string {
  return s ? SERVICE_SECTOR_LABELS[s] : "—";
}

export default async function CoverageListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <CoverageListV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

