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
import { headers } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DashboardV2Wrapper } from "./_v2/DashboardV2Wrapper";

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
    // Audit deploy-unstuck 2026-05-18 — fix admin crash "An unexpected
    // response was received from the server". Next 16 RSC client auto-prefetch
    // le parent route depuis la page login. redirect() server-side renvoie
    // 302 Found (pas du RSC), ce qui fait throw RSC client.
    // Solution : detecter le prefetch (header `Next-Router-Prefetch: 1` ou
    // `RSC: 1`) et retourner null au lieu de redirect. Le browser navigation
    // normale (sans header RSC) continue de recevoir le redirect 302.
    const hdrs = await headers();
    if (hdrs.get("next-router-prefetch") === "1" || hdrs.get("rsc") === "1") {
      return null;
    }
    redirect(`/fr/${adminPrefix}/login`);
  }

  // Refonte admin mai 2026 — bascule V2 derrière flag ADMIN_V2_ENABLED
  // (ou cookie admin_v2=1 per-session). V1 par défaut.
  const role = (session.user as { role?: string }).role ?? "—";
  return (
    <DashboardV2Wrapper
      adminPrefix={adminPrefix}
      email={session.user.email ?? null}
      role={role}
    />
  );
}

