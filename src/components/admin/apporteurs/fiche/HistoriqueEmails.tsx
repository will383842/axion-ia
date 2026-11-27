// Fiche apporteur : historique des e-mails envoyés à cet apporteur (lecture seule).
// Les lignes viennent d'`EmailLog` (voir `lireHistoriqueEmailsApporteur`) ; chaque ligne
// renvoie vers le contenu complet dans le journal des e-mails de la console.

import Link from "next/link";

import { AdminCard } from "@/components/admin/ui";
import { LIBELLES_STATUT_EMAIL } from "@/features/admin-emails/statut-libelles";
import {
  libelleGabaritApporteur,
  type EmailDeLApporteur,
} from "@/features/apporteurs-reseau/requetes-console";

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
      <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Seuls les e-mails adressés à l&apos;adresse actuelle sont listés. L&apos;objet vient de la
        copie du journal ; sans copie, un libellé déduit du type d&apos;e-mail s&apos;affiche. Le
        contenu complet s&apos;ouvre dans le journal des e-mails.
      </p>
      {emails.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">
          Aucun e-mail envoyé à l&apos;adresse actuelle de cet apporteur pour l&apos;instant.
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
                    {e.objet ?? libelleGabaritApporteur(e.template)}
                    {e.objet ? (
                      <div className="text-[color:var(--color-admin-fg-muted)]">{e.template}</div>
                    ) : null}
                  </td>
                  <td className="py-[var(--space-admin-2)] pr-[var(--space-admin-3)]">
                    {LIBELLES_STATUT_EMAIL[e.status] ?? e.status}
                    {e.error ? (
                      <div className="text-[color:var(--color-admin-fg-muted)]">
                        {e.error.slice(0, 200)}
                      </div>
                    ) : null}
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
