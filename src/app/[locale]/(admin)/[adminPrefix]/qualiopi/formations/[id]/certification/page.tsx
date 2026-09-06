/**
 * Admin — Qualiopi · Certification RS/RNCP d&apos;une formation (T18 CLUSTER C).
 *
 * Permet de définir le type de certification (aucune / RS / RNCP), les codes,
 * le certificateur et les dates d&apos;enregistrement via `CertificationFormationForm`.
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { CertificationFormationForm } from "@/components/admin/qualiopi/CertificationFormationForm";
import { getFormationById } from "@/server/qualiopi/formations/formations";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Certification formation | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function QualiopiFormationCertificationPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const formation = await getFormationById(id);
  if (!formation) notFound();

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title={`Certification — ${formation.titre}`}
        description={`Formation ${formation.numero} · RS/RNCP, éligibilité CPF et informations de certification.`}
      />

      {/* Lien retour vers la liste formations */}
      <div className="mb-[var(--space-admin-5)]">
        {/* 🔴 2026-09-05 — ne ramenait qu'a la LISTE des formations : on
          arrivait depuis une formation precise et on ressortait a la
          racine, a charge de la retrouver. */}
        <Link
          href={`/${locale}/${adminPrefix}/qualiopi/formations/${id}`}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Retour à la formation
        </Link>
        <Link
          href={`/${locale}/${adminPrefix}/qualiopi/formations`}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
        >
          ← Retour aux formations
        </Link>
      </div>

      <CertificationFormationForm
        formationId={formation.id}
        initial={{
          certificationType:
            (formation.certificationType as "aucune" | "rs" | "rncp" | null) ?? null,
          codeRncp: formation.codeRncp ?? null,
          codeRs: formation.codeRs ?? null,
          numeroEnregistrementFc: formation.numeroEnregistrementFc ?? null,
          certificateurNom: formation.certificateurNom ?? null,
          estCertificateur: formation.estCertificateur ?? null,
          numeroHabilitation: formation.numeroHabilitation ?? null,
          dateEnregistrementCertif: formation.dateEnregistrementCertif ?? null,
          dateEcheanceCertif: formation.dateEcheanceCertif ?? null,
          cpfEligible: formation.cpfEligible ?? null,
        }}
      />
    </AdminPageShell>
  );
}
