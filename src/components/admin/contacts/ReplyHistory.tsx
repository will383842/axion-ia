// Reply history timeline — Server Component (Sprint Notif Infra 2026-05-26).
//
// Affiche toutes les SubmissionReply liees a une Submission, triees par
// repliedAt desc. Statut delivery visuel + bouton retry pour les replies
// failed. Un rebond (adresse refusée) n'est jamais rejouable. Le HTML enregistré
// est toujours MASQUÉ à l'affichage : il peut porter le lien d'opposition du
// destinataire (jeton), qu'aucun écran de la console ne doit montrer.

import { LecteurEmail } from "@/components/admin/ui/LecteurEmail";
import { prisma } from "@/lib/prisma";
import { enveloppeExpedition } from "@/lib/email/enveloppe";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { LIBELLE_REBOND } from "@/features/admin-job-applications/etat-envoi";
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

  const enveloppe = enveloppeExpedition();

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
          // Seul un échec d'envoi se rejoue ; un rebond demande d'écrire de nouveau.
          const isRetryable = r.deliveryStatus === "failed";
          const isBounced = r.deliveryStatus === "bounced";
          const masque = masquerSecretsEmail({
            subject: r.subject,
            html: r.bodyHtml,
            text: r.bodyText,
          });
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

              {isBounced && (
                <p
                  role="status"
                  className="mt-2 rounded bg-[color:var(--color-admin-warning-bg)] p-2 text-xs text-[color:var(--color-admin-warning-fg)]"
                >
                  {LIBELLE_REBOND}
                </p>
              )}

              {/* Le texte est visible d'emblée ; seule la mise en forme se déplie. */}
              <div className="mt-3 rounded bg-[color:var(--color-admin-bg-subtle)] p-3 text-sm whitespace-pre-wrap">
                {masque.text}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-[color:var(--color-admin-fg-muted)]">
                  Voir la mise en forme envoyée
                </summary>
                <div className="mt-2">
                  <LecteurEmail
                    html={masque.html}
                    texte={masque.text}
                    de={enveloppe.from}
                    repondreA={enveloppe.replyTo}
                    objet={masque.subject}
                    titre={`Réponse envoyée : ${masque.subject}`}
                  />
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
