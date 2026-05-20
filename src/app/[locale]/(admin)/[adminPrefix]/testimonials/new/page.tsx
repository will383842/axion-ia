// Page admin /testimonials/new — creation.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TestimonialForm } from "../TestimonialForm";
import { TestimonialNewV2 } from "./_v2/TestimonialNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewTestimonialPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <TestimonialNewV2 adminPrefix={adminPrefix} />;
}

