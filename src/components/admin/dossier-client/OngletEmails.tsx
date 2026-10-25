// Onglet « E-mails » de la fiche client (25/10/2026) : ce qui a été envoyé à ce client, avec l'OBJET
// de chaque e-mail. L'objet et le contenu de la copie sont gardés 5 ans (décision de Will) ; le
// détail (contenu exact) s'ouvre dans « E-mails envoyés ». Composant SERVEUR, lecture seule.

import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import {
  libelleStatutLigne,
  TON_STATUT_EMAIL,
  type LigneEmail,
} from "@/features/admin-emails/query";

const carteCls =
  "mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]";
const titreCls =
  "mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
const mutedCls = "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";

const jourHeure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export function OngletEmails({
  lignes,
  total,
  clientId,
  adminPrefix,
}: {
  lignes: ReadonlyArray<LigneEmail>;
  total: number;
  clientId: string;
  adminPrefix: string;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/emails-envoyes`;
  return (
    <section className={carteCls} aria-labelledby="emails-fiche">
      <h2 id="emails-fiche" className={titreCls}>
        E-mails
      </h2>
      <p className={`mb-[var(--space-admin-3)] ${mutedCls}`}>
        L&apos;objet et le contenu de chaque e-mail sont gardés 5 ans. Rien n&apos;est supprimé
        automatiquement.
      </p>
      {lignes.length === 0 ? (
        <p className={mutedCls}>Aucun e-mail envoyé à ce client pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          {lignes.map((l) => (
            <li key={l.id} data-email={l.id}>
              <p className="font-medium">
                <Link href={`${base}/${l.id}`} className="admin-link">
                  {l.objet ?? "Objet non conservé"}
                </Link>{" "}
                <AdminBadge tone={TON_STATUT_EMAIL[l.status]}>{libelleStatutLigne(l)}</AdminBadge>
              </p>
              <p className={mutedCls}>
                {jourHeure(l.sentAt ?? l.createdAt)} · à {l.recipient}
              </p>
            </li>
          ))}
        </ul>
      )}
      {total > lignes.length ? (
        <p className="mt-[var(--space-admin-3)]">
          <Link
            href={`${base}?client=${clientId}&fenetre=0`}
            className="admin-link text-[length:var(--text-admin-sm)]"
          >
            Voir les {total} e-mails dans « E-mails envoyés »
          </Link>
        </p>
      ) : null}
    </section>
  );
}
