// Refonte admin mai 2026 — PR 6 — Wrapper Dashboard V2 (fetch + render).

import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardV2 } from "./DashboardV2";

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
  const diff = day === 0 ? -6 : 1 - day;
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
function fmtEur(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return "0 €";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
function fmtRelative(d: Date | null | undefined): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `il y a ${diffD} j`;
  return fmtDate(d);
}

interface DashboardV2WrapperProps {
  adminPrefix: string;
  email: string | null;
  role: string;
}

async function logoutAction(): Promise<void> {
  "use server";
  await signOut({ redirect: false });
  const prefix = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";
  redirect(`/fr/${prefix}/login`);
}

export async function DashboardV2Wrapper({
  adminPrefix,
  email,
  role,
}: DashboardV2WrapperProps): Promise<React.ReactElement> {
  const base = `/fr/${adminPrefix}`;
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
        createdAt: true,
        adminUser: { select: { email: true } },
      },
    }),
  ]);

  function customerName(b: {
    submission?: { companyName?: string | null } | null;
    fromSubmission?: { companyName?: string | null } | null;
  }): string {
    return b.fromSubmission?.companyName ?? b.submission?.companyName ?? "—";
  }

  return (
    <DashboardV2
      adminPrefix={adminPrefix}
      email={email}
      role={role}
      logoutAction={logoutAction}
      kpis={{
        pendingValidation,
        pendingOptions,
        cadragesUpcoming,
        paymentsTodayCount,
        paymentsTodayAmount: fmtEur(paymentsTodayAmount._sum.amountCents),
        bookingsWeek,
        bookingsMonth,
        revenuesMonth: fmtEur(revenuesMonth._sum.amountCents),
        invoicesOverdue,
        totalSubmissions,
        totalArticles,
        totalSubscribers,
      }}
      readyToValidate={readyToValidate.map((b) => ({
        id: b.id,
        href: `${base}/reservations/${b.id}`,
        primary: `${customerName(b)} — ${b.interventionType} — ${fmtDate(b.bookingDate)}`,
        secondary: `· acompte payé ${fmtRelative(b.depositPaidAt)}`,
      }))}
      pendingOptionRows={pendingOptionRows.map((o) => ({
        id: o.id,
        href: `${base}/options`,
        primary: `${o.companyName} — ${o.interventionType}`,
        secondary: `· slot ${fmtDate(o.slot?.slotDate ?? null)} · reçue ${fmtRelative(o.createdAt)}`,
      }))}
      waitingClientRows={waitingClientRows.map((b) => ({
        id: b.id,
        href: `${base}/reservations/${b.id}`,
        primary: `${customerName(b)} — ${b.interventionType} — ${fmtDate(b.bookingDate)}`,
        secondary: `· envoyé ${fmtRelative(b.updatedAt)}`,
      }))}
      cadrageRows={cadrageRows.map((b) => ({
        id: b.id,
        href: `${base}/reservations/${b.id}`,
        primary: `${customerName(b)} — ${b.interventionType}`,
        secondary: `· ${fmtDate(b.cadrageMeeting?.scheduledAt ?? null)}`,
      }))}
      activityRows={activityRows.map((a) => ({
        id: a.id,
        primary: a.action,
        secondary: `${a.targetType ? `· ${a.targetType} ` : ""}· ${a.adminUser?.email ?? "system"} · ${fmtRelative(a.createdAt)}`,
      }))}
    />
  );
}
