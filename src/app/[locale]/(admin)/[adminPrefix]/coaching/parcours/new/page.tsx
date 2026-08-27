/**
 * Admin — Coaching 1-to-1 · Création d&apos;un parcours (chantier vente phase 0).
 *
 * Point d&apos;entrée UI de `createCoachingParcoursAction` : l&apos;admin crée
 * les séances, choisit le formateur, et rattache le parcours au CRM
 * (client/devis). Charge formateurs actifs, clients et devis acceptés côté
 * serveur, puis monte CoachingParcoursForm (Client Component).
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { CoachingParcoursForm } from "@/components/admin/qualiopi/CoachingParcoursForm";
import { COACHING_INTERVENTIONS } from "@/server/formateur/coaching-options";
import { prisma } from "@/lib/prisma";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Coaching — Nouveau parcours | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  /**
   * `clientId` : le wizard « Nouvelle vente » envoie ici quand l'offre choisie
   * est un accompagnement individuel — le client déjà saisi doit suivre, sinon
   * l'admin le re-cherche et le renvoi n'est qu'un demi-service.
   */
  searchParams: Promise<{ clientId?: string }>;
}

export default async function NouveauParcoursCoachingPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  // Formateurs ACTIFS uniquement — l'action refuse un formateur inactif,
  // autant ne pas le proposer.
  let trainers: Array<{ id: string; prenom: string; nom: string }> = [];
  try {
    trainers = await prisma.trainer.findMany({
      where: { actif: true },
      select: { id: true, prenom: true, nom: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });
  } catch {
    trainers = [];
  }

  // Prestations 1-to-1 proposables : les variantes 2 jours ont été retirées de
  // la vente (2026-07-17) — elles restent au SSOT pour libeller l'historique,
  // mais un NOUVEAU parcours ne doit pas les re-proposer.
  const interventions = COACHING_INTERVENTIONS.filter((i) => !i.slug.endsWith("-2j")).map((i) => ({
    slug: i.slug,
    label: i.label,
  }));

  // Clients CRM (rattachement optionnel, fail-soft).
  let clients: Array<{ id: string; raisonSociale: string }> = [];
  try {
    clients = await prisma.client.findMany({
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
      take: 500,
    });
  } catch {
    clients = [];
  }

  // Devis rattachables : acceptés ou déjà transformés en convention — même
  // règle que l'action, qui rejette brouillon/envoyé/refusé/expiré.
  let devis: Array<{ id: string; numero: string; clientId: string }> = [];
  try {
    devis = await prisma.devis.findMany({
      where: { statut: { in: ["accepte", "transforme_convention"] } },
      select: { id: true, numero: true, clientId: true },
      orderBy: { numero: "desc" },
      take: 200,
    });
  } catch {
    devis = [];
  }

  // Le client n'est pré-sélectionné que s'il EXISTE dans la liste chargée :
  // un uuid inconnu (lien périmé, copier-coller) ne doit pas poser une valeur
  // fantôme que le <select> n'afficherait pas.
  const clientInitialId =
    sp.clientId !== undefined ? clients.find((c) => c.id === sp.clientId)?.id : undefined;

  const seancesListUrl = `/${locale}/${adminPrefix}/coaching/seances`;

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={seancesListUrl}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Séances
        </Link>
      </div>

      <AdminPageHeader
        title="Nouveau parcours 1-to-1"
        description="Axion-IA construit le parcours et affecte le formateur : planifiez les séances, désignez le bénéficiaire et rattachez le client et le devis."
      />

      <CoachingParcoursForm
        trainers={trainers}
        interventions={interventions}
        clients={clients}
        devis={devis}
        redirectAfterCreate={seancesListUrl}
        {...(clientInitialId !== undefined ? { clientInitialId } : {})}
      />
    </AdminPageShell>
  );
}
