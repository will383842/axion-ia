/**
 * Content Generator — Review queue detail (§ 14.1).
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  approveReview,
  promoteToTier1,
  rejectReview,
  requestEdits,
} from "@/server/actions/content-gen/review";
import { createPreviewToken } from "@/server/content-gen/shared/preview-token";

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
  async function askEdits(formData: FormData) {
    "use server";
    await requestEdits(id, String(formData.get("comment") ?? ""));
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
        <h2>Aperçu rendu (iframe sandbox, token signé 10 min)</h2>
        {review.job.outputJsonRaw ? (
          <iframe
            // P1-13 fix audit opérationnel 2026-05-14 — preview HTML rendu
            // via route signée /api/content-gen/preview/[jobId]?t=<token>.
            // Le token HMAC-SHA256 expire 10 min (anti-leak).
            src={`/api/content-gen/preview/${review.jobId}?t=${createPreviewToken(review.jobId)}`}
            sandbox="allow-same-origin"
            title="Aperçu contenu"
            style={{
              width: "100%",
              height: 600,
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 4,
              background: "var(--color-paper, white)",
            }}
          />
        ) : (
          <p className="admin-meta">Output non disponible (job pas encore complété).</p>
        )}
      </div>

      <details className="admin-card">
        <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
          Voir le JSON brut (debug)
        </summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 300, overflow: "auto" }}>
          {JSON.stringify(review.job.outputJsonRaw ?? {}, null, 2)}
        </pre>
      </details>

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

        <form action={askEdits} style={{ marginBottom: 24 }}>
          <div className="admin-field">
            <label htmlFor="edits-comment" className="admin-label">
              Demander des modifications (min 10 caractères) — guidance LLM
            </label>
            <textarea
              id="edits-comment"
              name="comment"
              rows={4}
              minLength={10}
              maxLength={5000}
              required
              className="admin-input"
              placeholder="Ex. « Réécrire la section H2 #2 en restant AxionIA-centric, ajouter 200 mots sur l'intervention Essentielle. »"
            />
          </div>
          <button type="submit" className="admin-button-ghost">
            ✏️ Demander des modifs (re-prompt LLM)
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
