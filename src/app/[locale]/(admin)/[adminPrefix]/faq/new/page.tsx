// Page admin /faq/new — creation FAQ.

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FAQForm } from "../FAQForm";
import { FaqNewV2 } from "./_v2/FaqNewV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function NewFAQPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <FaqNewV2 adminPrefix={adminPrefix} />;
}

