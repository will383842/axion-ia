/**
 * Content Generator — Settings llms.txt (§ 9bis indexation perfection 2026).
 *
 * Édition manuelle du fichier servi à `/llms.txt`. La route Next 16
 * (`src/app/llms.txt/route.ts`) lit ContentGenConfig.key="llms_txt" et fallback
 * sur le default codé. Sprint 5 ajoute génération auto (`enrichi`).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLlmsTxt, updateLlmsTxt } from "@/server/actions/content-gen/policies";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function LlmsTxtPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const content = await getLlmsTxt();

  async function save(formData: FormData) {
    "use server";
    await updateLlmsTxt(String(formData.get("content") ?? ""));
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">llms.txt</h1>
          <p className="admin-meta">
            Édition manuelle du fichier servi à <code>/llms.txt</code> (indexation LLM).
          </p>
        </div>
      </div>

      <form action={save} className="admin-card">
        <div className="admin-field">
          <label htmlFor="content" className="admin-label">
            Contenu (Markdown, max 50 000 caractères)
          </label>
          <textarea
            id="content"
            name="content"
            rows={28}
            className="admin-input"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
            defaultValue={content}
            maxLength={50_000}
            required
          />
        </div>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Enregistrer + revalidate /llms.txt
          </button>
        </div>
      </form>
    </section>
  );
}
