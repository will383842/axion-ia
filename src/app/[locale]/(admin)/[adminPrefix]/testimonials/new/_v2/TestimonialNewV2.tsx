// Refonte admin mai 2026 — PR 9 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 9).
//
// Testimonial new V2 — AdminPageShell + AdminPageHeader + AdminCard + breadcrumbs.

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminBreadcrumbs,
} from "@/components/admin/ui";
import { TestimonialForm } from "../../TestimonialForm";

interface Props {
  adminPrefix: string;
}

export function TestimonialNewV2({ adminPrefix }: Props): React.ReactElement {
  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau témoignage"
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Témoignages", href: `/fr/${adminPrefix}/testimonials` },
              { label: "Nouveau témoignage" },
            ]}
          />
        }
      />
      <AdminCard>
        <TestimonialForm />
      </AdminCard>
    </AdminPageShell>
  );
}
