// Détail conversation — thread de messages (read-only). FR-only.

import Link from "next/link";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminBadge } from "@/components/admin/ui";
import type { ConversationDetail } from "@/features/admin-chatbot/actions";

function frDate(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

export function ConversationDetailV2({
  adminPrefix,
  convo,
}: {
  adminPrefix: string;
  convo: ConversationDetail;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/chatbot/conversations`;

  return (
    <AdminPageShell width="full">
      <AdminPageHeader
        title="Conversation"
        description={`Session ${convo.sessionUuid.slice(0, 8)}… · ${convo.statut} · ${frDate(convo.createdAt)}`}
        actions={
          <Link
            href={base}
            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-info)] hover:underline"
          >
            ← Retour
          </Link>
        }
      />

      {convo.resume ? (
        <AdminCard className="mb-[var(--space-admin-4)]">
          <h2 className="mb-2 text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)] uppercase">
            Résumé de contexte
          </h2>
          <p className="text-[length:var(--text-admin-sm)] whitespace-pre-wrap">{convo.resume}</p>
        </AdminCard>
      ) : null}

      <AdminCard>
        <div className="flex flex-col gap-[var(--space-admin-3)]">
          {convo.messages.length === 0 ? (
            <p className="text-[color:var(--color-admin-fg-muted)]">Aucun message.</p>
          ) : (
            convo.messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div key={m.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      isUser
                        ? "max-w-[80%] rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-info-soft)] p-3"
                        : "max-w-[80%] rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-paper-alt)] p-3"
                    }
                  >
                    <div className="mb-1 flex items-center gap-2 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      <span className="font-semibold uppercase">
                        {isUser ? "Visiteur" : "Assistant"}
                      </span>
                      <span>{frDate(m.createdAt)}</span>
                      {m.servedFromCache ? <AdminBadge tone="info">cache</AdminBadge> : null}
                    </div>
                    <p className="text-[length:var(--text-admin-sm)] whitespace-pre-wrap">
                      {m.contenu}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AdminCard>
    </AdminPageShell>
  );
}
