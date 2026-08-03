// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
//
// Banned phrases V2 — AdminPageShell + AdminPageHeader + AdminCard.
// Track 2 migration (juin 2026) : table `.admin-table` → <AdminTable>.
// Les deux formes inline (toggle/suppression) par ligne → rowAction
// (server actions préservées verbatim). Pas de badge (sévérité = texte brut).

import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminEtatBooleen,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
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

  const columns: ReadonlyArray<AdminTableColumn<PhraseRow>> = [
    { key: "pattern", header: "Expression", cell: (r) => <code>{r.pattern}</code> },
    { key: "severity", header: "Sévérité", cell: (r) => r.severity },
    { key: "reason", header: "Raison", cell: (r) => r.reason ?? "—" },
    {
      key: "isActive",
      header: "Actif",
      cell: (r) => (
        <AdminEtatBooleen actif={r.isActive} libelles={{ vrai: "Actif", faux: "Inactif" }} />
      ),
    },
  ];

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
                Expression (texte ou expression régulière)
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
                <option value="warn">Avertir (journalisé seulement)</option>
                <option value="block">Bloquer la publication</option>
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

      {rows.length === 0 ? (
        <AdminEmptyState title="Aucune phrase interdite — bonne nouvelle." />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          caption="Liste des phrases interdites"
          rowAction={(r) => (
            <>
              <form action={toggle} className="inline">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
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
            </>
          )}
        />
      )}
    </AdminPageShell>
  );
}
