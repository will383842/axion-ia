// Listing options 48h admin (M9 Tier 1 section 2).
//
// Filtre status URL param. Sort par status (pending d'abord) puis expiresAt
// croissant pour mettre les plus urgentes en haut. Affiche countdown 48h.

import { listOptionsAction } from "@/features/admin-options/actions";
import { OptionsV2 } from "./_v2/OptionsV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  refused: "Refusée",
  expired: "Expirée",
  converted: "Validée → réservation",
};

function formatExpiry(expiresAt: Date, status: string): string {
  if (status !== "pending") return "—";
  const now = Date.now();
  const diffMs = expiresAt.getTime() - now;
  if (diffMs <= 0) return "Expirée à l'instant";
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  if (hours > 24) return `Dans ${Math.floor(hours / 24)}j ${hours % 24}h`;
  return `Dans ${hours}h ${minutes}min`;
}

function expiryUrgency(expiresAt: Date, status: string): string {
  if (status !== "pending") return "";
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return "admin-urgency-critical";
  if (diffMs < 12 * 3600000) return "admin-urgency-high";
  if (diffMs < 24 * 3600000) return "admin-urgency-medium";
  return "";
}

export default async function OptionsListPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;

  return <OptionsV2 adminPrefix={adminPrefix} searchParams={sp} />;
}

