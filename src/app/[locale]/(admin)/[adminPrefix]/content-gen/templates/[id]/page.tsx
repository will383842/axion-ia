/**
 * Content Generator — Template edit (§ 12.1).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { TemplateForm } from "@/components/admin/content-gen/TemplateForm";
import { SubmitButton } from "@/components/admin/content-gen/SubmitButton";
import { enqueueDirectGen } from "@/server/actions/content-gen/enqueue";
import { getTemplate, upsertTemplate } from "@/server/actions/content-gen/templates";
import { TemplatesEditV2 } from "./_v2/TemplatesEditV2";
import type {
  ContentType,
  ExpansionMode,
  SearchIntent,
} from "../../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function EditTemplatePage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const template = await getTemplate(id);
  if (!template) notFound();

  return <TemplatesEditV2 template={template} />;
}

