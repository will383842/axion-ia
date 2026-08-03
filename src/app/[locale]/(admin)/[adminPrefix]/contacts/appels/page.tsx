// Boîte de réception — « Appels réservés ».
//
// FUSION 2026-07-29 de trois entrées de sidebar qui lisaient TOUTES la même
// table `calendly_events` et affichaient les mêmes lignes :
//   • « RV téléphonique »  (/contacts/rendez-vous)            → liste
//   • « Calendrier RDV »   (/contacts/rendez-vous/calendrier)  → même liste, en grille
//   • « Appels Calendly »  (/contacts/calendly)                → même liste, en brut
// Le clic sur une ligne de la première renvoyait déjà vers le détail de la
// troisième : elles ne formaient qu'un seul écran éclaté en trois. Liste et
// calendrier sont désormais deux VUES d'une même page (`?vue=`), pas deux
// rubriques. Les trois anciennes routes redirigent ici.
//
// Il n'existe qu'un seul objet réservable côté public : le créneau Calendly
// « premier contact » de /appel. D'où le singulier assumé de cet écran.

import Link from "next/link";
import { getRdvMonth, listRendezVous } from "@/features/admin-rendezvous/queries";
import {
  RDV_STATUS_LABELS,
  type RdvFilters,
  type UnifiedRdv,
} from "@/features/admin-rendezvous/types";
import { dayKeyInParis, timeInParis } from "@/lib/calendar-grid";
import { MonthGridCalendar, type MonthGridDay } from "@/components/admin/ui/MonthGridCalendar";
import {
  AdminPageHeader,
  AdminFilterTabs,
  AdminTable,
  AdminPagination,
  AdminEmptyState,
  AdminButton,
} from "@/components/admin/ui";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import type { AdminTableColumn } from "@/components/admin/ui";
import { ManualCalendlyEventButton } from "@/components/admin/contacts/ManualCalendlyEventButton";
import { isCalendlyApiConfigured } from "@/server/calendly/api";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/lib/format-date-fr";

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

