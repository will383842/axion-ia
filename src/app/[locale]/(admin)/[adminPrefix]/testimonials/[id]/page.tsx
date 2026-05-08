// Page admin /testimonials/[id] — edition.

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTestimonialDetailAction } from "@/features/admin-testimonials/actions";
import { TestimonialForm } from "../TestimonialForm";

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

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/testimonials`} className="admin-link admin-back">
            ← Témoignages
          </a>
          <h1 className="admin-h1-large">
            Éditer : {t.firstName} {t.lastName}
          </h1>
          <p className="admin-meta">Mise à jour : {t.updatedAt.toISOString().slice(0, 10)}</p>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <TestimonialForm
          initial={{
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
          }}
        />
      </div>
    </section>
  );
}
