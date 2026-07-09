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
import { getTrainerConformite } from "@/server/qualiopi/trainers/documents";
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

  // Conformité documentaire (URSSAF, NDA, RC pro…). Les manquements « bloquant »
  // empêchent d'envoyer le formateur chez un client ; les « alerte » signalent
  // une règle non tranchée (seuil URSSAF) ou une pièce à rafraîchir.
  const now = new Date();
  const conformite = await getTrainerConformite(trainer.id, now.getUTCFullYear(), now);
  const bloquants = conformite?.manquements.filter((m) => m.gravite === "bloquant") ?? [];
  const alertes = conformite?.manquements.filter((m) => m.gravite === "alerte") ?? [];

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

      {conformite !== null && (
        <div className="admin-card mb-[var(--space-admin-5)] p-[var(--space-admin-4)]">
          <p className="admin-meta">Conformité documentaire</p>

          {conformite.manquements.length === 0 ? (
            <p className="text-[length:var(--text-admin-sm)]">
              ✅ Dossier complet — aucun manquement.
            </p>
          ) : (
            <>
              <p className="text-[length:var(--text-admin-sm)]">
                {bloquants.length > 0 ? (
                  <strong>
                    ⛔ {bloquants.length} manquement{bloquants.length > 1 ? "s" : ""} bloquant
                    {bloquants.length > 1 ? "s" : ""} — ce formateur ne devrait pas être affecté.
                  </strong>
                ) : (
                  <strong>✅ Aucun manquement bloquant.</strong>
                )}
              </p>

              {bloquants.length > 0 && (
                <ul className="mt-2 space-y-1 text-[length:var(--text-admin-sm)]">
                  {bloquants.map((m) => (
                    <li key={m.code}>⛔ {m.message}</li>
                  ))}
                </ul>
              )}

              {alertes.length > 0 && (
                <ul className="mt-2 space-y-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                  {alertes.map((m) => (
                    <li key={m.code}>⚠ {m.message}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {trainer.statut === "sous_traitant" && (
            <p className="admin-meta mt-3">
              Cumul {conformite.annee} retenu pour le seuil URSSAF :{" "}
              <strong>{(conformite.montantRetenuCents / 100).toLocaleString("fr-FR")} €</strong>{" "}
              (approché sur les tarifs figés des affectations).
            </p>
          )}
        </div>
      )}

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
