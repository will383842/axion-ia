/**
 * Content Generator — Jobs list (§ 12.1).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listJobs, retryAllFailed } from "@/server/actions/content-gen/jobs";
import { listTemplates } from "@/server/actions/content-gen/templates";
import {
  SERVICE_SECTOR_LABELS,
  SERVICE_SECTORS,
} from "@/server/content-gen/shared/editorial-mix-rules";
import { JobsListV2 } from "./_v2/JobsListV2";
import type {
  ContentGenJobStatus,
  ContentType,
  ServiceSector,
} from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

// 8 statuts effectivement écrits par les workers V1.0.2 (cf. audit
// opérationnel 2026-05-14 § 2.1). Les 4 orphelins (`generating_text`,
// `generating_image`, `running_qa`, `approved`) restent dans l'enum Prisma
// pour compatibilité V1.5+ mais sont retirés du sélecteur UI pour éviter
// de présenter des filtres qui retournent toujours 0 lignes.
const STATUSES: ReadonlyArray<ContentGenJobStatus> = [
  "queued",
  "running",
  "quality_improving",
  "needs_review",
  "publishing",
  "published",
  "failed",
  "cancelled",
];

const TYPES: ReadonlyArray<ContentType> = [
  "landing_ville",
  "blog_article",
  "blog_from_title",
  "blog_from_keywords",
  "blog_from_rss",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
];

export default async function JobsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <JobsListV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

