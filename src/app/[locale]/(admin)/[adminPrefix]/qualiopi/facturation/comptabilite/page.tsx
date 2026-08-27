/**
 * Admin — Qualiopi · Comptabilité (Hub facturation) : export FEC + reprise
 * d'historique.
 *
 * - Export du Fichier des Écritures Comptables (FEC) d'un exercice
 *   (contrôle fiscal / expert-comptable) — lecture seule (rôle comptable).
 * - Import de factures historiques (CSV) pour l'exhaustivité des dashboards.
 *
 * Server Component — auth + redirect, force-dynamic, noindex. Gaté par
 * `FACTURATION_HUB_ENABLED`.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { isFacturationHubEnabled } from "@/server/qualiopi/config/flag";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { FecExportButton } from "@/components/admin/qualiopi/FecExportButton";
import { ImportFacturesHistoriqueForm } from "@/components/admin/qualiopi/ImportFacturesHistoriqueForm";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Comptabilité | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiComptabilitePage({ params }: PageProps) {
  if (!isFacturationHubEnabled()) notFound();
  const { locale, adminPrefix } = await params;
  // FEC en lecture seule (rôle comptable editor/reader) ; l'import reste écriture.
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const role = acces.role;
  // Perimetre INCHANGE (admin/super_admin), mais derive du SSOT :
  // ce drapeau vaut le niveau ENGAGEANT, pas `ROLES_ECRITURE`.
  const peutImporter = peutEngager(role, "facturer");

  const anneeCourante = new Date().getUTCFullYear();

  const basePath = `/${locale}/${adminPrefix}/qualiopi/facturation`;

  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";

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
        title="Comptabilité"
        description="Export FEC de l'exercice (contrôle fiscal / expert-comptable) et reprise d'historique des factures antérieures au système."
      />

      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Export FEC</h2>
        <FecExportButton anneeDefaut={anneeCourante} anneeMin={2020} anneeMax={anneeCourante} />
      </section>

      <section>
        <h2 className={sectionHeadCls}>Reprise d&apos;historique</h2>
        {peutImporter ? (
          <ImportFacturesHistoriqueForm />
        ) : (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            L&apos;import est réservé aux administrateurs.
          </p>
        )}
      </section>
    </AdminPageShell>
  );
}
