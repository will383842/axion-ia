// Planning unifié — vue « TIMELINE RESSOURCES ».
//
// Une ligne par formateur, une colonne par jour du mois. Là où la vue « charge »
// résume un mois en un pourcentage, la timeline montre la RÉPARTITION : une
// semaine pleine suivie d'une semaine vide donne 50 % de charge, et ce n'est pas
// du tout la même chose qu'un mois régulier à 50 %.
//
// La ligne « Non affecté » est en tête : c'est la seule qui appelle une action.
//
// 0 JS client : navigation mensuelle par liens, tableau RSC, cellules en CSS pur.
// Le tableau défile horizontalement dans son propre conteneur — la page, elle,
// ne défile jamais latéralement (31 colonnes ne tiennent pas sur un écran).

import Link from "next/link";
import { getPlanningMonth } from "@/features/admin-planning/queries";
import { listTrainers } from "@/server/qualiopi/trainers/trainers";
import {
  construireTimeline,
  estWeekEnd,
  joursDuMois,
  type TimelineLigne,
} from "@/features/admin-planning/timeline";
import { planningDetailHref } from "@/features/admin-planning/types";
import { AdminPageHeader, AdminBadge, AdminCard } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function parseMonth(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback;
}
function parseYear(v: string | undefined, fallback: number): number {
  const n = v !== undefined ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : fallback;
}

/** Numéro de jour affiché en en-tête de colonne (« 2026-06-07 » → « 7 »). */
function numeroJour(dayKey: string): string {
  return String(Number(dayKey.slice(8, 10)));
}

function LigneTimeline({
  ligne,
  jours,
  adminPrefix,
}: {
  ligne: TimelineLigne;
  jours: string[];
  adminPrefix: string;
}) {
  const nonAffecte = ligne.formateurId === null;
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-[var(--color-admin-paper)] py-[var(--space-admin-2)] pr-[var(--space-admin-4)] text-left whitespace-nowrap"
      >
        {nonAffecte ? (
          <AdminBadge tone="destructive" dot>
            Non affecté
          </AdminBadge>
        ) : (
          <Link
            href={`/fr/${adminPrefix}/qualiopi/formateurs/${ligne.formateurId}`}
            className="admin-link"
          >
            {ligne.formateurNom}
          </Link>
        )}
        <span className="admin-muted ml-[var(--space-admin-2)] tabular-nums">
          {ligne.joursOccupes} j · {ligne.nbPrestations} prest.
        </span>
      </th>

      {jours.map((jour) => {
        const events = ligne.parJour.get(jour) ?? [];
        // `premier` plutôt qu'une assertion : une case sans événement rend une
        // cellule vide, jamais un lien vers `undefined`.
        const premier = events[0];
        const weekEnd = estWeekEnd(jour);
        return (
          <td
            key={jour}
            className={`border border-[var(--color-admin-border)] p-0 text-center align-middle ${
              weekEnd ? "bg-[var(--color-admin-paper-alt)]" : ""
            }`}
          >
            {premier === undefined ? (
              <span className="sr-only">libre</span>
            ) : (
              <Link
                href={planningDetailHref(adminPrefix, premier)}
                title={events.map((e) => e.titre).join(" · ")}
                className="block px-[var(--space-admin-1)] py-[var(--space-admin-2)] text-xs font-semibold"
              >
                {events.length === 1 ? "●" : events.length}
              </Link>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export default async function PlanningTimelinePage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  const now = new Date();
  const year = parseYear(sp["year"], now.getFullYear());
  const month = parseMonth(sp["month"], now.getMonth() + 1);

  const [byDay, trainers] = await Promise.all([
    getPlanningMonth(year, month),
    listTrainers({ actifOnly: true }),
  ]);

  const lignes = construireTimeline(
    byDay,
    trainers.map((t) => ({ id: t.id, prenom: t.prenom, nom: t.nom })),
  );
  const jours = joursDuMois(year, month);
  const nonStaffees = lignes.find((l) => l.formateurId === null)?.nbPrestations ?? 0;

  const base = `/fr/${adminPrefix}/planning/timeline`;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <>
      <AdminPageHeader
        title="Timeline ressources"
        description={`${MONTHS[month - 1]} ${year} · ${lignes.length} ligne(s)${
          nonStaffees > 0 ? ` · ${nonStaffees} prestation(s) sans formateur` : ""
        }`}
      />

      <nav className="mb-[var(--space-admin-5)] flex items-center gap-[var(--space-admin-3)]">
        <Link href={`${base}?year=${prev.y}&month=${prev.m}`} className="admin-link">
          ← {MONTHS[prev.m - 1]}
        </Link>
        <Link href={`${base}?year=${next.y}&month=${next.m}`} className="admin-link">
          {MONTHS[next.m - 1]} →
        </Link>
        <Link href={`/fr/${adminPrefix}/planning/hub`} className="admin-link">
          Hub
        </Link>
        <Link href={`/fr/${adminPrefix}/planning/charge`} className="admin-link">
          Charge
        </Link>
      </nav>

      <AdminCard>
        {lignes.length === 0 ? (
          <p className="admin-muted">Aucune prestation ce mois-ci.</p>
        ) : (
          <>
            {/* 31 colonnes ne tiennent pas sur un écran : le tableau défile ici,
                et jamais la page (budget Web Vitals, CLS = 0). */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  Occupation des formateurs jour par jour pour {MONTHS[month - 1]} {year}
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-[var(--color-admin-paper)] text-left"
                    >
                      Formateur
                    </th>
                    {jours.map((jour) => (
                      <th
                        key={jour}
                        scope="col"
                        className={`w-6 text-center text-xs font-normal tabular-nums ${
                          estWeekEnd(jour) ? "admin-muted" : ""
                        }`}
                      >
                        {numeroJour(jour)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <LigneTimeline
                      key={l.formateurId ?? "non-affecte"}
                      ligne={l}
                      jours={jours}
                      adminPrefix={adminPrefix}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="admin-muted mt-[var(--space-admin-3)]">
              ● = une prestation ce jour-là ; un chiffre = plusieurs. Les prestations annulées ou
              reportées n&apos;occupent aucune case : elles ne mobilisent personne.
            </p>
          </>
        )}
      </AdminCard>
    </>
  );
}
