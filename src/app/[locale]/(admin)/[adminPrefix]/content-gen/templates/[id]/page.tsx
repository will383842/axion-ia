/**
 * Content Generator — Template edit (§ 12.1).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { TemplateForm } from "@/components/admin/content-gen/TemplateForm";
import { getTemplate, upsertTemplate } from "@/server/actions/content-gen/templates";
import type { ContentType, ExpansionMode } from "../../../../../../../../prisma/generated/client";

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

  async function save(formData: FormData) {
    "use server";
    const variant = formData.get("variant") ? String(formData.get("variant")) : undefined;
    const description = formData.get("description")
      ? String(formData.get("description"))
      : undefined;
    const defaultModel = formData.get("defaultModel")
      ? String(formData.get("defaultModel"))
      : undefined;
    const defaultTemperature = formData.get("defaultTemperature")
      ? Number(formData.get("defaultTemperature"))
      : undefined;
    const defaultMaxTokens = formData.get("defaultMaxTokens")
      ? Number(formData.get("defaultMaxTokens"))
      : undefined;
    await upsertTemplate({
      id,
      slug: String(formData.get("slug") ?? ""),
      contentType: String(formData.get("contentType")) as ContentType,
      ...(variant ? { variant } : {}),
      name: String(formData.get("name") ?? ""),
      ...(description ? { description } : {}),
      systemPrompt: String(formData.get("systemPrompt") ?? ""),
      userPromptTemplate: String(formData.get("userPromptTemplate") ?? ""),
      outputSchemaZod: String(formData.get("outputSchemaZod") ?? "z.object({})"),
      variables: JSON.parse(String(formData.get("variables") ?? "{}")) as unknown,
      expansionMode: String(formData.get("expansionMode")) as ExpansionMode,
      ...(defaultModel ? { defaultModel } : {}),
      ...(defaultTemperature !== undefined ? { defaultTemperature } : {}),
      ...(defaultMaxTokens !== undefined ? { defaultMaxTokens } : {}),
      isActive: formData.get("isActive") === "on",
    });
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">{template.name}</h1>
          <p className="admin-meta">
            <code>{template.slug}</code> · v{template.version} · {template.contentType}
            {template.variant ? ` · variant ${template.variant}` : null} · Gen{" "}
            {template.generatedItems} / Pub {template.publishedItems} / Fail {template.failedItems}
          </p>
        </div>
      </div>
      <TemplateForm initial={template} action={save} />
    </section>
  );
}
