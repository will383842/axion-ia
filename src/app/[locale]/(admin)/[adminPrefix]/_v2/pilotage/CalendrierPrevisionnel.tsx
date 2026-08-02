// Tableau de bord de pilotage — section 3 : calendrier & prévisionnel (le cœur).
//
// Trois vues selon la période choisie, toutes rendues côté serveur, 0 lib :
//   - semaine : grille formateur × 7 jours, jours d'indisponibilité grisés ;
//   - mois    : MonthGridCalendar (grille générique RSC existante) ;
//   - année   : 12 barres CSS (prestations démarrant chaque mois) + CA réalisé.
// Plus le bandeau « Prévisionnel bloqué » : sessions à ≤ 7 jours sans formateur.

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AdminCard, AdminBadge } from "@/components/admin/ui";
// Import DIRECT (pas via le barrel) — contrat d'usage de la grille calendrier.
import { MonthGridCalendar } from "@/components/admin/ui/MonthGridCalendar";
import { PLANNING_TYPE_LABELS, planningDetailHref } from "@/features/admin-planning/types";
import type {
  CalendrierAnnee,
  CalendrierMois,
  CalendrierPilotage,
  CalendrierSemaine,
  SessionBloquee,
} from "@/server/admin/pilotage-dashboard";
import { fmtDate, fmtEurosCents, largeurPct, MOIS_COURTS } from "./format";

interface Props {
  adminPrefix: string;
  calendrier: CalendrierPilotage;
  previsionnelBloque: SessionBloquee[];
}

const JOURS_SEMAINE_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function VueSemaine({
  adminPrefix,
  cal,
}: {
  adminPrefix: string;
  cal: CalendrierSemaine;
}): React.ReactElement {
  if (cal.lignes.length === 0) {
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Aucun formateur ni prestation cette semaine.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
        <thead>
          <tr className="text-left text-[color:var(--color-admin-fg-muted)]">
            <th className="pr-[var(--space-admin-4)] pb-[var(--space-admin-2)] font-medium">
              Formateur
            </th>
            {cal.jours.map((dayKey, i) => (
              <th
                key={dayKey}
                className="pr-[var(--space-admin-3)] pb-[var(--space-admin-2)] font-medium whitespace-nowrap"
              >
                {JOURS_SEMAINE_LABELS[i]} {dayKey.slice(8, 10)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cal.lignes.map((ligne) => (
            <tr
              key={ligne.formateurId ?? "non-affecte"}
              className="border-t border-[color:var(--color-admin-border)] align-top"
            >
              <td className="py-[var(--space-admin-3)] pr-[var(--space-admin-4)] font-medium whitespace-nowrap">
                {ligne.nom}
              </td>
              {ligne.cellules.map((cellule) => (
                <td
                  key={cellule.dayKey}
                  className={[
                    "min-w-[110px] py-[var(--space-admin-3)] pr-[var(--space-admin-3)]",
                    cellule.indisponible ? "bg-[color:var(--color-admin-surface-sunken)]" : "",
                  ].join(" ")}
                >
                  {cellule.indisponible && cellule.events.length === 0 ? (
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      Indisponible
                    </span>
                  ) : null}
                  <ul className="flex flex-col gap-[var(--space-admin-1)]">
                    {cellule.events.map((e) => (
                      <li key={`${e.key}:${cellule.dayKey}`}>
                        <Link
                          href={planningDetailHref(adminPrefix, e)}
                          className="text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-info)] hover:underline"
                        >
                          {PLANNING_TYPE_LABELS[e.type]} · {e.titre}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VueMois({
  adminPrefix,
  cal,
}: {
  adminPrefix: string;
  cal: CalendrierMois;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/planning`;
  return (
    <MonthGridCalendar
      year={cal.year}
      month={cal.month}
      todayKey={cal.todayKey}
      days={cal.days.map((d) => ({
        dayKey: d.dayKey,
        count: d.count,
        href: `${base}?year=${cal.year}&month=${cal.month}&date=${d.dayKey}`,
      }))}
    />
  );
}

function VueAnnee({ cal }: { cal: CalendrierAnnee }): React.ReactElement {
  const max = Math.max(1, ...cal.mois.map((m) => m.nbPrestations));
  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      {cal.mois.map((m) => (
        <div key={m.mois} className="flex items-center gap-[var(--space-admin-4)]">
          <span className="w-[52px] shrink-0 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {MOIS_COURTS[m.mois - 1]}
          </span>
          <div
            className="h-[10px] flex-1 overflow-hidden rounded-full bg-[color:var(--color-admin-accent-track)]"
            role="img"
            aria-label={`${m.nbPrestations} prestation(s) démarrant en ${MOIS_COURTS[m.mois - 1]}`}
          >
            <div
              className="h-full rounded-full bg-[color:var(--color-admin-accent)]"
              style={{ width: `${largeurPct(m.nbPrestations, max)}%` }}
            />
          </div>
          <span className="w-[30px] shrink-0 text-right text-[length:var(--text-admin-xs)] font-semibold tabular-nums">
            {m.nbPrestations}
          </span>
          <span className="w-[110px] shrink-0 text-right text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] tabular-nums">
            CA {fmtEurosCents(m.caRealiseCents)}
          </span>
        </div>
      ))}
      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Barre = prestations démarrant dans le mois · CA = chiffre d&apos;affaires réalisé du mois
        (sessions réalisées).
      </p>
    </div>
  );
}

export function CalendrierPrevisionnel({
  adminPrefix,
  calendrier,
  previsionnelBloque,
}: Props): React.ReactElement {
  const base = `/fr/${adminPrefix}`;
  return (
    <AdminCard className="mb-[var(--space-admin-6)]">
      <div className="mb-[var(--space-admin-4)] flex items-center justify-between gap-[var(--space-admin-4)]">
        <h2 className="flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-admin-md)]"
            style={{
              background: "var(--color-admin-id-bleu-soft)",
              color: "var(--color-admin-id-bleu)",
            }}
          >
            <CalendarDays size={16} />
          </span>
          Calendrier &amp; prévisionnel
        </h2>
        <Link href={`${base}/planning`} className="admin-button-ghost">
          Ouvrir le planning →
        </Link>
      </div>

      {previsionnelBloque.length > 0 ? (
        <div className="mb-[var(--space-admin-5)] rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-destructive-soft)] p-[var(--space-admin-4)]">
          <p className="mb-[var(--space-admin-2)] flex items-center gap-[var(--space-admin-3)]">
            <AdminBadge tone="destructive" dot>
              Prévisionnel bloqué
            </AdminBadge>
            <span className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-destructive-fg)]">
              {previsionnelBloque.length} session(s) à moins de 7 jours sans formateur
            </span>
          </p>
          <ul className="flex flex-col gap-[var(--space-admin-1)]">
            {previsionnelBloque.map((s) => (
              <li key={s.id} className="text-[length:var(--text-admin-sm)]">
                <Link
                  href={`${base}/qualiopi/sessions/${s.id}`}
                  className="font-medium text-[color:var(--color-admin-destructive-fg)] underline hover:no-underline"
                >
                  {s.numero} · {s.titreSession}
                </Link>{" "}
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  — démarre le {fmtDate(s.dateDebut)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {calendrier.type === "semaine" ? (
        <VueSemaine adminPrefix={adminPrefix} cal={calendrier} />
      ) : calendrier.type === "mois" ? (
        <VueMois adminPrefix={adminPrefix} cal={calendrier} />
      ) : (
        <VueAnnee cal={calendrier} />
      )}
    </AdminCard>
  );
}
