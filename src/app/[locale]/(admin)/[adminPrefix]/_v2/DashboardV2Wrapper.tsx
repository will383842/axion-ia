// Refonte admin mai 2026 — PR 6 — Wrapper Dashboard V2 (fetch + render).
//
// Nettoyage 2026-07-09 (audit vestiges booking) :
//   Ce wrapper lançait 17 requêtes en parallèle à chaque ouverture de l'accueil
//   admin, dont 13 sur les tables de l'ancien flux de réservation payante
//   (bookingOption ×2, booking ×5, payment ×3, invoice ×1). Ce flux est éteint
//   (Calendly a remplacé le créneau public, Stripe est neutralisé) : ces
//   requêtes renvoyaient invariablement 0 / [] et alimentaient des blocs vides.
//   Restent les 4 requêtes réellement utiles. Les helpers de dates et
//   `fmtEur` / `customerName` / `interventionTypeLabel`, devenus sans usage,
//   ont été retirés avec elles.

import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { compterQualiopiNav, COMPTEURS_VIDES } from "@/server/admin/qualiopi-nav-counts";
import { DashboardV2 } from "./DashboardV2";

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
  const [totalSubmissions, totalArticles, totalSubscribers, activityRows, aTraiter] =
    await Promise.all([
      prisma.submission.count(),
      prisma.article.count({ where: { status: "published" } }),
      prisma.newsletterSubscriber.count({ where: { status: "confirmed" } }),
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
      // Refonte UI 2026-08-01 (couche 4) — même source que la pastille de la
      // navigation, pour qu'un compteur ne puisse jamais contredire l'autre.
      // Fail-soft : une base indisponible ne doit pas faire tomber l'accueil.
      compterQualiopiNav().catch(() => COMPTEURS_VIDES),
    ]);

  return (
    <DashboardV2
      adminPrefix={adminPrefix}
      email={email}
      role={role}
      logoutAction={logoutAction}
      kpis={{
        totalSubmissions,
        totalArticles,
        totalSubscribers,
      }}
      aTraiter={aTraiter}
      activityRows={activityRows.map((a) => ({
        id: a.id,
        // La clé brute est transmise telle quelle : c'est `decrireAction`, côté
        // rendu, qui la traduit. Le wrapper ne fait que lire la base.
        action: a.action,
        secondary: `${a.adminUser?.email ?? "système"} · ${fmtRelative(a.createdAt)}`,
      }))}
    />
  );
}
