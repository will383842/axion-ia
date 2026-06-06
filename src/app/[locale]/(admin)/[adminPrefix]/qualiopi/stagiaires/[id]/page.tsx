/**
 * Admin — Qualiopi · Fiche stagiaire (R10).
 * Édition identité + handicap (write-only chiffré) + consentements.
 * Le détail handicap chiffré n'est jamais déchiffré ni affiché ici (RGPD).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { TraineeForm } from "@/components/admin/qualiopi/TraineeForm";
import { getTrainee } from "@/server/qualiopi/trainees/trainees";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Fiche stagiaire | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function FicheStagiairePage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/stagiaires`;
  const trainee = await getTrainee(id);
  if (!trainee) notFound();

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader title={`${trainee.prenom} ${trainee.nom}`} description={trainee.email} />

      <div className="mb-[var(--space-admin-5)]">
        <Link href={base} className="text-[color:var(--color-admin-accent)] underline">
          ← Retour aux stagiaires
        </Link>
      </div>

      <TraineeForm
        mode="edit"
        baseHref={base}
        traineeId={trainee.id}
        initial={{
          nom: trainee.nom,
          prenom: trainee.prenom,
          email: trainee.email,
          telephone: trainee.telephone,
          entreprise: trainee.entreprise,
          fonction: trainee.fonction,
          situationHandicap: trainee.situationHandicap,
          consentementFormation: trainee.consentementFormation,
          consentementEmail: trainee.consentementEmail,
          handicapDetailsPresent: trainee.handicapDetailsChiffre != null,
        }}
      />
    </AdminPageShell>
  );
}
