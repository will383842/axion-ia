// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Templates edit V2 — AdminPageShell + AdminPageHeader + TemplateForm intact.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { TemplateForm } from "@/components/admin/content-gen/TemplateForm";
import { SubmitButton } from "@/components/admin/content-gen/SubmitButton";
import {
  libelleInstructionIA,
  libelleTypeContenu,
} from "@/components/admin/content-gen/template-labels";
import { enqueueDirectGen } from "@/server/actions/content-gen/enqueue";
import { upsertTemplate } from "@/server/actions/content-gen/templates";
import type {
  ContentType,
  ExpansionMode,
  SearchIntent,
} from "../../../../../../../../../prisma/generated/client";

interface TemplateData {
  id: string;
  slug: string;
  name: string;
  version: number;
  contentType: ContentType;
  variant: string | null;
  description: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchemaZod: string;
  variables: unknown;
  expansionMode: ExpansionMode;
  defaultModel: string | null;
  defaultTemperature: string | null;
  defaultMaxTokens: number | null;
  isActive: boolean;
  generatedItems: number;
  publishedItems: number;
  failedItems: number;
}

interface Props {
  template: TemplateData;
}

export function TemplatesEditV2({ template }: Props): React.ReactElement {
  const id = template.id;

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

  async function testTemplate(formData: FormData) {
    "use server";
    const intent = (formData.get("intent") as SearchIntent | null) ?? "informational";
    const ville = formData.get("ville") ? String(formData.get("ville")).trim() : "";
    await enqueueDirectGen({
      contentType: template.contentType,
      targetSearchIntent: intent,
      templateId: id,
      ...(ville ? { anchorVilleSlug: ville } : {}),
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={libelleInstructionIA(template.slug, template.name)}
        /* 🔴 Cette ligne, sous le titre de la page, disait :
           « blog-from-rss-v1 · v1 · blog_from_rss · Gen 12 / Pub 3 / Fail 2 ».
           Le type de contenu en valeur d'enum brute, « variant » en anglais,
           et trois compteurs abrégés dont « Fail » — le plus important des
           trois — était le moins lisible. */
        description={`${template.slug} · v${template.version} · ${libelleTypeContenu(template.contentType)}${template.variant ? ` · variante ${template.variant}` : ""} · ${template.generatedItems} généré${template.generatedItems > 1 ? "s" : ""} · ${template.publishedItems} publié${template.publishedItems > 1 ? "s" : ""} · ${template.failedItems} en échec`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Tester avec cette instruction</h2>
        <p className="admin-meta-block">
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
              {/* B5 (CONTENT-GEN-UX 2026) — toutes les valeurs de l'enum Prisma
                  SearchIntent (8), libellés FR clairs. Avant : seuls 5 intents,
                  dont `commercial_investigation` que la validation Zod rejetait. */}
              <option value="informational">Informationnelle</option>
              <option value="commercial_investigation">Comparaison / avant-achat</option>
              <option value="transactional">Transactionnelle</option>
              <option value="navigational">Navigationnelle</option>
              <option value="local">Locale (ville)</option>
              <option value="voice_search">Recherche vocale</option>
              <option value="ai_overview">Aperçu IA (Google AI Overview)</option>
              <option value="featured_snippet">Extrait optimisé (position 0)</option>
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
              pendingLabel="Mise en file…"
              ariaLabel="Lancer un test de cette instruction IA"
            >
              Tester avec cette instruction
            </SubmitButton>
          </div>
        </form>
      </AdminCard>

      <AdminCard>
        <TemplateForm initial={template} action={save} />
      </AdminCard>
    </AdminPageShell>
  );
}
