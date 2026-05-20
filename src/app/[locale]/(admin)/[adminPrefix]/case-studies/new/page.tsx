// Page admin /case-studies/new — creation cas concret.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listCandidateTestimonialsAction } from "@/features/admin-case-studies/actions";
import { CaseStudyForm } from "../CaseStudyForm";
import { CaseStudyNewV2 } from "./_v2/CaseStudyNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewCaseStudyPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const testimonials = await listCandidateTestimonialsAction();

  return <CaseStudyNewV2 adminPrefix={adminPrefix} testimonials={testimonials} />;
}

