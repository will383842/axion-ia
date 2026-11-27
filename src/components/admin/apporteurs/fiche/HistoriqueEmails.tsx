// Fiche apporteur : historique des e-mails envoyés à cet apporteur (lecture seule).
// Les lignes viennent d'`EmailLog` (voir `lireHistoriqueEmailsApporteur`) ; chaque ligne
// renvoie vers le contenu complet dans le journal des e-mails de la console.

import Link from "next/link";

import { AdminCard } from "@/components/admin/ui";
import { LIBELLES_STATUT_EMAIL } from "@/features/admin-emails/statut-libelles";
import type { EmailDeLApporteur } from "@/features/apporteurs-reseau/requetes-console";

const dateHeure = (d: Date) =>
  d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

export function HistoriqueEmails({
  emails,
  base,
}: {
  emails: readonly EmailDeLApporteur[];
  /** `/fr/<adminPrefix>` */
  base: string;
}) {
  return (
    <AdminCard as="section">
      <h2 className="mb-[var(--space-admin-3)] font-semibold">
        Historique des e-mails ({emails.length})
      </h2>
      {emails.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">
          Aucun e-mail envoyé à cet apporteur pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[length:var(--text-admin-sm)]">
            <thead>
              <tr className="text-[color:var(--color-admin-fg-muted)]">
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Date</th>
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Objet</th>
                <th className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">Envoi</th>
                <th className="py-[var(--space-admin-2)]">Contenu</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id} className="border-t border-[color:var(--color-admin-border)]">
                  <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                    {dateHeure(e.date)}
                  </td>
                  <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                    {e.objet ?? e.template}
                    {e.objet ? (
                      <div className="text-[color:var(--color-admin-fg-muted)]">{e.template}</div>
                    ) : null}
                  </td>
                  <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                    {LIBELLES_STATUT_EMAIL[e.status] ?? e.status}
                  </td>
                  <td className="py-[var(--space-admin-2)]">
                    <Link href={`${base}/emails-envoyes/${e.id}`} className="underline">
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}
