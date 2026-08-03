// Reply history timeline — Server Component (Sprint Notif Infra 2026-05-26).
//
// Affiche toutes les SubmissionReply liees a une Submission, triees par
// repliedAt desc. Statut delivery visuel + bouton retry pour les replies
// failed/bounced.

import { prisma } from "@/lib/prisma";
import { RetryFailedReplyButton } from "./RetryFailedReplyButton";

interface Props {
  submissionId: string;
}

// Le ton de la pastille porte déjà l'état (succès vert, alerte ambre, danger
// rouge) : l'emoji qui le doublait n'ajoutait rien et son dessin variait
// d'un poste à l'autre. Retiré le 2026-08-02.
const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: "En cours d'envoi", tone: "warning" },
  sent: { label: "Envoyé", tone: "success" },
  delivered: { label: "Délivré", tone: "success" },
  bounced: { label: "Rejeté", tone: "warning" },
  complained: { label: "Marqué comme spam", tone: "danger" },
  failed: { label: "Échec d'envoi", tone: "danger" },
};

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export async function ReplyHistory({ submissionId }: Props): Promise<React.ReactElement> {
  const replies = await prisma.submissionReply.findMany({
    where: { submissionId },
    orderBy: { repliedAt: "desc" },
    select: {
      id: true,
      repliedAt: true,
      repliedByName: true,
      subject: true,
      bodyHtml: true,
      bodyText: true,
      deliveryStatus: true,
      providerMessageId: true,
      sentAt: true,
      failedAt: true,
      errorMsg: true,
      retryCount: true,
    },
  });

  if (replies.length === 0) {
    return (
      <div className="admin-card admin-card-wide">
        <h2 className="admin-h2">Historique des réponses</h2>
        <p className="text-sm text-[color:var(--color-admin-fg-muted)]">
          Aucune réponse envoyée pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-card admin-card-wide">
      <h2 className="admin-h2">Historique des réponses ({replies.length})</h2>
      <ul className="mt-4 space-y-3">
        {replies.map((r) => {
          const status = STATUS_LABEL[r.deliveryStatus] ?? STATUS_LABEL.pending;
          const isRetryable = r.deliveryStatus === "failed" || r.deliveryStatus === "bounced";
          return (
            <li
              key={r.id}
              className="rounded-lg border border-[color:var(--color-admin-border-default)] bg-[color:var(--color-admin-paper)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    Réponse envoyée par {r.repliedByName} · {formatDateTime(r.repliedAt)}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--color-admin-fg-muted)]">
                    Sujet : {r.subject}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium admin-badge-${status?.tone ?? "default"}`}
                >
                  {status?.label ?? r.deliveryStatus}
                  {r.retryCount > 0 ? ` · tentative ${r.retryCount}` : ""}
                </span>
              </div>

              {r.errorMsg && (
                <p className="mt-2 rounded bg-[color:var(--color-admin-danger-bg)] p-2 text-xs text-[color:var(--color-admin-danger-fg)]">
                  Erreur : {r.errorMsg.slice(0, 300)}
                </p>
              )}

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-[color:var(--color-admin-fg-muted)]">
                  ▼ Voir le contenu
                </summary>
                <div className="mt-2 rounded bg-[color:var(--color-admin-bg-subtle)] p-3 text-sm whitespace-pre-wrap">
                  {r.bodyText}
                </div>
              </details>

              {isRetryable && <RetryFailedReplyButton replyId={r.id} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
