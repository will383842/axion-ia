/**
 * Admin — Qualiopi · Rapprochement bancaire (Hub facturation), v1 Finom.
 *
 * Import d'un export CSV Finom, suggestions de rapprochement contre les
 * factures ouvertes, encaissement ligne à ligne via l'action existante
 * (`enregistrerPaiementFactureAction`). Aucune persistance du relevé.
 *
 * Server Component — auth + redirect, force-dynamic, noindex. Gaté par
 * `FACTURATION_HUB_ENABLED` (même gate que le Hub). Écriture uniquement :
 * l'écran n'existe que pour ENCAISSER, il est réservé à admin/super_admin
 * (les rôles lecture du hub n'y feraient que des clics refusés au serveur).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { isFacturationHubEnabled } from "@/server/qualiopi/config/flag";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { RapprochementReleve } from "@/components/admin/qualiopi/RapprochementReleve";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Rapprochement bancaire | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiRapprochementPage({ params }: PageProps) {
  if (!isFacturationHubEnabled()) notFound();
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const basePath = `/${locale}/${adminPrefix}/qualiopi/facturation`;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={basePath}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
        >
          ← Retour au Hub facturation
        </Link>
      </div>

      <AdminPageHeader
        title="Rapprochement bancaire"
        description="Import de l'export CSV Finom : chaque encaissement du relevé est rapproché d'une facture ouverte, puis enregistré d'un clic confirmé. Le relevé n'est pas conservé."
      />

      <RapprochementReleve />
    </AdminPageShell>
  );
}
