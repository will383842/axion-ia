// Dashboard admin (Sprint X.14 — Booking V1 V2).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §Sprint X.14
// + 03-ARCHITECTURE-CIBLE.md §5.4 — section dashboard "Prêts à valider" D49.
//
// Périmètre V1 livré ici (P0) :
//   - KPIs 3 lignes : aujourd'hui / cette semaine / ce mois
//   - Section "Prêts à valider" (D49 — status=awaiting_admin_validation)
//   - Section "En attente client" (status=contract_payment_sent)
//   - Section "Demandes options" (status=option_pending — parcours A à valider)
//   - Section "Cadrages à venir" (status=cadrage_scheduled)
//   - Section "Activité récente" (5 ActivityLog)
//
// P1 reportés Sprint X.14b : Cmd+K palette, mobile drawer, breadcrumbs,
//   keyboard shortcuts globaux, heatmap link X.9, chart revenus 12 mois link X.11.

import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

async function logoutAction() {
  "use server";
  await signOut({ redirect: false });
  const adminPrefix = process.env.ADMIN_URL_PREFIX ?? "admin-dev-x7k2n9";
  redirect(`/fr/${adminPrefix}/login`);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day; // ISO lundi
  r.setDate(r.getDate() + diff);
  return r;
}
function startOfMonth(d: Date): Date {
  const r = startOfDay(d);
  r.setDate(1);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatEur(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return "0 €";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatRelative(d: Date | null | undefined): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `il y a ${diffD} j`;
  return formatDate(d);
}

export default async function AdminDashboardPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const monthStart = startOfMonth(now);
  const monthEnd = endOfDay(addDays(monthStart, 30));

  const [
    pendingOptions,
    pendingValidation,
    cadragesUpcoming,
    paymentsTodayCount,
    paymentsTodayAmount,
    bookingsWeek,
    bookingsMonth,
    revenuesMonth,
    invoicesOverdue,
    totalSubmissions,
    totalArticles,
    totalSubscribers,
    readyToValidate,
    waitingClientRows,
    pendingOptionRows,
    cadrageRows,
    activityRows,
  ] = await Promise.all([
    prisma.bookingOption.count({ where: { status: "pending" } }),
    prisma.booking.count({ where: { status: "awaiting_admin_validation" } }),
    prisma.booking.count({
      where: {
        status: "cadrage_scheduled",
        cadrageMeeting: { scheduledAt: { gte: today, lte: addDays(today, 7) } },
      },
    }),
    prisma.payment.count({
      where: { paidAt: { gte: today, lt: tomorrow }, status: "succeeded" },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: today, lt: tomorrow }, status: "succeeded" },
      _sum: { amountCents: true },
    }),
    prisma.booking.count({
      where: { bookingDate: { gte: weekStart, lte: weekEnd }, status: "confirmed" },
    }),
    prisma.booking.count({
      where: { bookingDate: { gte: monthStart, lte: monthEnd }, status: "confirmed" },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: monthStart, lte: monthEnd }, status: "succeeded" },
      _sum: { amountCents: true },
    }),
    prisma.invoice.count({
      where: { status: { in: ["issued", "partially_paid", "overdue"] }, dueAt: { lt: today } },
    }),
    prisma.submission.count(),
    prisma.article.count({ where: { status: "published" } }),
    prisma.newsletterSubscriber.count({ where: { status: "confirmed" } }),
    prisma.booking.findMany({
      where: { status: "awaiting_admin_validation" },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: {
        id: true,
        bookingDate: true,
        interventionType: true,
        depositPaidAt: true,
        basePriceHtCents: true,
        fromSubmission: { select: { companyName: true } },
        submission: { select: { companyName: true } },
      },
    }),
    prisma.booking.findMany({
      where: { status: "contract_payment_sent" },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: {
        id: true,
        bookingDate: true,
        interventionType: true,
        updatedAt: true,
        fromSubmission: { select: { companyName: true } },
        submission: { select: { companyName: true } },
      },
    }),
    prisma.bookingOption.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: {
        id: true,
        companyName: true,
        interventionType: true,
        createdAt: true,
        expiresAt: true,
        slot: { select: { slotDate: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        status: "cadrage_scheduled",
        cadrageMeeting: { scheduledAt: { gte: today, lte: addDays(today, 14) } },
      },
      orderBy: { cadrageMeeting: { scheduledAt: "asc" } },
      take: 5,
      select: {
        id: true,
        interventionType: true,
        cadrageMeeting: { select: { scheduledAt: true } },
        submission: { select: { companyName: true } },
        fromSubmission: { select: { companyName: true } },
      },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        adminUser: { select: { email: true } },
      },
    }),
  ]);

  const role = (session?.user as { role?: string } | null)?.role ?? "—";
  const base = `/fr/${adminPrefix}`;

  function customerName(b: {
    submission?: { companyName?: string | null } | null;
    fromSubmission?: { companyName?: string | null } | null;
  }): string {
    return b.fromSubmission?.companyName ?? b.submission?.companyName ?? "—";
  }

  return (
    <section>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="admin-h1-large">Tableau de bord</h1>
          <p className="admin-meta">
            Connecté en tant que {session?.user?.email ?? "—"} · <strong>{role}</strong>
          </p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="admin-button-ghost">
            Déconnexion
          </button>
        </form>
      </div>

      {/* ── Aujourd'hui ───────────────────────────────────────────────── */}
      <h2 className="admin-h2">Aujourd&apos;hui</h2>
      <div className="admin-kpi-grid">
        <Link
          href={`${base}/reservations?status=awaiting_admin_validation`}
          className="admin-card admin-kpi-link"
        >
          <p className="admin-card-label">Prêts à valider (D49)</p>
          <p className="admin-kpi-value">{pendingValidation}</p>
        </Link>
        <Link href={`${base}/options`} className="admin-card admin-kpi-link">
          <p className="admin-card-label">Options à valider</p>
          <p className="admin-kpi-value">{pendingOptions}</p>
        </Link>
        <Link href={`${base}/calendrier`} className="admin-card admin-kpi-link">
          <p className="admin-card-label">Cadrages 7 prochains jours</p>
          <p className="admin-kpi-value">{cadragesUpcoming}</p>
        </Link>
        <Link href={`${base}/paiements`} className="admin-card admin-kpi-link">
          <p className="admin-card-label">Paiements reçus aujourd&apos;hui</p>
          <p className="admin-kpi-value">{paymentsTodayCount}</p>
          <p className="admin-meta">{formatEur(paymentsTodayAmount._sum.amountCents)}</p>
        </Link>
      </div>

      {/* ── Cette semaine / Ce mois ──────────────────────────────────── */}
      <h2 className="admin-h2">Activité</h2>
      <div className="admin-kpi-grid">
        <div className="admin-card">
          <p className="admin-card-label">Interventions cette semaine</p>
          <p className="admin-kpi-value">{bookingsWeek}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Interventions ce mois</p>
          <p className="admin-kpi-value">{bookingsMonth}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Encaissé ce mois</p>
          <p className="admin-kpi-value">{formatEur(revenuesMonth._sum.amountCents)}</p>
        </div>
        <Link href={`${base}/factures?status=overdue`} className="admin-card admin-kpi-link">
          <p className="admin-card-label">Factures en retard</p>
          <p className="admin-kpi-value">{invoicesOverdue}</p>
        </Link>
      </div>

      {/* ── Prêts à valider D49 ──────────────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">Prêts à valider sur le calendrier (D49)</h2>
        <p className="admin-meta-block">
          Acompte reçu, en attente du clic « Valider sur le calendrier ».
        </p>
        {readyToValidate.length === 0 ? (
          <p className="admin-meta-block">Aucun booking en attente — rien à faire ici.</p>
        ) : (
          <ul className="admin-meta-block">
            {readyToValidate.map((b) => (
              <li key={b.id}>
                <Link href={`${base}/reservations/${b.id}`} className="admin-link">
                  {customerName(b)} — {b.interventionType} — {formatDate(b.bookingDate)}
                </Link>{" "}
                · acompte payé {formatRelative(b.depositPaidAt)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Demandes options parcours A ──────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">Demandes options à valider</h2>
        <p className="admin-meta-block">
          Parcours A — visiteurs en attente du clic « Envoyer contrat + acompte ».
        </p>
        {pendingOptionRows.length === 0 ? (
          <p className="admin-meta-block">Aucune option en attente.</p>
        ) : (
          <ul className="admin-meta-block">
            {pendingOptionRows.map((o) => (
              <li key={o.id}>
                <Link href={`${base}/options`} className="admin-link">
                  {o.companyName} — {o.interventionType}
                </Link>{" "}
                · slot {formatDate(o.slot?.slotDate)} · reçue {formatRelative(o.createdAt)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── En attente client ────────────────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">En attente du client</h2>
        <p className="admin-meta-block">
          Contrat envoyé et lien de paiement actif — pas encore d&apos;acompte reçu.
        </p>
        {waitingClientRows.length === 0 ? (
          <p className="admin-meta-block">Aucun booking en attente client.</p>
        ) : (
          <ul className="admin-meta-block">
            {waitingClientRows.map((b) => (
              <li key={b.id}>
                <Link href={`${base}/reservations/${b.id}`} className="admin-link">
                  {customerName(b)} — {b.interventionType} — {formatDate(b.bookingDate)}
                </Link>{" "}
                · envoyé {formatRelative(b.updatedAt)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Cadrages à venir ─────────────────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">Cadrages à venir (14 j)</h2>
        {cadrageRows.length === 0 ? (
          <p className="admin-meta-block">Aucun cadrage planifié.</p>
        ) : (
          <ul className="admin-meta-block">
            {cadrageRows.map((b) => (
              <li key={b.id}>
                <Link href={`${base}/reservations/${b.id}`} className="admin-link">
                  {customerName(b)} — {b.interventionType}
                </Link>{" "}
                · {formatDate(b.cadrageMeeting?.scheduledAt ?? null)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Activité récente ─────────────────────────────────────────── */}
      <div className="admin-card">
        <h2 className="admin-h2">Activité récente</h2>
        {activityRows.length === 0 ? (
          <p className="admin-meta-block">Aucune activité enregistrée.</p>
        ) : (
          <ul className="admin-meta-block">
            {activityRows.map((a) => (
              <li key={a.id}>
                <strong>{a.action}</strong>
                {a.targetType ? ` · ${a.targetType}` : ""} · {a.adminUser?.email ?? "system"} ·{" "}
                {formatRelative(a.createdAt)}
              </li>
            ))}
          </ul>
        )}
        <p className="admin-meta-block">
          <Link href={`${base}/activity-logs`} className="admin-link">
            Voir tout le journal →
          </Link>
        </p>
      </div>

      {/* ── Repères contenu/engagement (compact) ─────────────────────── */}
      <div className="admin-kpi-grid">
        <div className="admin-card">
          <p className="admin-card-label">Soumissions totales</p>
          <p className="admin-kpi-value">{totalSubmissions}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Articles publiés</p>
          <p className="admin-kpi-value">{totalArticles}</p>
        </div>
        <div className="admin-card">
          <p className="admin-card-label">Abonnés newsletter</p>
          <p className="admin-kpi-value">{totalSubscribers}</p>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-h2">Ops · Monitoring</h2>
        <ul className="admin-meta-block">
          <li>
            <Link href={`${base}/infra`} className="admin-link">
              /infra
            </Link>{" "}
            — Console infra (14 outils, statut live, liens directs)
          </li>
          <li>
            <Link href={`${base}/alerts`} className="admin-link">
              /alerts
            </Link>{" "}
            — Alertes agrégées (Sentry · UptimeRobot · Coolify)
          </li>
          <li>
            <Link href={`${base}/2fa/setup`} className="admin-link">
              /2fa/setup
            </Link>{" "}
            — Activer la 2FA sur votre compte
          </li>
        </ul>
      </div>
    </section>
  );
}
