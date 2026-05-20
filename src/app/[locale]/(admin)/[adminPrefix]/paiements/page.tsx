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

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaiementsV2 } from "./_v2/PaiementsV2";
import type {
  PaymentProvider,
  PaymentStatus,
  PaymentType,
} from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "En attente",
  processing: "En traitement",
  succeeded: "Succès",
  failed: "Échoué",
  refunded: "Remboursé",
  cancelled: "Annulé",
};

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  manual_wire: "Virement",
  manual_check: "Chèque",
  manual_cash: "Espèces",
};

const TYPE_LABELS: Record<PaymentType, string> = {
  deposit: "Acompte",
  installment_2: "Tranche 2",
  installment_3: "Tranche 3",
  balance: "Solde",
  refund: "Remboursement",
};

const PAGE_SIZE = 30;

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatEur(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(1);
  return r;
}

export default async function PaiementsPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <PaiementsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

