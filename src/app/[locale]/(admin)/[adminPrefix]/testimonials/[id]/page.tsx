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

  return (
    <TestimonialEditV2
      adminPrefix={adminPrefix}
      initial={initialPayload}
      title={`${t.firstName} ${t.lastName}`}
      updatedAtIso={t.updatedAt.toISOString().slice(0, 10)}
    />
  );
}
