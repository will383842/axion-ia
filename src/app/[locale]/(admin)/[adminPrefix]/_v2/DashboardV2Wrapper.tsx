// Wrapper du tableau de bord de pilotage (fetch + render).
//
// Refonte console phase 3 (audit UX 2026-08-01) : l'accueil admin devient un
// tableau de bord de PILOTAGE. Toute l'assemblée de données vit dans
// `getPilotageDashboard` (stub-safe ADR 0026, requêtes en Promise.all) ; ce
// wrapper n'ajoute que le journal d'activité récent et l'action de déconnexion.

import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPilotageDashboard, type PeriodePilotage } from "@/server/admin/pilotage-dashboard";
import { DashboardV2 } from "./DashboardV2";
// Refonte 2026-08-02 : `libelleAction` retombait sur la CLÉ BRUTE pour toute
// action hors de sa table (« auth.2fa.setup_started » affiché tel quel en
// production). `decrireAction` décode la STRUCTURE domaine.objet.verbe — une
// clé inconnue reste une phrase française, jamais un identifiant technique.
import { decrireAction } from "@/lib/admin/activity-labels";

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
  role: string;
  periode: PeriodePilotage;
}

async function logoutAction(): Promise<void> {
  "use server";
  await signOut({ redirect: false });
  const prefix = process.env["ADMIN_URL_PREFIX"] ?? "admin-dev-x7k2n9";
  redirect(`/fr/${prefix}/login`);
}

/** Journal d'activité récent — stub-safe (build sans DB → liste vide). */
async function lireActiviteRecente(): Promise<
  {
    id: string;
    action: string;
    targetType: string | null;
    createdAt: Date;
    adminEmail: string | null;
  }[]
> {
  try {
    const rows = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        targetType: true,
        createdAt: true,
        adminUser: { select: { email: true } },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      action: a.action,
      targetType: a.targetType,
      createdAt: a.createdAt,
      adminEmail: a.adminUser?.email ?? null,
    }));
  } catch {
    return [];
  }
}

export async function DashboardV2Wrapper({
  adminPrefix,
  role,
  periode,
}: DashboardV2WrapperProps): Promise<React.ReactElement> {
  const [dashboard, activityRows] = await Promise.all([
    getPilotageDashboard(periode, adminPrefix),
    lireActiviteRecente(),
  ]);

  return (
    <DashboardV2
      adminPrefix={adminPrefix}
      role={role}
      logoutAction={logoutAction}
      dashboard={dashboard}
      activityRows={activityRows.map((a) => {
        const { icone, texte } = decrireAction(a.action);
        return {
          id: a.id,
          icone,
          primary: texte,
          secondary: `${a.adminEmail ?? "system"} · ${fmtRelative(a.createdAt)}`,
        };
      })}
    />
  );
}
