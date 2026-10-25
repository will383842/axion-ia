// Fil unique des échanges d'une fiche client (lot 1, PR-3, 25/10/2026).
// Composant SERVEUR, lecture seule, sans JavaScript. Objet seulement : jamais le corps d'un
// e-mail ni l'adresse du destinataire (la copie complète s'ouvre d'un clic, derrière la console).

import Link from "next/link";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import type { EchangeDuFil, GenreEchange } from "@/features/dossier-client/fil-des-echanges";

const GENRE: Readonly<Record<GenreEchange, string>> = {
  rendez_vous: "Rendez-vous",
  email: "E-mail",
  email_en_attente: "E-mail à valider",
  questionnaire: "Questionnaire",
};

const jourHeure = (d: Date): string =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export function FilDesEchanges({
  fil,
  sourcesEnPanne = 0,
  clientId,
  adminPrefix,
}: {
  fil: ReadonlyArray<EchangeDuFil>;
  /** Sources de lecture en panne : le fil est incomplet. */
  sourcesEnPanne?: number;
  clientId: string;
  adminPrefix: string;
}): React.ReactElement {
  return (
    <section
      aria-labelledby="fil-des-echanges"
      className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <div className="mb-[var(--space-admin-3)] flex flex-wrap items-baseline justify-between gap-[var(--space-admin-3)]">
        <h2 id="fil-des-echanges" className="text-[length:var(--text-admin-base)] font-semibold">
          Fil des échanges
        </h2>
        <Link
          href={`/fr/${adminPrefix}/emails-envoyes?client=${clientId}&fenetre=0`}
          className="admin-link text-[length:var(--text-admin-sm)]"
        >
          Tous les e-mails de cette fiche
        </Link>
      </div>
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Rendez-vous, e-mails des rendez-vous et du questionnaire, e-mails en attente de validation.
        Les rendez-vous à venir sont en tête, puis le plus récent d&apos;abord.
      </p>
      {sourcesEnPanne > 0 ? (
        <p role="alert" className="admin-alert admin-alert-warning mb-[var(--space-admin-3)]">
          <span>Une partie du fil n&apos;a pas pu être lue : il est incomplet. Rechargez la page.</span>
        </p>
      ) : null}
      {fil.length === 0 && sourcesEnPanne === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun échange rattaché à cette fiche pour l&apos;instant.
        </p>
      ) : fil.length === 0 ? null : (
        <ul className="space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
          {fil.map((e) => (
            <li
              key={e.cle}
              className="flex flex-wrap items-center gap-x-[var(--space-admin-3)] gap-y-[var(--space-admin-1)]"
            >
              <span className="text-[color:var(--color-admin-fg-muted)] tabular-nums">
                {jourHeure(e.date)}
              </span>
              <AdminBadge tone="outline">{GENRE[e.genre]}</AdminBadge>
              {e.lien !== null ? (
                <Link href={e.lien} className="admin-link">
                  {e.titre}
                </Link>
              ) : (
                <span>{e.titre}</span>
              )}
              <span className="text-[color:var(--color-admin-fg-muted)]">{e.etat}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
