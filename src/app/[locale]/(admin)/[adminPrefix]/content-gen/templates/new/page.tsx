/**
 * Content Generator — Templates create (§ 12.1).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TemplateForm } from "@/components/admin/content-gen/TemplateForm";
import { upsertTemplate } from "@/server/actions/content-gen/templates";
import { TemplatesNewV2 } from "./_v2/TemplatesNewV2";
import type { ContentType, ExpansionMode } from "../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function NewTemplatePage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <TemplatesNewV2 adminPrefix={adminPrefix} />;
}

