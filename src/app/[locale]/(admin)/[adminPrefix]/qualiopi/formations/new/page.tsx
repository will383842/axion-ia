/**
 * Admin — Qualiopi · Nouvelle formation (T19 Cluster L1).
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 * Monte `FormationForm` en mode création.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { FormationForm } from "@/components/admin/qualiopi/FormationForm";
import { listOffres } from "@/server/qualiopi/offres/offres";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouvelle formation | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiFormationNewPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const offresWithPrice = await listOffres({ actifOnly: true });
  const offres = offresWithPrice.map((o) => ({
    id: o.offre.id,
    code: o.offre.code,
    titreFr: o.offre.titreFr,
    dureeHeuresMin: o.offre.dureeHeuresMin,
    dureeHeuresMax: o.offre.dureeHeuresMax,
  }));

  const basePath = `/${locale}/${adminPrefix}/qualiopi/formations`;

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={basePath}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
        >
          ← Retour aux formations
        </Link>
      </div>

      <AdminPageHeader
        title="Nouvelle formation"
        description="Crée une fiche formation rattachée à une offre du catalogue. Le numéro de formation est alloué automatiquement."
      />

      {offres.length === 0 ? (
        <p className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]">
          Aucune offre active dans le catalogue. Activez au moins une offre avant de créer une
          formation.
        </p>
      ) : (
        <FormationForm offres={offres} basePath={basePath} />
      )}
    </AdminPageShell>
  );
}
