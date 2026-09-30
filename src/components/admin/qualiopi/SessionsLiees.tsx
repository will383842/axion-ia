/**
 * Lot L4 (2026-09-30) — « Sessions » d'une fiche formation ou formateur, chacune
 * avec UN lien vers LA fiche session. Server Component, aucun JS client.
 *
 * Voir `listerSessionsLiees` pour le plafond et le fail-soft.
 */

import Link from "next/link";

import {
  PLAFOND_SESSIONS_LIEES,
  type SessionsLiees,
} from "@/server/qualiopi/sessions/sessions-liees";

const STATUT_SESSION: Readonly<Record<string, string>> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const FMT_JOUR = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const cellCls = "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-top";
const headCls =
  "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

export function SessionsLieesSection({
  sessions,
  sessionsHref,
  vide,
}: {
  sessions: SessionsLiees;
  /** `/…/qualiopi/sessions` — la fiche de chaque session s'y ouvre par son id. */
  sessionsHref: string;
  /** Phrase de l'état vide, propre à la fiche qui l'affiche. */
  vide: string;
}): React.ReactElement {
  return (
    <section
      aria-labelledby="sessions-liees-titre"
      className="mt-[var(--space-admin-6)] mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]"
    >
      <h2
        id="sessions-liees-titre"
        className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
      >
        Sessions
      </h2>

      {sessions.erreur ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]">
          Les sessions n&apos;ont pas pu être lues : cette absence n&apos;est PAS un constat.
          Rechargez la page.
        </p>
      ) : sessions.lignes.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {vide}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
            <thead>
              <tr>
                <th className={headCls}>Session</th>
                <th className={headCls}>Dates</th>
                <th className={headCls}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {sessions.lignes.map((s) => (
                <tr key={s.id} className="border-t border-[color:var(--color-admin-border)]">
                  <td className={cellCls}>
                    <Link
                      href={`${sessionsHref}/${s.id}`}
                      className="font-medium text-[color:var(--color-admin-accent)] underline"
                    >
                      {s.numero}
                    </Link>
                    <span className="block">{s.titreSession}</span>
                  </td>
                  <td className={`${cellCls} whitespace-nowrap`}>
                    {`${FMT_JOUR.format(s.dateDebut)} → ${FMT_JOUR.format(s.dateFin)}`}
                  </td>
                  <td className={cellCls}>{STATUT_SESSION[s.statut] ?? s.statut}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.tronque ? (
            <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              {`Les ${PLAFOND_SESSIONS_LIEES} plus récentes seulement — les autres sont dans la liste des sessions (archives comprises).`}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
