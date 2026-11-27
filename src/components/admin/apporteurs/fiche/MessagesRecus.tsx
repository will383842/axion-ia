// Fiche apporteur — bloc « Messages reçus » (2026-11-27) : e-mails de l'apporteur relevés dans la
// boîte Zoho et demandes d'aide de son espace. Composant serveur, sans état. Les plus récents
// d'abord, date et heure de Paris. Bloc séparé de l'historique des e-mails ENVOYÉS.

import { AdminCard } from "@/components/admin/ui";
import type { MessageRecuApporteur } from "@/features/apporteurs-reseau/messages-recus";

const dateHeureParis = (d: Date) =>
  d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

export function MessagesRecus({ messages }: { messages: readonly MessageRecuApporteur[] }) {
  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-3)] font-semibold">Messages reçus ({messages.length})</h2>
      {messages.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">
          Aucun message reçu de cet apporteur pour l&apos;instant.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          {messages.map((m) => (
            <li
              key={m.id}
              className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-2)] first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap justify-between gap-[var(--space-admin-2)]">
                <strong>{m.objet}</strong>
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  {dateHeureParis(m.recuLe)}
                </span>
              </div>
              <div className="text-[color:var(--color-admin-fg-muted)]">
                {m.source === "demande_aide" ? "Demande d'aide (espace apporteur)" : "E-mail reçu"}
                {m.automatique ? " · réponse automatique" : ""}
              </div>
              {m.extrait ? <p className="mt-[var(--space-admin-1)]">{m.extrait}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
