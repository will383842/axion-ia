/**
 * Admin — Qualiopi · Nouveau stagiaire (R10).
 */

import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { TraineeForm } from "@/components/admin/qualiopi/TraineeForm";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { listClients } from "@/server/qualiopi/crm/clients";
import { gardePage } from "@/server/auth/garde-page";

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
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/stagiaires`;

  // 🔴 F1 — les clients existants alimentent le champ « Entreprise ».
  //
  // Sans cette liste, l'entreprise est une SECONDE saisie libre du fait déjà
  // saisi sur la fiche client, et les deux divergent — « SCI Invest Sun » /
  // « SCI INVEST SUN » sont alors deux entreprises pour un lecteur. Chargée
  // ici, côté serveur : le formulaire est un composant client et n'a aucun
  // accès à la base.
  const clients = (await listClients()).map((c) => ({
    id: c.id,
    numero: c.numero,
    raisonSociale: c.raisonSociale,
  }));

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau stagiaire"
        description="PII protégées. Le détail handicap est chiffré côté serveur (jamais en clair)."
      />
      <TraineeForm mode="create" baseHref={base} clients={clients} />
    </AdminPageShell>
  );
}
