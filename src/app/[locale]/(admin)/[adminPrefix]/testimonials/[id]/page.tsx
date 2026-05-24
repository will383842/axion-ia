// Page admin /testimonials/[id] — edition.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTestimonialDetailAction } from "@/features/admin-testimonials/actions";
import { TestimonialEditV2 } from "./_v2/TestimonialEditV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

export default async function EditTestimonialPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  const t = await getTestimonialDetailAction(id);
  if (!t) notFound();

  const initialPayload = {
    id: t.id,
    slug: t.slug,
    status: t.status,
    firstName: t.firstName,
    lastName: t.lastName,
    role: t.role,
    company: t.company,
    sector: t.sector,
    companySize: t.companySize,
    shortQuoteFr: t.shortQuoteFr,
    shortQuoteEn: t.shortQuoteEn,
    fullQuoteFr: t.fullQuoteFr,
    fullQuoteEn: t.fullQuoteEn,
    rating: t.rating,
    photoUrl: t.photoUrl,
    videoUrl: t.videoUrl,
    module: t.module,
    resultHighlight: t.resultHighlight,
    displayOrder: t.displayOrder,
  };

  // Sprint v7 Phase 15 (F5) : extraction du `realMeta` depuis `displayPages`
  // JSON (cf. `markAsRealTestimonial` qui le stocke sous cette clé).
  const displayPagesObj =
    typeof t.displayPages === "object" && t.displayPages !== null
      ? (t.displayPages as Record<string, unknown>)
      : {};
  const rawRealMeta = displayPagesObj["realMeta"] as
    | { isReal?: boolean; source?: string; consentDate?: string; verifiedBy?: string }
    | undefined;
  const realMeta =
    rawRealMeta?.isReal === true &&
    typeof rawRealMeta.source === "string" &&
    typeof rawRealMeta.consentDate === "string"
      ? {
          source: rawRealMeta.source,
          consentDate: rawRealMeta.consentDate,
          ...(typeof rawRealMeta.verifiedBy === "string"
            ? { verifiedBy: rawRealMeta.verifiedBy }
            : {}),
        }
      : null;

  return (
    <TestimonialEditV2
      adminPrefix={adminPrefix}
      initial={initialPayload}
      title={`${t.firstName} ${t.lastName}`}
      updatedAtIso={t.updatedAt.toISOString().slice(0, 10)}
      realMeta={realMeta}
    />
  );
}
