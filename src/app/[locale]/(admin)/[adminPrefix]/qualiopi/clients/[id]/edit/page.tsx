/**
 * Admin — Qualiopi · Édition d'une fiche client.
 *
 * 🔴 Cette page manquait. Il n'existait que `clients/new` et la liste : une fois
 * un client créé, son CONTACT était figé. Or `updateClientAction` acceptait
 * depuis toujours `contactNom`, `contactEmail`, `contactTelephone`,
 * `contactFonction`, `raisonSociale`, `siret`, `nafCode` et `adresse` — seul
 * `ClientBrancheForm` l'appelait, avec trois champs sans rapport (IDCC, taille,
 * OPCO).
 *
 * Conséquence : une faute de frappe sur l'adresse de contact bloquait tout le
 * circuit commercial (`devis.ts` refuse d'émettre un lien de signature sans
 * `contactEmail`) sans aucun moyen de la corriger depuis l'interface.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { ClientEditForm } from "@/components/admin/qualiopi/ClientEditForm";
import { getClient } from "@/server/qualiopi/crm/clients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Modifier un client | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function ModifierClientPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const client = await getClient(id);
  if (!client) notFound();

  const base = `/${locale}/${adminPrefix}/qualiopi/clients`;

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={base}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Clients
        </Link>
      </div>

      <AdminPageHeader
        title={`Modifier ${client.raisonSociale}`}
        description={`${client.numero} — identité et contact. La branche (IDCC, taille, OPCO) se modifie depuis la liste des clients.`}
      />

      <ClientEditForm
        clientId={client.id}
        estParticulier={client.type === "particulier"}
        retourHref={base}
        initial={{
          raisonSociale: client.raisonSociale,
          // `?? ""` partout : le formulaire travaille en chaînes et compare au
          // trim pour décider quoi transmettre. Un `null` rendu tel quel dans un
          // input le rendrait non contrôlé.
          siret: client.siret ?? "",
          nafCode: client.nafCode ?? "",
          adresse: client.adresse ?? "",
          contactNom: client.contactNom ?? "",
          contactEmail: client.contactEmail ?? "",
          contactTelephone: client.contactTelephone ?? "",
          contactFonction: client.contactFonction ?? "",
        }}
        initialFlags={{ penalitesRetardActives: client.penalitesRetardActives }}
      />
    </AdminPageShell>
  );
}
