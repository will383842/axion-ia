/**
 * Content Generator — Review queue detail (§ 14.1).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { approveReview, promoteToTier1, rejectReview } from "@/server/actions/content-gen/review";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const review = await prisma.reviewQueue.findUnique({
    where: { id },
    include: { job: true },
  });
  if (!review) notFound();

  async function approve(formData: FormData) {
    "use server";
    await approveReview(id, formData.get("notes") ? String(formData.get("notes")) : undefined);
  }
  async function reject(formData: FormData) {
    "use server";
    await rejectReview(id, String(formData.get("notes") ?? ""));
  }
  async function promote() {
    "use server";
    await promoteToTier1(id);
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">
            Review · {review.job.contentType}
            {review.job.anchorVilleSlug ? ` · ${review.job.anchorVilleSlug}` : ""}
          </h1>
          <p className="admin-meta">
            Job <code>{review.jobId.slice(0, 12)}…</code> · statut review{" "}
            <strong>{review.status}</strong> · quality {review.job.qualityScore ?? "—"} · SEO{" "}
            {review.job.seoScore ?? "—"}
          </p>
        </div>
      </div>

      <div className="admin-card">
        <h2>Aperçu (texte brut)</h2>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, maxHeight: 400, overflow: "auto" }}>
          {JSON.stringify(review.job.outputJsonRaw ?? {}, null, 2)}
        </pre>
      </div>

      <div className="admin-card">
        <h2>Actions de revue</h2>

        <form action={approve} style={{ marginBottom: 24 }}>
          <div className="admin-field">
            <label htmlFor="approve-notes" className="admin-label">
              Notes d&apos;approbation (optionnelles)
            </label>
            <input id="approve-notes" name="notes" className="admin-input" />
          </div>
          <button type="submit" className="admin-button">
            ✅ Approuver (tier-2)
          </button>
        </form>

        <form action={promote} style={{ marginBottom: 24 }}>
          <p className="admin-meta">
            Approve + promote tier-1 indexable immédiat (worker content-publish-worker Sprint 4 wiré
            pour la publication effective). L&apos;article devient indexable une fois publié.
          </p>
          <button type="submit" className="admin-button">
            🚀 Promouvoir tier-1
          </button>
        </form>

        <form action={reject}>
          <div className="admin-field">
            <label htmlFor="reject-notes" className="admin-label">
              Notes de rejet (min 5 caractères)
            </label>
            <textarea
              id="reject-notes"
              name="notes"
              rows={4}
              minLength={5}
              required
              className="admin-input"
            />
          </div>
          <button type="submit" className="admin-button-ghost">
            ❌ Rejeter
          </button>
        </form>
      </div>
    </section>
  );
}
