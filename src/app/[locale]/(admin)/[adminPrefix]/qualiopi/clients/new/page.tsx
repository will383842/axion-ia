/**
 * Admin — Qualiopi · Nouveau client (entreprise B2B ou particulier B2C, R-B2C).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { ClientForm } from "@/components/admin/qualiopi/ClientForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouveau client | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function NouveauClientPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/clients`;

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau client"
        description="Entreprise (B2B) ou particulier (B2C, ex. CPF perso). Les champs entreprise sont masqués pour un particulier."
      />
      <ClientForm baseHref={base} />
    </AdminPageShell>
  );
}
