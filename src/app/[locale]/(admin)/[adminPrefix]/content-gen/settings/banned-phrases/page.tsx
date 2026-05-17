/**
 * Content Generator — Settings banned phrases (§ 21 doctrine).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createBannedPhrase,
  deleteBannedPhrase,
  listBannedPhrases,
  toggleBannedPhrase,
} from "@/server/actions/content-gen/banned-phrases";
import { isAdminV2Enabled } from "@/lib/feature-flags";
import { BannedPhrasesV2 } from "./_v2/BannedPhrasesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function BannedPhrasesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const rows = await listBannedPhrases();

  if (await isAdminV2Enabled()) {
    return <BannedPhrasesV2 rows={rows} />;
  }

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
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Phrases interdites</h1>
          <p className="admin-meta">
            {rows.length} phrase{rows.length > 1 ? "s" : ""} — doctrine éditoriale (§ 21).
          </p>
        </div>
      </div>

      <form action={create} className="admin-card">
        <h2>Ajouter</h2>
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

      <div className="admin-card admin-table-wrapper">
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
                <td colSpan={5}>Aucune phrase interdite — bonne nouvelle.</td>
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
                    <form action={toggle} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                      <button type="submit" className="admin-button-ghost">
                        {r.isActive ? "Désactiver" : "Activer"}
                      </button>
                    </form>{" "}
                    <form action={remove} style={{ display: "inline" }}>
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
    </section>
  );
}
