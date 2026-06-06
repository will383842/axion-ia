/**
 * Admin — Qualiopi · Nouveau devis (T19 Cluster E4a).
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 * Monte `DevisForm` avec la liste des clients CRM et des offres actives.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { DevisForm } from "@/components/admin/qualiopi/DevisForm";
import { listClients } from "@/server/qualiopi/crm/clients";
import { listOffres } from "@/server/qualiopi/offres/offres";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouveau devis | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiDevisNewPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const [clients, offresWithPrice] = await Promise.all([
    listClients(),
    listOffres({ actifOnly: true }),
  ]);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    numero: c.numero,
    raisonSociale: c.raisonSociale,
  }));

  const offreOptions = offresWithPrice.map((o) => ({
    tierId: o.offre.tierId,
    code: o.offre.code,
    titreFr: o.offre.titreFr,
    prixLabelFr: o.prixLabelFr,
  }));

  const basePath = `/${locale}/${adminPrefix}/qualiopi/devis`;

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={basePath}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
        >
          ← Retour aux devis
        </Link>
      </div>

      <AdminPageHeader
        title="Nouveau devis"
        description="Créez un devis commercial formation. Le numéro est alloué automatiquement (AXI-DEV-AAAA-NNN). TVA exonérée 261-4-4° CGI."
      />

      <DevisForm clients={clientOptions} offres={offreOptions} basePath={basePath} />
    </AdminPageShell>
  );
}
