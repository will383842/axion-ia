/**
 * Admin — Qualiopi · Nouvelle facture directe (Hub facturation).
 *
 * Émet une facture LIBRE (sans devis) rattachée à un client CRM. Server
 * Component — auth + redirect, force-dynamic, noindex. Gaté par le même flag
 * que le Hub (`FACTURATION_HUB_ENABLED`). Monte `FactureLibreForm`.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { isFacturationHubEnabled } from "@/server/qualiopi/config/flag";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { FactureLibreForm } from "@/components/admin/qualiopi/FactureLibreForm";
import { listClients } from "@/server/qualiopi/crm/clients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouvelle facture | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiFactureNewPage({ params }: PageProps) {
  if (!isFacturationHubEnabled()) notFound();
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const clients = await listClients();
  const clientOptions = clients.map((c) => ({
    id: c.id,
    numero: c.numero,
    raisonSociale: c.raisonSociale,
  }));

  const basePath = `/${locale}/${adminPrefix}/qualiopi/facturation`;

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={basePath}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
        >
          ← Retour au Hub facturation
        </Link>
      </div>

      <AdminPageHeader
        title="Nouvelle facture directe"
        description="Émettez une facture sans devis pour l'une des 5 activités. Le numéro est alloué automatiquement (AXI-FACT-AAAA-NNN) ; l'activité pilote le régime de TVA."
      />

      <FactureLibreForm clients={clientOptions} basePath={basePath} />
    </AdminPageShell>
  );
}
