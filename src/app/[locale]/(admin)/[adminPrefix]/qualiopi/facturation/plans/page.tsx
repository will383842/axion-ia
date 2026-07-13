/**
 * Admin — Qualiopi · Plans de facturation récurrents (Hub facturation).
 *
 * Liste les plans + leurs factures brouillon générées par le cron, et permet
 * de créer un plan, changer son statut, et émettre les brouillons. Server
 * Component — auth + redirect, force-dynamic, noindex. Gaté par
 * `FACTURATION_HUB_ENABLED`. Monte `PlansRecurrentsPanel`.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFacturationHubEnabled } from "@/server/qualiopi/config/flag";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { PlansRecurrentsPanel } from "@/components/admin/qualiopi/PlansRecurrentsPanel";
import type { PlanItem } from "@/components/admin/qualiopi/PlansRecurrentsPanel";
import { listClients } from "@/server/qualiopi/crm/clients";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Plans récurrents | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function QualiopiPlansRecurrentsPage({ params }: PageProps) {
  if (!isFacturationHubEnabled()) notFound();
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  const rolesAutorises = ["admin", "super_admin", "editor", "reader"];
  if (!session?.user || !rolesAutorises.includes(role ?? "")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const peutEcrire = role === "admin" || role === "super_admin";

  const [plans, clients] = await Promise.all([
    prisma.planRecurrent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        activite: true,
        statut: true,
        periodiciteMois: true,
        prochaineGenerationAt: true,
        finAt: true,
        nbMaxFactures: true,
        client: { select: { raisonSociale: true } },
        factures: {
          select: {
            id: true,
            numero: true,
            statut: true,
            montantTtcCents: true,
            montantHtCents: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    listClients(),
  ]);

  const planItems: PlanItem[] = plans.map((p) => ({
    id: p.id,
    clientRaisonSociale: p.client?.raisonSociale ?? "—",
    activite: p.activite,
    statut: p.statut,
    periodiciteMois: p.periodiciteMois,
    prochaineGenerationAt: p.prochaineGenerationAt.toISOString(),
    finAt: p.finAt ? p.finAt.toISOString() : null,
    nbMaxFactures: p.nbMaxFactures,
    nbFacturesGenerees: p.factures.length,
    brouillons: p.factures
      .filter((f) => f.statut === "brouillon")
      .map((f) => ({
        id: f.id,
        numero: f.numero,
        montantTtcCents: f.montantTtcCents ?? f.montantHtCents,
      })),
  }));

  const clientOptions = clients.map((c) => ({
    id: c.id,
    numero: c.numero,
    raisonSociale: c.raisonSociale,
  }));

  const basePath = `/${locale}/${adminPrefix}/qualiopi/facturation`;

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={basePath}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline"
        >
          ← Retour au Hub facturation
        </Link>
      </div>

      <AdminPageHeader
        title="Plans de facturation récurrents"
        description="Abonnements et prestations récurrentes : le cron génère des factures en brouillon à échéance ; vous les émettez d'un clic (le régime de TVA est re-figé à l'émission)."
      />

      <PlansRecurrentsPanel plans={planItems} clients={clientOptions} canWrite={peutEcrire} />
    </AdminPageShell>
  );
}
