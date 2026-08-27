/**
 * Admin — Qualiopi · Nouveau formateur (R9).
 */

import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { TrainerForm } from "@/components/admin/qualiopi/TrainerForm";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

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
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau formateur"
        description="Salarié, dirigeant-formateur ou sous-traitant. Les habilitations par formation se définissent ensuite sur la fiche."
      />
      <TrainerForm mode="create" baseHref={base} />
    </AdminPageShell>
  );
}
