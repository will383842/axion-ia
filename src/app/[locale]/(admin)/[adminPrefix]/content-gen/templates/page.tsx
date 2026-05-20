/**
 * Content Generator — Templates list (§ 12.1).
 *
 * Affiche tous les ContentTemplate (9 ContentType × N variantes). Filtre par
 * contentType + isActive. Toggle on/off inline.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listTemplates, toggleTemplate } from "@/server/actions/content-gen/templates";
import { TemplatesListV2 } from "./_v2/TemplatesListV2";
import type { ContentType } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const CONTENT_TYPES: ReadonlyArray<ContentType> = [
  "landing_ville",
  "blog_article",
  "blog_from_title",
  "blog_from_keywords",
  "blog_from_rss",
  "comparison",
  "guide_pilier",
  "qa_derived",
  "faq_standalone",
] satisfies ReadonlyArray<ContentType>;

export default async function TemplatesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <TemplatesListV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

