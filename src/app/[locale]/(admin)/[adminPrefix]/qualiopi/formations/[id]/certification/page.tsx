/**
 * Admin — Qualiopi · Certification RS/RNCP d&apos;une formation (T18 CLUSTER C).
 *
 * Permet de définir le type de certification (aucune / RS / RNCP), les codes,
 * le certificateur et les dates d&apos;enregistrement via `CertificationFormationForm`.
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { CertificationFormationForm } from "@/components/admin/qualiopi/CertificationFormationForm";
import { getFormationById } from "@/server/qualiopi/formations/formations";

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
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
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
