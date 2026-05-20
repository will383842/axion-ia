// Liste devis admin (Sprint A — UI admin devis).
//
// Tableau paginé 25/page. Filtres : status (draft/sent/accepted/declined/expired).
// Lien détail [id] pour actions admin.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DevisV2 } from "./_v2/DevisV2";
import type { QuoteStatus } from "../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté (signé)",
  declined: "Refusé",
  expired: "Expiré",
};

const STATUS_FILTERS: { value: QuoteStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "sent", label: "Envoyés" },
  { value: "accepted", label: "Acceptés" },
  { value: "declined", label: "Refusés" },
  { value: "expired", label: "Expirés" },
];

const PAGE_SIZE = 25;

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function DevisListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return <DevisV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

