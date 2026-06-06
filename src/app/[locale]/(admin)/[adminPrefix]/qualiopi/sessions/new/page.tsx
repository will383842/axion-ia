/**
 * Admin — Qualiopi · Création d&apos;une session de formation (T19 Cluster L2).
 *
 * Charge la liste des formations publiées et actives + la liste des clients
 * depuis la base, puis monte SessionForm (Client Component).
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { SessionForm } from "@/components/admin/qualiopi/SessionForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouvelle session | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function NouvelleSessionPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  // Charger les formations publiées et actives
  let formations: Array<{ id: string; titre: string; numero: string }> = [];
  try {
    formations = await prisma.formation.findMany({
      where: { statut: "actif", statutGeneration: "publie" },
      select: { id: true, titre: true, numero: true },
      orderBy: { titre: "asc" },
    });
  } catch {
    formations = [];
  }

  // Charger les clients (optionnel, fail-soft)
  let clients: Array<{ id: string; raisonSociale: string; numero: string }> = [];
  try {
    clients = await prisma.client.findMany({
      select: { id: true, raisonSociale: true, numero: true },
      orderBy: { raisonSociale: "asc" },
    });
  } catch {
    clients = [];
  }

  const sessionsListUrl = `/${locale}/${adminPrefix}/qualiopi/sessions`;

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={sessionsListUrl}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Sessions
        </Link>
      </div>

      <AdminPageHeader
        title="Nouvelle session"
        description="Planifiez une session de formation simple ou créez une série récurrente."
      />

      <SessionForm
        formations={formations}
        clients={clients}
        redirectAfterCreate={sessionsListUrl}
      />
    </AdminPageShell>
  );
}
