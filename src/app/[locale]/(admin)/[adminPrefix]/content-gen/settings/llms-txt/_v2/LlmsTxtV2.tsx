// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// llms.txt V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { updateLlmsTxt } from "@/server/actions/content-gen/policies";

interface Props {
  content: string;
}

export function LlmsTxtV2({ content }: Props): React.ReactElement {
  async function save(formData: FormData) {
    "use server";
    await updateLlmsTxt(String(formData.get("content") ?? ""));
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="llms.txt"
        description="Édition manuelle du fichier servi à /llms.txt (indexation LLM)."
      />

      <AdminCard>
        <form action={save}>
          <div className="admin-field">
            <label htmlFor="content" className="admin-label">
              Contenu (Markdown, max 50 000 caractères)
            </label>
            <textarea
              id="content"
              name="content"
              rows={28}
              className="admin-input font-mono text-[length:var(--text-admin-sm)]"
              defaultValue={content}
              maxLength={50_000}
              required
            />
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              Enregistrer et mettre le fichier en ligne
            </button>
          </div>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
