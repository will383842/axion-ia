/**
 * Admin — Qualiopi · Nouveau stagiaire (R10).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { TraineeForm } from "@/components/admin/qualiopi/TraineeForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouveau stagiaire | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function NouveauStagiairePage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/stagiaires`;

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau stagiaire"
        description="PII protégées. Le détail handicap est chiffré côté serveur (jamais en clair)."
      />
      <TraineeForm mode="create" baseHref={base} />
    </AdminPageShell>
  );
}
