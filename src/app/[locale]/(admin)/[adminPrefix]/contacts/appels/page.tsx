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
//
// ── CLIENTS ET APPORTEURS À PART (2026-09-19) ─────────────────────────────
// Le même compte Calendly porte désormais l'échange de 15 minutes proposé aux
// candidats apporteurs. Ces rendez-vous se mêlaient aux appels de découverte
// des clients : on ne savait plus, en ouvrant l'agenda, qui on allait appeler.
// D'où trois ajouts, tous DÉRIVÉS du nom du type d'événement
// (`estAppelApporteur`) — rien n'est stocké, rien ne migre :
//   · un filtre Tous / Clients / Apporteurs (`?public=`), appliqué APRÈS la
//     garde, EN MÉMOIRE sur les lignes lues (`queries.ts` le dit aussi) — le
//     public se déduit du nom du type d'événement, que SQL ne sait pas lire ;
//   · une pastille « Apporteur » / « Client » sur chaque rendez-vous ;
//   · une vue « Jour », ouverte par défaut : la question qu'on pose à cet écran
//     est « qui j'appelle aujourd'hui », pas « combien en juillet ».
// La liste reste à `?vue=liste`, le calendrier à `?vue=calendrier`.

import Link from "next/link";
import { getRdvMonth, listRendezVous } from "@/features/admin-rendezvous/queries";
import {
  RDV_STATUS_LABELS,
  type PublicRdv,
  type RdvFilters,
  type UnifiedRdv,
} from "@/features/admin-rendezvous/types";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import {
  INTITULE_FORMAT,
  LIBELLE_CANAL,
  TEINTE_CANAL,
  type CanalRendezVous,
} from "@/server/calendly/canal";
import { dayKeyInParis, dayKeyOfGridDate, timeInParis } from "@/lib/calendar-grid";
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
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardeLectureAppels } from "@/features/admin-calendly/acces";
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

/**
 * Pastille de FORMAT — téléphone, visio, ou « à préciser ».
 *
 * Teinte d'identité (non sémantique) quand le format est connu, badge neutre
 * sinon : un format indécis ne doit pas ressembler à un format décidé. Le choix
 * des deux couleurs et sa raison sont documentés sur `TEINTE_CANAL`.
 */
function PastilleFormat({ format }: { format: CanalRendezVous }) {
  const teinte = TEINTE_CANAL[format];
  if (teinte === null) {
    return (
      <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {LIBELLE_CANAL[format]}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-admin-sm)] px-2 py-0.5 text-[length:var(--text-admin-xs)] font-medium"
      style={{
        background: `var(--color-admin-id-${teinte}-soft)`,
        color: `var(--color-admin-id-${teinte})`,
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: "currentColor" }}
      />
      {LIBELLE_CANAL[format]}
    </span>
  );
}

/**
 * Pastille de PUBLIC — « Apporteur » ou « Client ».
 *
 * Deux teintes d'identité distinctes de celles du format (bleu = téléphone,
 * teal = visio) : les deux pastilles voisinent sur la même ligne et ne doivent
 * pas se lire comme une seule information.
 */
function PastillePublic({ titre }: { titre: string }) {
  const apporteur = estAppelApporteur(titre);
  const teinte = apporteur ? "violet" : "or";
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-admin-sm)] px-2 py-0.5 text-[length:var(--text-admin-xs)] font-medium"
      style={{
        background: `var(--color-admin-id-${teinte}-soft)`,
        color: `var(--color-admin-id-${teinte})`,
      }}
    >
      {apporteur ? "Apporteur" : "Client"}
    </span>
  );
}

/** Lit `?public=` : toute autre valeur vaut « tous » (aucun filtre). */
function lirePublic(v: string | undefined): PublicRdv | undefined {
  return v === "clients" || v === "apporteurs" ? v : undefined;
}

