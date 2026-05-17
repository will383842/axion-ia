/**
 * Content Generator — Template edit (§ 12.1).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { TemplateForm } from "@/components/admin/content-gen/TemplateForm";
import { SubmitButton } from "@/components/admin/content-gen/SubmitButton";
import { enqueueDirectGen } from "@/server/actions/content-gen/enqueue";
import { getTemplate, upsertTemplate } from "@/server/actions/content-gen/templates";
import { isAdminV2Enabled } from "@/lib/feature-flags";
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

  if (await isAdminV2Enabled()) {
    return <TemplatesEditV2 template={template} />;
  }

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

  // P2-F fix audit 2026-05-15 — bouton "Tester ce template" (§ 12.1 master prompt).
  // Enqueue 1 job de génération qui réutilise ce template (idempotency 60s slot).
  async function testTemplate(formData: FormData) {
    "use server";
    const intent = (formData.get("intent") as SearchIntent | null) ?? "informational";
    const ville = formData.get("ville") ? String(formData.get("ville")).trim() : "";
    await enqueueDirectGen({
      contentType: template!.contentType,
      targetSearchIntent: intent,
      templateId: id,
      ...(ville ? { anchorVilleSlug: ville } : {}),
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

      <div className="admin-card" style={{ marginBottom: "1rem" }}>
        <h2 className="admin-h2">Tester avec ce template</h2>
        <p className="admin-meta">
          Lance 1 job de génération qui réutilise ce template. Anti-doublon 60 s.
        </p>
        <form action={testTemplate} className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="test-intent" className="admin-label">
              Intention
            </label>
            <select
              id="test-intent"
              name="intent"
              defaultValue="informational"
              className="admin-input"
            >
              <option value="informational">informational</option>
              <option value="commercial_investigation">commercial_investigation</option>
              <option value="transactional">transactional</option>
              <option value="navigational">navigational</option>
              <option value="local">local</option>
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="test-ville" className="admin-label">
              Ville (slug, optionnel)
            </label>
            <input
              id="test-ville"
              name="ville"
              type="text"
              placeholder="ex: lyon"
              className="admin-input"
            />
          </div>
          <div className="admin-filters-actions">
            <SubmitButton
              variant="primary"
              pendingLabel="Enqueue…"
              ariaLabel="Lancer un test de ce template"
            >
              Tester avec ce template
            </SubmitButton>
          </div>
        </form>
      </div>

      <TemplateForm initial={template} action={save} />
    </section>
  );
}
