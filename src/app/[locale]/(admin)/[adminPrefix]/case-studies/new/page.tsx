// Page admin /case-studies/new — creation cas concret.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCandidateTestimonialsAction } from "@/features/admin-case-studies/actions";
import { CaseStudyForm } from "../CaseStudyForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewCaseStudyPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const testimonials = await listCandidateTestimonialsAction();

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <a href={`/fr/${adminPrefix}/case-studies`} className="admin-link admin-back">
            ← Cas concrets
          </a>
          <h1 className="admin-h1-large">Nouveau cas concret</h1>
        </div>
      </div>
      <div className="admin-card admin-card-wide">
        <CaseStudyForm testimonials={testimonials} />
      </div>
    </section>
  );
}
