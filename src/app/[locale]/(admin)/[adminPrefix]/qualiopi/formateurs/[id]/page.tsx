/**
 * Admin — Qualiopi · Fiche formateur (R9).
 * Édition identité + habilitations par formation + vérification sous-traitant + activation.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { TrainerForm } from "@/components/admin/qualiopi/TrainerForm";
import { TrainerManageForm } from "@/components/admin/qualiopi/TrainerManageForm";
import { getTrainer } from "@/server/qualiopi/trainers/trainers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Fiche formateur | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

async function listFormationsLite(): Promise<Array<{ id: string; titre: string }>> {
  try {
    return await prisma.formation.findMany({
      select: { id: true, titre: true },
      orderBy: { titre: "asc" },
    });
  } catch {
    return [];
  }
}

// « Nombre de formations faites » — calculé automatiquement (Will 2026-06-10) :
// sessions Qualiopi animées + interventions calendrier confirmées/réalisées.
// Stub-safe (build sans DB → 0).
async function getTrainerActivityCounts(
  trainerId: string,
): Promise<{ sessionsCount: number; interventionsCount: number }> {
  try {
    const [sessionsCount, interventionsCount] = await Promise.all([
      prisma.trainingSession.count({ where: { formateurPrincipalId: trainerId } }),
      prisma.booking.count({
        where: {
          formateurId: trainerId,
          status: {
            in: [
              "confirmed",
              "reminded_j7",
              "in_progress",
              "completed",
              "invoiced_balance",
              "paid_balance",
            ],
          },
        },
      }),
    ]);
    return { sessionsCount, interventionsCount };
  } catch {
    return { sessionsCount: 0, interventionsCount: 0 };
  }
}

export default async function FicheFormateurPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;
  const trainer = await getTrainer(id);
  if (!trainer) notFound();

  const formations = await listFormationsLite();
  const { sessionsCount, interventionsCount } = await getTrainerActivityCounts(trainer.id);

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader title={`${trainer.prenom} ${trainer.nom}`} description={trainer.email} />

      <div className="mb-[var(--space-admin-5)]">
        <Link href={base} className="text-[color:var(--color-admin-accent)] underline">
          ← Retour aux formateurs
        </Link>
      </div>

      <div className="admin-card mb-[var(--space-admin-5)] p-[var(--space-admin-4)]">
        <p className="admin-meta">Activité (calculée automatiquement)</p>
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
          <strong>{sessionsCount}</strong> session{sessionsCount > 1 ? "s" : ""} Qualiopi animée
          {sessionsCount > 1 ? "s" : ""} · <strong>{interventionsCount}</strong> intervention
          {interventionsCount > 1 ? "s" : ""} calendrier réalisée{interventionsCount > 1 ? "s" : ""}
          {" — soit "}
          <strong>{sessionsCount + interventionsCount}</strong> au total.
        </p>
      </div>

      <div className="mb-[var(--space-admin-6)]">
        <TrainerForm
          mode="edit"
          baseHref={base}
          trainerId={trainer.id}
          initial={{
            nom: trainer.nom,
            prenom: trainer.prenom,
            email: trainer.email,
            telephone: trainer.telephone,
            statut: trainer.statut,
            region: trainer.region,
            tarifJourneeHtCents: trainer.tarifJourneeHtCents,
            sousTraitantNda: trainer.sousTraitantNda,
          }}
        />
      </div>

      <TrainerManageForm
        trainerId={trainer.id}
        statut={trainer.statut}
        actif={trainer.actif}
        sousTraitantVerifie={trainer.sousTraitantVerifieAt != null}
        sousTraitantNda={trainer.sousTraitantNda}
        formations={formations}
        habilitations={trainer.formationsHabilitees}
      />
    </AdminPageShell>
  );
}
