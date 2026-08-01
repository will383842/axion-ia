// Page admin /case-studies/[id] — edition.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCaseStudyDetailAction } from "@/features/admin-case-studies/actions";
import { CaseStudyEditV2 } from "./_v2/CaseStudyEditV2";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/server/content-gen/shared/format-date-fr";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function EditCaseStudyPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cs = await getCaseStudyDetailAction(id);
  if (!cs) notFound();

  const fr = cs.translations.find((t) => t.locale === "fr");
  const en = cs.translations.find((t) => t.locale === "en");

  const initialPayload = {
    id: cs.id,
    sector: cs.sector,
    companySizeRange: cs.companySizeRange,
    region: cs.region,
    modulesUsed: (cs.modulesUsed as string[]) ?? [],
    resultsQuantified:
      (cs.resultsQuantified as Array<{
        label: string;
        value: string | number;
        unit?: string;
      }>) ?? [],
    durationWeeks: cs.durationWeeks,
    roiWeeks: cs.roiWeeks,
    status: cs.status,
    publishedAt: cs.publishedAt,
    fr: {
      title: fr?.title ?? "",
      slug: fr?.slug ?? "",
      problem: fr?.problem ?? "",
      solution: fr?.solution ?? "",
      metaTitle: fr?.metaTitle ?? null,
      metaDescription: fr?.metaDescription ?? null,
    },
    en: {
      title: en?.title ?? "",
      slug: en?.slug ?? "",
      problem: en?.problem ?? "",
      solution: en?.solution ?? "",
      metaTitle: en?.metaTitle ?? null,
      metaDescription: en?.metaDescription ?? null,
    },
  };

  return (
    <CaseStudyEditV2
      adminPrefix={adminPrefix}
      initial={initialPayload}
      title={fr?.title ?? "(sans titre)"}
      updatedAtIso={formatDateFrShort(cs.updatedAt)}
    />
  );
}
