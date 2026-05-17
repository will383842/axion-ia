// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Testimonial [id] edit V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { TestimonialForm } from "../../TestimonialForm";

interface Initial {
  id: string;
  slug: string;
  status: string;
  firstName: string;
  lastName: string;
  role: string | null;
  company: string | null;
  sector: string | null;
  companySize: string | null;
  shortQuoteFr: string;
  shortQuoteEn: string;
  fullQuoteFr: string | null;
  fullQuoteEn: string | null;
  rating: number | null;
  photoUrl: string | null;
  videoUrl: string | null;
  module: string | null;
  resultHighlight: string | null;
  displayOrder: number;
}

interface Props {
  adminPrefix: string;
  initial: Initial;
  title: string;
  updatedAtIso: string;
}

export function TestimonialEditV2({
  adminPrefix,
  initial,
  title,
  updatedAtIso,
}: Props): React.ReactElement {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title={`Éditer : ${title}`}
        description={`Mise à jour : ${updatedAtIso}`}
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Témoignages", href: `/fr/${adminPrefix}/testimonials` },
              { label: title },
            ]}
          />
        }
      />
      <AdminCard>
        <TestimonialForm initial={initial} />
      </AdminCard>
    </AdminPageShell>
  );
}
