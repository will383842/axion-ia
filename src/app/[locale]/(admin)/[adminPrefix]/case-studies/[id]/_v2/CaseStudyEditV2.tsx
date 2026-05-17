// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Case study [id] edit V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { CaseStudyForm } from "../../CaseStudyForm";

interface TestimonialOption {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  company: string | null;
}

interface TranslationInitial {
  title: string;
  slug: string;
  problem: string;
  solution: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

interface Initial {
  id: string;
  sector: string;
  companySizeRange: string;
  region: string | null;
  modulesUsed: string[];
  resultsQuantified: Array<{ label: string; value: string | number; unit?: string }>;
  durationWeeks: number | null;
  roiWeeks: number | null;
  testimonialId: string | null;
  status: string;
  publishedAt: Date | null;
  fr: TranslationInitial;
  en: TranslationInitial;
}

interface Props {
  adminPrefix: string;
  testimonials: ReadonlyArray<TestimonialOption>;
  initial: Initial;
  title: string;
  updatedAtIso: string;
}

export function CaseStudyEditV2({
  adminPrefix,
  testimonials,
  initial,
  title,
  updatedAtIso,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={`Éditer : ${title}`}
        description={`Mise à jour : ${updatedAtIso}`}
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Cas concrets", href: `/fr/${adminPrefix}/case-studies` },
              { label: title },
            ]}
          />
        }
      />
      <AdminCard>
        <CaseStudyForm testimonials={testimonials} initial={initial} />
      </AdminCard>
    </AdminPageShell>
  );
}
