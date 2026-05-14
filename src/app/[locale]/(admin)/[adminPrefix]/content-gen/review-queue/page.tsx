/**
 * Content Generator — Review queue list (§ 14).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { approveReview, listReview, rejectReview } from "@/server/actions/content-gen/review";
import type { ReviewStatus } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUSES: ReadonlyArray<ReviewStatus> = ["pending", "approved", "rejected", "needs_edits"];

export default async function ReviewQueuePage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const status = (sp.status as ReviewStatus | undefined) || "pending";
  const rows = await listReview(status);
  const base = `/fr/${adminPrefix}/content-gen/review-queue`;

  async function approve(formData: FormData) {
    "use server";
    await approveReview(String(formData.get("id")));
  }
  async function reject(formData: FormData) {
    "use server";
    await rejectReview(
      String(formData.get("id")),
      String(formData.get("notes") ?? "Rejet sans note"),
    );
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Review queue</h1>
          <p className="admin-meta">
            {rows.length} contenu{rows.length > 1 ? "s" : ""} en statut <code>{status}</code>
          </p>
        </div>
      </div>

      <form className="admin-card admin-filters">
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Statut
            </label>
            <select id="status" name="status" defaultValue={status} className="admin-input">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Filtrer
          </button>
        </div>
      </form>

      <div className="admin-card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Ville</th>
              <th>Quality</th>
              <th>SEO</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>Aucun contenu en revue.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.createdAt.toISOString().slice(0, 16)}</td>
                  <td>{r.jobContentType}</td>
                  <td>{r.jobAnchorVille ?? "—"}</td>
                  <td>{r.jobQualityScore ?? "—"}</td>
                  <td>{r.jobSeoScore ?? "—"}</td>
                  <td>{r.status}</td>
                  <td>
                    <a href={`${base}/${r.id}`} className="admin-button-ghost">
                      Détail
                    </a>{" "}
                    {r.status === "pending" ? (
                      <>
                        <form action={approve} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="admin-button-ghost">
                            ✅ Approuver
                          </button>
                        </form>{" "}
                        <form action={reject} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="notes" value="Rejet rapide via liste" />
                          <button type="submit" className="admin-button-ghost">
                            ❌ Rejeter
                          </button>
                        </form>
                      </>
                    ) : null}
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
