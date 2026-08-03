// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Templates new V2 — AdminPageShell + AdminPageHeader + TemplateNewFormWrapper.
// Sprint correctif SP-01 : error UI (P0-5) + JSON.parse protégé (P0-6).

import { redirect } from "next/navigation";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { TemplateNewFormWrapper } from "@/components/admin/content-gen/TemplateNewFormWrapper";
import { upsertTemplate } from "@/server/actions/content-gen/templates";
import type {
  ContentType,
  ExpansionMode,
} from "../../../../../../../../../prisma/generated/client";

interface Props {
  adminPrefix: string;
}

export function TemplatesNewV2({ adminPrefix }: Props): React.ReactElement {
  async function create(formData: FormData) {
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

    // P0-6 : JSON.parse protégé côté serveur (double protection après validation client)
    let variables: unknown = {};
    try {
      variables = JSON.parse(String(formData.get("variables") ?? "{}"));
    } catch {
      throw new Error('JSON invalide dans le champ "Variables d\'entrée".');
    }

    const id = await upsertTemplate({
      slug: String(formData.get("slug") ?? ""),
      contentType: String(formData.get("contentType")) as ContentType,
      ...(variant ? { variant } : {}),
      name: String(formData.get("name") ?? ""),
      ...(description ? { description } : {}),
      systemPrompt: String(formData.get("systemPrompt") ?? ""),
      userPromptTemplate: String(formData.get("userPromptTemplate") ?? ""),
      outputSchemaZod: String(formData.get("outputSchemaZod") ?? "z.object({})"),
      variables,
      expansionMode: String(formData.get("expansionMode")) as ExpansionMode,
      ...(defaultModel ? { defaultModel } : {}),
      ...(defaultTemperature !== undefined ? { defaultTemperature } : {}),
      ...(defaultMaxTokens !== undefined ? { defaultMaxTokens } : {}),
      isActive: formData.get("isActive") === "on",
    });
    redirect(`/fr/${adminPrefix}/content-gen/templates/${id}`);
  }

  return (
    <AdminPageShell>
      <AdminPageHeader title="Nouvelle instruction IA" />
      <AdminCard>
        <TemplateNewFormWrapper action={create} />
      </AdminCard>
    </AdminPageShell>
  );
}
