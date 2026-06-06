/**
 * Admin — Qualiopi · Nouveau formateur (R9).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { TrainerForm } from "@/components/admin/qualiopi/TrainerForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouveau formateur | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function NouveauFormateurPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau formateur"
        description="Salarié ou sous-traitant. Les habilitations par formation se définissent ensuite sur la fiche."
      />
      <TrainerForm mode="create" baseHref={base} />
    </AdminPageShell>
  );
}
