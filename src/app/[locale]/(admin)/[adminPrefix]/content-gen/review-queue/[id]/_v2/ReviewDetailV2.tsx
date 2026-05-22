// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// P0-2 Sprint P5 — QualityIterationsBadge + qualityImprovementAttempts field.
// P5.5 — ArticleFeedback thumbs up/down (D-P5-8, V5-08 correction).

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import {
  approveReview,
  promoteToTier1,
  rejectReview,
  requestEdits,
} from "@/server/actions/content-gen/review";
import { createPreviewToken } from "@/server/content-gen/shared/preview-token";

interface ReviewData {
  id: string;
  jobId: string;
  status: string;
  job: {
    contentType: string;
    anchorVilleSlug: string | null;
    qualityScore: number | null;
    seoScore: number | null;
    outputJsonRaw: unknown;
    qualityImprovementAttempts: number;
    outputBlogPostId?: string | null;
  };
}

interface Props {
  review: ReviewData;
}

function QualityIterationsBadge({ attempts }: { attempts: number }): React.ReactElement {
  const color =
    attempts === 0
      ? "var(--color-admin-success)"
      : attempts === 1
        ? "var(--color-admin-warning)"
        : "var(--color-admin-danger)";
  return (
    <span
      style={{ color, fontWeight: 600 }}
      title={`${attempts} itération${attempts > 1 ? "s" : ""} qualité boucle LLM`}
    >
      {attempts}x
    </span>
  );
}

export function ReviewDetailV2({ review }: Props): React.ReactElement {
  const id = review.id;
  const articleId = review.job.outputBlogPostId ?? null;

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
  async function submitFeedback(formData: FormData) {
    "use server";
    if (!articleId) return;
    const session = await auth();
    if (!session?.user?.email) return;
    const type = formData.get("type") as string;
    if (type !== "up" && type !== "down") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).articleFeedback.create({
      data: {
        articleId,
        userId: session.user.email,
        type,
        comment: null,
      },
    });
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`Review · ${review.job.contentType}${review.job.anchorVilleSlug ? ` · ${review.job.anchorVilleSlug}` : ""}`}
        description={`Job ${review.jobId.slice(0, 12)}… · statut review ${review.status} · quality ${review.job.qualityScore ?? "—"} · SEO ${review.job.seoScore ?? "—"}`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Aperçu rendu (iframe sandbox, token signé 10 min)</h2>
        <p className="admin-meta-block">
          Itérations boucle qualité :{" "}
          <QualityIterationsBadge attempts={review.job.qualityImprovementAttempts} />
        </p>
        {review.job.outputJsonRaw ? (
          <iframe
            src={`/api/content-gen/preview/${review.jobId}?t=${createPreviewToken(review.jobId)}`}
            sandbox="allow-same-origin"
            title="Aperçu contenu"
            className="h-[600px] w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]"
          />
        ) : (
          <p className="admin-meta">Output non disponible (job pas encore complété).</p>
        )}
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <details>
          <summary className="cursor-pointer font-bold">Voir le JSON brut (debug)</summary>
          <pre className="mt-[var(--space-admin-3)] max-h-[300px] overflow-auto text-[length:var(--text-admin-xs)] whitespace-pre-wrap">
            {JSON.stringify(review.job.outputJsonRaw ?? {}, null, 2)}
          </pre>
        </details>
      </AdminCard>

      {articleId && (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <h2 className="admin-h2">Feedback éditorial</h2>
          <p className="admin-meta-block">
            Donnez un retour rapide sur la qualité globale de cet article pour améliorer les futures
            générations.
          </p>
          <div className="flex gap-[var(--space-admin-4)]">
            <form action={submitFeedback}>
              <input type="hidden" name="type" value="up" />
              <button
                type="submit"
                className="admin-button"
                aria-label="Feedback positif — article de bonne qualité"
                title="Bon article"
              >
                👍 Bon
              </button>
            </form>
            <form action={submitFeedback}>
              <input type="hidden" name="type" value="down" />
              <button
                type="submit"
                className="admin-button-ghost"
                aria-label="Feedback négatif — article à améliorer"
                title="À améliorer"
              >
                👎 À améliorer
              </button>
            </form>
          </div>
        </AdminCard>
      )}

      <AdminCard>
        <h2 className="admin-h2">Actions de revue</h2>

        <form action={approve} className="mb-[var(--space-admin-6)]">
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

        <form action={promote} className="mb-[var(--space-admin-6)]">
          <p className="admin-meta-block">
            Approve + promote tier-1 indexable immédiat (worker content-publish-worker Sprint 4 wiré
            pour la publication effective). L&apos;article devient indexable une fois publié.
          </p>
          <button type="submit" className="admin-button">
            🚀 Promouvoir tier-1
          </button>
        </form>

        <form action={askEdits} className="mb-[var(--space-admin-6)]">
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
      </AdminCard>
    </AdminPageShell>
  );
}
