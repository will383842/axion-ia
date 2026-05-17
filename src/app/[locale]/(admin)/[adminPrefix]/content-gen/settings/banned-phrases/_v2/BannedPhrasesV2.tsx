// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Banned phrases V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  createBannedPhrase,
  deleteBannedPhrase,
  toggleBannedPhrase,
} from "@/server/actions/content-gen/banned-phrases";

interface PhraseRow {
  id: string;
  pattern: string;
  severity: string;
  reason: string | null;
  isActive: boolean;
}

interface Props {
  rows: ReadonlyArray<PhraseRow>;
}

export function BannedPhrasesV2({ rows }: Props): React.ReactElement {
  async function create(formData: FormData) {
    "use server";
    const reason = formData.get("reason") ? String(formData.get("reason")) : undefined;
    await createBannedPhrase({
      pattern: String(formData.get("pattern") ?? ""),
      ...(reason ? { reason } : {}),
      severity: String(formData.get("severity") ?? "warn"),
    });
  }

  async function toggle(formData: FormData) {
    "use server";
    await toggleBannedPhrase(String(formData.get("id")), formData.get("isActive") === "true");
  }

  async function remove(formData: FormData) {
    "use server";
    await deleteBannedPhrase(String(formData.get("id")));
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Phrases interdites"
        description={`${rows.length} phrase${rows.length > 1 ? "s" : ""} — doctrine éditoriale (§ 21).`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <form action={create}>
          <h2 className="admin-h2">Ajouter</h2>
          <div className="admin-filters-grid">
            <div className="admin-field">
              <label htmlFor="pattern" className="admin-label">
                Pattern (texte ou regex)
              </label>
              <input
                id="pattern"
                name="pattern"
                required
                minLength={2}
                maxLength={200}
                className="admin-input"
                placeholder='ex. "le meilleur"'
              />
            </div>
            <div className="admin-field">
              <label htmlFor="reason" className="admin-label">
                Raison (optionnelle)
              </label>
              <input id="reason" name="reason" className="admin-input" />
            </div>
            <div className="admin-field">
              <label htmlFor="severity" className="admin-label">
                Sévérité
              </label>
              <select id="severity" name="severity" className="admin-input" defaultValue="warn">
                <option value="warn">warn (log seulement)</option>
                <option value="block">block (rejet doctrine-check)</option>
              </select>
            </div>
          </div>
          <div className="admin-filters-actions">
            <button type="submit" className="admin-button">
              + Ajouter
            </button>
          </div>
        </form>
      </AdminCard>

      <AdminCard variant="compact">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Sévérité</th>
                <th>Raison</th>
                <th>Actif</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    Aucune phrase interdite — bonne nouvelle.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.pattern}</code>
                    </td>
                    <td>{r.severity}</td>
                    <td>{r.reason ?? "—"}</td>
                    <td>{r.isActive ? "✅" : "🚫"}</td>
                    <td>
                      <form action={toggle} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={r.isActive ? "false" : "true"}
                        />
                        <button type="submit" className="admin-button-ghost">
                          {r.isActive ? "Désactiver" : "Activer"}
                        </button>
                      </form>{" "}
                      <form action={remove} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="admin-button-ghost">
                          Supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
