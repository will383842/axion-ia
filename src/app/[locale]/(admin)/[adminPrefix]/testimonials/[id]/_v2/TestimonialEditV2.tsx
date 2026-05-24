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
import { MarkAsRealForm } from "./MarkAsRealForm";

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

export interface RealMetaPayload {
  source: string;
  consentDate: string;
  verifiedBy?: string;
}

interface Props {
  adminPrefix: string;
  initial: Initial;
  title: string;
  updatedAtIso: string;
  /**
   * Sprint v7 Phase 15 (F5) : metadata "real testimonial" courante (null si
   * le testimonial n'a jamais été marqué authentifié).
   */
  realMeta: RealMetaPayload | null;
}

export function TestimonialEditV2({
  adminPrefix,
  initial,
  title,
  updatedAtIso,
  realMeta,
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

      {/* Sprint v7 Phase 15 (F5) — wiring UI MVP `markAsRealTestimonial`.
          Distinct du form principal : la doctrine v2.1 sépare "métadonnées
          publiables" (TestimonialForm) de "métadonnées de vérification RGPD"
          (MarkAsRealForm) — un testimonial peut être publié sans être
          authentifié, mais SEULS les authentifiés apparaîssent sur /presse. */}
      <AdminCard className="mt-[var(--space-admin-5)]">
        <div className="admin-section-title">
          <h2>Authentification (Real Testimonial)</h2>
          <p className="admin-meta-small">
            {realMeta
              ? "Ce témoignage est marqué comme authentifié — il apparaît dans la section « Témoignages vérifiés » sur /presse."
              : "Marquez ce témoignage comme authentifié pour le faire apparaître dans la section « Témoignages vérifiés » sur /presse. Requiert une source vérifiable + consentement RGPD signé hors-app."}
          </p>
        </div>
        <MarkAsRealForm testimonialId={initial.id} currentRealMeta={realMeta} />
      </AdminCard>
    </AdminPageShell>
  );
}
