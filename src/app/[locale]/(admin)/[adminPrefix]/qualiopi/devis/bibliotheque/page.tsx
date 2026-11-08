/**
 * Admin — Qualiopi · Bibliothèque des textes du devis à formules.
 * Server Component — garde d'écriture, force-dynamic, noindex. 404 tant que l'interrupteur
 * `qualiopi.devis_formules.actif` est éteint.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { BibliothequeTextesDevis } from "@/components/admin/qualiopi/BibliothequeTextesDevis";
import { gardePage } from "@/server/auth/garde-page";
import { listerTextesAction } from "@/server/actions/qualiopi/devis-bibliotheque";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Textes des devis à formules | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiDevisBibliothequePage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!(await formulesActives())) notFound();
  const r = await listerTextesAction();
  const textes = "data" in r ? r.data : [];

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={`/${locale}/${adminPrefix}/qualiopi/devis`}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Devis
        </Link>
      </div>
      <AdminPageHeader
        title="Textes des devis à formules"
        description="Avantages, inconvénients, prérequis et clauses copiés dans l'offre à la saisie."
      />
      <BibliothequeTextesDevis textes={textes} />
    </AdminPageShell>
  );
}