const PAGE_SIZE = 25;

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AppelsPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/contacts/appels`;
  const vue = sp["vue"] === "calendrier" ? "calendrier" : "liste";
  const apiConfigured = isCalendlyApiConfigured();

  const header = (
    <AdminPageHeader
      title="Appels réservés"
      description="Créneaux pris via le widget Calendly de la page /appel — le seul rendez-vous réservable côté public."
      actions={
        <div className="flex gap-2">
          <ManualCalendlyEventButton />
          <AdminButton
            href="https://calendly.com/event_types/user/me"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            iconAfter={ExternalLink}
          >
            Tableau de bord Calendly
          </AdminButton>
        </div>
      }
    />
  );

  const tabs = (
    <AdminFilterTabs
      label="Vue"
      current={vue}
      options={[
        { value: "liste", label: "Liste", href: base },
        { value: "calendrier", label: "Calendrier", href: `${base}?vue=calendrier` },
      ]}
    />
  );

  // Bandeau honnête sur ce que la capture gratuite sait — et ne sait pas —
  // faire. Le texte dépend de la présence du token API : sans lui, aucune
  // donnée de contact n'arrive, et le dire évite de chercher un bug ailleurs.
  const banner = (
    <div className="mt-[var(--space-admin-4)] rounded-lg border border-[color:var(--color-admin-warning-border)] bg-[color:var(--color-admin-warning-bg)] p-4 text-sm">
      {apiConfigured ? (
        <>
          <p className="font-semibold">Enrichissement Calendly actif.</p>
          <p className="mt-2">
            Le nom, l&apos;email et l&apos;horaire sont récupérés automatiquement auprès de Calendly
            juste après la réservation. Si une ligne reste incomplète, ouvrez-la et utilisez
            «&nbsp;Enrichir depuis Calendly&nbsp;» pour relancer la récupération.
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold">ℹ️ Le widget Calendly ne transmet aucun contact au site.</p>
          <p className="mt-2">
            Le navigateur ne reçoit de Calendly que deux identifiants techniques — jamais le nom,
            l&apos;email ni l&apos;horaire. Les lignes ci-dessous sont donc normalement vides&nbsp;:
            complétez-les depuis le mail Calendly reçu dans Gmail.{" "}
            <strong>
              Pour que tout se remplisse tout seul, ajoutez la variable{" "}
              <code>CALENDLY_API_TOKEN</code>
            </strong>{" "}
            (jeton personnel Calendly) dans la configuration — les réservations déjà captées
            pourront être complétées rétroactivement.
          </p>
          <p className="mt-2">
            Les annulations et déplacements faits côté Calendly ne remontent pas non plus sans ce
            jeton&nbsp;: marquez-les à la main.
          </p>
        </>
      )}
    </div>
  );

  // ── Vue calendrier ────────────────────────────────────────────────────────
  if (vue === "calendrier") {
    const now = new Date();
    const year = sp["year"] ? parseInt(sp["year"], 10) : now.getFullYear();
    const month = sp["month"] ? parseInt(sp["month"], 10) : now.getMonth() + 1;
    const selectedDate = sp["date"] ?? null;
    const byDay = await getRdvMonth(year, month);
    const monthTotal = [...byDay.values()].reduce((n, a) => n + a.length, 0);

    const days: MonthGridDay[] = [...byDay.entries()].map(([dayKey, arr]) => ({
      dayKey,
      count: arr.length,
      href: `${base}?vue=calendrier&year=${year}&month=${month}&date=${dayKey}`,
      selected: dayKey === selectedDate,
    }));

    const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
    const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
    const dayRdv = selectedDate ? (byDay.get(selectedDate) ?? []) : [];

    return (
      <>
        {header}
        <div className="mb-[var(--space-admin-4)]">{tabs}</div>
        {banner}

        <p className="mt-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {MONTHS[month - 1]} {year} · {monthTotal} appel{monthTotal > 1 ? "s" : ""}
        </p>

        <div className="mt-[var(--space-admin-3)] mb-[var(--space-admin-4)] flex flex-wrap items-center gap-2">
          <AdminButton
            href={`${base}?vue=calendrier&year=${prev.y}&month=${prev.m}`}
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
          >
            {MONTHS[prev.m - 1]}
          </AdminButton>
          <AdminButton href={`${base}?vue=calendrier`} variant="ghost" size="sm">
            Aujourd&apos;hui
          </AdminButton>
          <AdminButton
            href={`${base}?vue=calendrier&year=${next.y}&month=${next.m}`}
            variant="ghost"
            size="sm"
            iconAfter={ArrowRight}
          >
            {MONTHS[next.m - 1]}
          </AdminButton>
        </div>

        <MonthGridCalendar
          year={year}
          month={month}
          days={days}
          todayKey={dayKeyInParis(now)}
          unitLabel="appel réservé"
        />

        {selectedDate && (
          <div className="mt-[var(--space-admin-6)]">
            <h2 className="admin-h2">Appels du {formatDateFrShort(selectedDate)}</h2>
            {dayRdv.length === 0 ? (
              <p className="text-[color:var(--color-admin-fg-muted)]">Aucun appel ce jour.</p>
            ) : (
              <ul className="mt-[var(--space-admin-3)] space-y-2">
                {dayRdv.map((r) => (
                  <li key={r.key}>
                    <Link
                      href={r.detailHref}
                      className="flex items-center justify-between rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 hover:bg-[color:var(--color-admin-surface-hover)]"
                    >
                      <span>
                        <span className="font-semibold">
                          {r.timeConfirmed && r.startTime ? timeInParis(r.startTime) : "heure ?"}
                        </span>{" "}
                        — {r.title}
                        {r.contactName ? (
                          <span className="text-[color:var(--color-admin-fg-muted)]">
                            {" "}
                            · {r.contactName}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                        {RDV_STATUS_LABELS[r.status]} ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </>
    );
  }

  // ── Vue liste ─────────────────────────────────────────────────────────────
  const page = sp["page"] ? parseInt(sp["page"], 10) : 1;
  const { rows, total } = await listRendezVous({
    page,
    pageSize: PAGE_SIZE,
    ...(sp["status"] ? { status: sp["status"] as NonNullable<RdvFilters["status"]> } : {}),
    ...(sp["q"] ? { q: sp["q"] } : {}),
    ...(sp["from"] ? { from: sp["from"] } : {}),
    ...(sp["to"] ? { to: sp["to"] } : {}),
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: ReadonlyArray<AdminTableColumn<UnifiedRdv>> = [
    {
      key: "when",
      header: "Date / heure",
      cell: (r) => (
        <span>
          {formatDateFrShort(r.dayKey)}
          {r.timeConfirmed && r.startTime ? (
            ` · ${timeInParis(r.startTime)}`
          ) : (
            <span className="text-[color:var(--color-admin-fg-muted)]"> · heure ?</span>
          )}
        </span>
      ),
    },
    { key: "title", header: "Type d'appel", cell: (r) => r.title },
    {
      key: "contact",
      header: "Contact",
      cell: (r) =>
        r.contactName || r.contactEmail ? (
          <span className="block">
            <span className="block">{r.contactName ?? "—"}</span>
            {r.contactEmail ? (
              <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {r.contactEmail}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-[color:var(--color-admin-fg-muted)]">à compléter</span>
        ),
    },
    { key: "status", header: "Statut", cell: (r) => RDV_STATUS_LABELS[r.status] },
  ];

  return (
    <>
      {header}
      <div className="mb-[var(--space-admin-4)]">{tabs}</div>
      {banner}

      <p className="mt-[var(--space-admin-4)] mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {total} appel{total > 1 ? "s" : ""} · page {page} / {totalPages}
      </p>

      {rows.length === 0 ? (
        <AdminEmptyState
          title="Aucun appel réservé"
          description="Une réservation prise via le widget /appel apparaîtra ici sous quelques secondes."
        />
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.key}
          rowHref={(r) => r.detailHref}
          rowAction={() => (
            <span
              aria-hidden="true"
              className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg-muted)]"
            >
              ›
            </span>
          )}
        />
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        baseHref={base}
        preservedParams={{
          status: sp["status"],
          q: sp["q"],
          from: sp["from"],
          to: sp["to"],
        }}
      />
    </>
  );
}
