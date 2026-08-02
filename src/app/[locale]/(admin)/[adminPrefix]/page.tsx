// Accueil admin — TABLEAU DE BORD DE PILOTAGE (refonte console phase 3,
// audit UX 2026-08-01). La page ne fait que l'auth + le garde-fou prefetch ;
// tout le contenu est rendu par le wrapper `DashboardV2Wrapper`, qui assemble
// les données via `src/server/admin/pilotage-dashboard.ts` (stub-safe ADR 0026).
//
// Le sélecteur de période du dashboard est un querystring `?periode=semaine|
// mois|annee` (liens serveur, zéro JS client) — d'où le `searchParams`.

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { parsePeriode } from "@/server/admin/pilotage-dashboard";
import { DashboardV2Wrapper } from "./_v2/DashboardV2Wrapper";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminDashboardPage({ params, searchParams }: PageProps) {
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

  const role = (session.user as { role?: string }).role ?? "—";
  const sp = await searchParams;
  const periode = parsePeriode(sp["periode"]);
  return <DashboardV2Wrapper adminPrefix={adminPrefix} role={role} periode={periode} />;
}