/** Clé jour valide « YYYY-MM-DD », sinon `null` (on retombe sur aujourd'hui). */
function lireJour(v: string | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Décale une clé jour de `delta` jours, sans passer par le fuseau du serveur. */
function decalerJour(dayKey: string, delta: number): string {
  const [y = 1970, m = 1, d = 1] = dayKey.split("-").map(Number);
  return dayKeyOfGridDate(new Date(Date.UTC(y, m - 1, d + delta)));
}

/** URL de l'écran, sans les paramètres vides. */
function lien(base: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const texte = qs.toString();
  return texte ? `${base}?${texte}` : base;
}

/** Une ligne de rendez-vous, telle que la montrent les vues Jour et Calendrier. */
function LigneRdv({ r }: { r: UnifiedRdv }) {
  return (
    <li>
      <Link
        href={r.detailHref}
        className="flex items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 hover:bg-[color:var(--color-admin-surface-hover)]"
      >
        <span>
          <span className="font-semibold">
            {r.timeConfirmed && r.startTime ? timeInParis(r.startTime) : "heure ?"}
          </span>{" "}
          — {r.title}
          {r.contactName ? (
            <span className="text-[color:var(--color-admin-fg-muted)]"> · {r.contactName}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <PastillePublic titre={r.title} />
          <PastilleFormat format={r.format} />
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {RDV_STATUS_LABELS[r.status]} ›
          </span>
        </span>
      </Link>
    </li>
  );
}

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AppelsPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  // 🔴 Cette page n'appelait `auth()` NULLE PART jusqu'au 2026-08-27 : elle
  // listait les coordonnées de tous les prospects à quiconque atteignait l'URL.
  // La garde vient avant `listRendezVous`, qui touche la base.
  const acces = await gardeLectureAppels(`/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/contacts/appels`;
  // « Jour » par défaut (2026-09-19) : les deux autres vues se demandent.
  const vue = sp["vue"] === "calendrier" ? "calendrier" : sp["vue"] === "liste" ? "liste" : "jour";
  const publicRdv = lirePublic(sp["public"]);
  const optionsPublic = publicRdv ? { public: publicRdv } : {};
  const apiConfigured = isCalendlyApiConfigured();

  const header = (
    <AdminPageHeader
      title="Appels réservés"
      description="Appels clients et échanges apporteurs réservés via Calendly — la pastille dit à qui s'adresse chaque rendez-vous."
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

  // Le filtre de public SUIT l'utilisateur d'une vue à l'autre, et la vue suit
  // le changement de public : sinon chaque clic en défait un autre.
  const choixPublic: ReadonlyArray<{ value: string; label: string; cible?: PublicRdv }> = [
    { value: "tous", label: "Tous" },
    { value: "clients", label: "Clients", cible: "clients" },
    { value: "apporteurs", label: "Apporteurs", cible: "apporteurs" },
  ];
  const tabs = (
    <div className="flex flex-wrap gap-[var(--space-admin-4)]">
      <AdminFilterTabs
        label="Vue"
        current={vue}
        options={[
          { value: "jour", label: "Jour", href: lien(base, { public: publicRdv }) },
          { value: "liste", label: "Liste", href: lien(base, { vue: "liste", public: publicRdv }) },
          {
            value: "calendrier",
            label: "Calendrier",
            href: lien(base, { vue: "calendrier", public: publicRdv }),
          },
        ]}
      />
      <AdminFilterTabs
        label="Public"
        current={publicRdv ?? "tous"}
        options={choixPublic.map(({ value, label, cible }) => ({
          value,
          label,
          href: lien(base, {
            vue: vue === "jour" ? undefined : vue,
            public: cible,
            year: vue === "calendrier" ? sp["year"] : undefined,
            month: vue === "calendrier" ? sp["month"] : undefined,
            date: vue === "liste" ? undefined : sp["date"],
          }),
        }))}
      />
    </div>
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
    const byDay = await getRdvMonth(year, month, optionsPublic);
    const monthTotal = [...byDay.values()].reduce((n, a) => n + a.length, 0);

    const days: MonthGridDay[] = [...byDay.entries()].map(([dayKey, arr]) => ({
      dayKey,
      count: arr.length,
      href: lien(base, { vue: "calendrier", public: publicRdv, year, month, date: dayKey }),
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
            href={lien(base, { vue: "calendrier", public: publicRdv, year: prev.y, month: prev.m })}
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
          >
            {MONTHS[prev.m - 1]}
          </AdminButton>
          <AdminButton
            href={lien(base, { vue: "calendrier", public: publicRdv })}
            variant="ghost"
            size="sm"
          >
            Aujourd&apos;hui
          </AdminButton>
          <AdminButton
            href={lien(base, { vue: "calendrier", public: publicRdv, year: next.y, month: next.m })}
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
                  <LigneRdv key={r.key} r={r} />
                ))}
              </ul>
            )}
          </div>
        )}
      </>
    );
  }

  // ── Vue jour (par défaut) ─────────────────────────────────────────────────
  //
  // Lit le mois du jour demandé et n'en garde que ce jour : c'est la même
  // requête que le calendrier, donc les deux vues ne peuvent pas diverger sur
  // ce qu'elles comptent.
  if (vue === "jour") {
    const aujourdhui = dayKeyInParis(new Date());
    const jour = lireJour(sp["date"]) ?? aujourdhui;
    const [anneeJour = 1970, moisJour = 1] = jour.split("-").map(Number);
    const rdvJour = (await getRdvMonth(anneeJour, moisJour, optionsPublic)).get(jour) ?? [];
    const veille = decalerJour(jour, -1);
    const lendemain = decalerJour(jour, 1);

    return (
      <>
        {header}
        <div className="mb-[var(--space-admin-4)]">{tabs}</div>
        {banner}

        <div className="mt-[var(--space-admin-4)] mb-[var(--space-admin-4)] flex flex-wrap items-center gap-2">
          <AdminButton
            href={lien(base, { public: publicRdv, date: veille })}
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
          >
            {formatDateFrShort(veille)}
          </AdminButton>
          <AdminButton href={lien(base, { public: publicRdv })} variant="ghost" size="sm">
            Aujourd&apos;hui
          </AdminButton>
          <AdminButton
            href={lien(base, { public: publicRdv, date: lendemain })}
            variant="ghost"
            size="sm"
            iconAfter={ArrowRight}
          >
            {formatDateFrShort(lendemain)}
          </AdminButton>
        </div>

        <h2 className="admin-h2">
          {jour === aujourdhui ? "Aujourd'hui," : "Rendez-vous du"} {formatDateFrShort(jour)} ·{" "}
          {rdvJour.length} rendez-vous
        </h2>
        {rdvJour.length === 0 ? (
          <p className="text-[color:var(--color-admin-fg-muted)]">Aucun rendez-vous ce jour.</p>
        ) : (
          <ul className="mt-[var(--space-admin-3)] space-y-2">
            {rdvJour.map((r) => (
              <LigneRdv key={r.key} r={r} />
            ))}
          </ul>
        )}
      </>
    );
  }

  // ── Vue liste ─────────────────────────────────────────────────────────────
  const page = sp["page"] ? parseInt(sp["page"], 10) : 1;
  const { rows, total } = await listRendezVous({
    page,
    pageSize: PAGE_SIZE,
    ...optionsPublic,
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
    { key: "public", header: "Public", cell: (r) => <PastillePublic titre={r.title} /> },
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
    {
      key: "format",
      header: INTITULE_FORMAT,
      cell: (r) => <PastilleFormat format={r.format} />,
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
        // `vue` et `public` voyagent avec la page : sans eux, « page 2 »
        // ramènerait sur la vue Jour, désormais celle par défaut.
        preservedParams={{
          vue: "liste",
          public: publicRdv,
          status: sp["status"],
          q: sp["q"],
          from: sp["from"],
          to: sp["to"],
        }}
      />
    </>
  );
}
