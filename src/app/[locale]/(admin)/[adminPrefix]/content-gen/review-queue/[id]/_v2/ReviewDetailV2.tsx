// Refonte admin mai 2026 — PR 7 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 7).
// P0-2 Sprint P5 — QualityIterationsBadge + qualityImprovementAttempts field.
// P5.5 — ArticleFeedback thumbs up/down (D-P5-8, V5-08 correction).
// SP-04 P0-11 UI — boutons feedback disabled après vote (lecture serveur).
// SP-04 P0-13 — section Historique de décision (4 champs DB reviewedBy/reviewNotes/reviewedAt/promotedToTier1At).

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
import {
  REVIEW_STATUS_LABELS_FR,
  contentTypeLabelFr,
} from "@/server/content-gen/shared/admin-labels";

interface ReviewData {
  id: string;
  jobId: string;
  status: string;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: Date | null;
  promotedToTier1At?: Date | null;
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
      title={`${attempts} passage${attempts > 1 ? "s" : ""} d'amélioration qualité par l'IA`}
    >
      {attempts}x
    </span>
  );
}

export async function ReviewDetailV2({ review }: Props): Promise<React.ReactElement> {
  const id = review.id;
  const articleId = review.job.outputBlogPostId ?? null;

  // P0-11 UI — vérifier si un feedback a déjà été soumis pour cet article
  const feedbackAlreadyExists =
    articleId != null
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Boolean(await (prisma as any).articleFeedback.findFirst({ where: { articleId } }))
      : false;

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
        title={`Relecture · ${contentTypeLabelFr(review.job.contentType)}${review.job.anchorVilleSlug ? ` · ${review.job.anchorVilleSlug}` : ""}`}
        description={`Statut : ${REVIEW_STATUS_LABELS_FR[review.status as keyof typeof REVIEW_STATUS_LABELS_FR] ?? review.status} · Qualité ${review.job.qualityScore ?? "—"}/100 · SEO ${review.job.seoScore ?? "—"}/100`}
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="admin-h2">Aperçu de l&apos;article</h2>
        <p className="admin-meta-block">
          Améliorations qualité automatiques :{" "}
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
          <summary className="cursor-pointer font-bold">Données techniques (JSON — avancé)</summary>
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
          {feedbackAlreadyExists ? (
            <p className="admin-meta-block text-[color:var(--color-admin-success)]">
              Feedback déjà enregistré pour cet article.
            </p>
          ) : (
            <div className="flex gap-[var(--space-admin-4)]">
              <form action={submitFeedback}>
                <input type="hidden" name="type" value="up" />
                <button
                  type="submit"
                  className="admin-button"
                  aria-label="Feedback positif — article de bonne qualité"
                  title="Bon article"
                  disabled={feedbackAlreadyExists}
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
                  disabled={feedbackAlreadyExists}
                >
                  👎 À améliorer
                </button>
              </form>
            </div>
          )}
        </AdminCard>
      )}

      {/* P0-13 — Historique de décision (4 champs DB) */}
      {review.reviewedBy || review.reviewNotes || review.reviewedAt || review.promotedToTier1At ? (
        <AdminCard className="mb-[var(--space-admin-5)]">
          <h2 className="admin-h2">Historique de décision</h2>
          <ul className="admin-inline-list">
            {review.reviewedBy ? (
              <li>
                <strong>Révisé par :</strong> {review.reviewedBy}
              </li>
            ) : null}
            {review.reviewedAt ? (
              <li>
                <strong>Révisé le :</strong> {new Date(review.reviewedAt).toLocaleString("fr-FR")}
              </li>
            ) : null}
            {review.promotedToTier1At ? (
              <li>
                <strong>Rendu visible sur Google le :</strong>{" "}
                {new Date(review.promotedToTier1At).toLocaleString("fr-FR")}
              </li>
            ) : null}
            {review.reviewNotes ? (
              <li>
                <strong>Notes :</strong> {review.reviewNotes}
              </li>
            ) : null}
          </ul>
        </AdminCard>
      ) : null}

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
            Approuver (en ligne, non indexé)
          </button>
        </form>

        <form action={promote} className="mb-[var(--space-admin-6)]">
          <p className="admin-meta-block">
            Approuve l&apos;article ET le rend <strong>visible sur Google</strong> (indexable) : il
            pourra apparaître dans les résultats de recherche une fois publié.
          </p>
          <button type="submit" className="admin-button">
            Approuver + rendre visible sur Google
          </button>
        </form>

        <form action={askEdits} className="mb-[var(--space-admin-6)]">
          <div className="admin-field">
            <label htmlFor="edits-comment" className="admin-label">
              Demander des modifications — l&apos;IA régénère le contenu (10 caractères min)
            </label>
            <textarea
              id="edits-comment"
              name="comment"
              rows={4}
              minLength={10}
              maxLength={5000}
              required
              className="admin-input"
              placeholder="Ex. « Réécrire la section H2 #2 en restant AxionIA-centric, ajouter 200 mots sur la formation collective. »"
            />
          </div>
          <button type="submit" className="admin-button-ghost">
            Demander des modifications
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
            Rejeter
          </button>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
