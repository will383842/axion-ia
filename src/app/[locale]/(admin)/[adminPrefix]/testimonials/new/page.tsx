// Page admin /testimonials/new — creation.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TestimonialForm } from "../TestimonialForm";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { TestimonialNewV2 } from "./_v2/TestimonialNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewTestimonialPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  if (await isAdminV2Enabled()) {
    return <TestimonialNewV2 adminPrefix={adminPrefix} />;
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/testimonials`} className="admin-link admin-back">
            ← Témoignages
          </a>
          <h1 className="admin-h1-large">Nouveau témoignage</h1>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <TestimonialForm />
      </div>
    </section>
  );
}
