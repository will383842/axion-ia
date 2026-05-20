// Liste factures admin (Sprint X.10 — Booking V1).
//
// Spec : _AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/04-PLAN-EXECUTION.md §X.10
//        Admin UI /admin/factures
//
// V1 livré
//   - Liste paginée 25/page
//   - Filtres par status (draft/issued/partially_paid/paid/overdue/cancelled)
//     et par type (deposit/balance/installment/full/credit_note)
//   - Tri par issuedAt desc
//   - Colonnes : N° / Date / Client / Type / Status / Montant TTC / Échéance / Action
//
// V1.5 reporté (X.10b)
//   - Export CSV mensuel
//   - Filtre par période issuedAt
//   - Search par number / payer

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FacturesV2 } from "./_v2/FacturesV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function FacturesListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <FacturesV2 adminPrefix={adminPrefix} searchParams={sp} />;
}
