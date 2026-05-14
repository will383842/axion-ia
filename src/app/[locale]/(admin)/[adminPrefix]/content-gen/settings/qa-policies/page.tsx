/**
 * Content Generator — Settings Q/R post-process (§ 29 v1.7).
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getQaPolicies, updateQaPolicies } from "@/server/actions/content-gen/policies";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function QaPoliciesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const cfg = await getQaPolicies();

  async function save(formData: FormData) {
    "use server";
    await updateQaPolicies({
      autoCreatePages: formData.get("autoCreatePages") === "on",
      minWordsPerAnswer: Number(formData.get("minWordsPerAnswer") ?? 0),
      promoteTier1MinCtr: Number(formData.get("promoteTier1MinCtr") ?? 0),
    });
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Q/R post-process</h1>
          <p className="admin-meta">
            Auto-extraction Q/R + pages indexables. § 29 master prompt v1.7.
          </p>
        </div>
      </div>

      <form action={save} className="admin-card">
        <div className="admin-field">
          <label className="admin-label">
            <input type="checkbox" name="autoCreatePages" defaultChecked={cfg.autoCreatePages} />{" "}
            Auto-create pages Q/R indexables après chaque génération
          </label>
        </div>
        <div className="admin-filters-grid">
          <div className="admin-field">
            <label htmlFor="minWordsPerAnswer" className="admin-label">
              Min mots par réponse
            </label>
            <input
              id="minWordsPerAnswer"
              name="minWordsPerAnswer"
              type="number"
              min="10"
              max="500"
              defaultValue={cfg.minWordsPerAnswer}
              className="admin-input"
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="promoteTier1MinCtr" className="admin-label">
              CTR seuil promotion tier-1 (%)
            </label>
            <input
              id="promoteTier1MinCtr"
              name="promoteTier1MinCtr"
              type="number"
              step="0.1"
              min="0"
              max="20"
              defaultValue={cfg.promoteTier1MinCtr}
              className="admin-input"
              required
            />
          </div>
        </div>
        <div className="admin-filters-actions">
          <button type="submit" className="admin-button">
            Enregistrer
          </button>
        </div>
      </form>
    </section>
  );
}
