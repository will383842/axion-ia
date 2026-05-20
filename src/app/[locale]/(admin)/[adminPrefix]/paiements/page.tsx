// Admin Paiements (Sprint X.11 — Booking V1).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.11
//
// V1 livré
//   - Tableau global paiements (filtré status/provider/period)
//   - Section "Trésorerie" — KPIs encaissé / en attente / retards
//   - Lien export CSV (vue /paiements/export)
//   - Lien fiche détail booking depuis chaque ligne
//
// V1.5 reporté (X.11b)
//   - Fiche détail booking inline (timeline échéancier 4 profils)
//     [pour l'instant, drill-down vers /reservations/[id] + /factures/[id]]
//   - Réconciliation Stripe ↔ banque
//   - Graphique 12 mois revenus

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PaiementsV2 } from "./_v2/PaiementsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function PaiementsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <PaiementsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
