// Refonte admin mai 2026 — PR 6 — echeanciers V2 (liste profils).

import { prisma } from "@/lib/prisma";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminTable,
  AdminEmptyState,
  AdminBadge,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { ScheduleProfileForm } from "../ScheduleProfileForm";
import { ArchiveProfileButton } from "../ArchiveProfileButton";

interface Props {
  /** Conservé pour cohérence signature ; non utilisé actuellement (les liens
   * sont relatifs au layout admin). */
  adminPrefix: string;
  role: string;
}

function fmtEur(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

interface ProfileRow {
  id: string;
  name: string;
  slug: string;
  installments: Array<{ percentage: number; description?: string }>;
  thresholdMinCents: number | null;
  thresholdMaxCents: number | null;
  isDefault: boolean;
  updatedAt: Date;
}

export async function EcheanciersV2({
  adminPrefix: _adminPrefix,
  role,
}: Props): Promise<React.ReactElement> {
  const profilesRaw = await prisma.paymentScheduleProfile.findMany({
    where: { archivedAt: null },
    orderBy: [{ isDefault: "desc" }, { thresholdMinCents: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      installments: true,
      thresholdMinCents: true,
      thresholdMaxCents: true,
      isDefault: true,
      updatedAt: true,
    },
  });

  const profiles: ProfileRow[] = profilesRaw.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    installments: Array.isArray(p.installments)
      ? (p.installments as Array<{ percentage: number; description?: string }>)
      : [],
    thresholdMinCents: p.thresholdMinCents,
    thresholdMaxCents: p.thresholdMaxCents,
    isDefault: p.isDefault,
    updatedAt: p.updatedAt,
  }));

  const columns: ReadonlyArray<AdminTableColumn<ProfileRow>> = [
    { key: "name", header: "Nom", cell: (p) => <strong>{p.name}</strong> },
    { key: "slug", header: "Slug", cell: (p) => <code>{p.slug}</code> },
    {
      key: "tranches",
      header: "Tranches",
      cell: (p) => (
        <div className="flex flex-col gap-[var(--space-admin-1)]">
          {p.installments.map((t, i) => (
            <div
              key={i}
              className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
            >
              {t.percentage} % · {t.description ?? "—"}
            </div>
          ))}
        </div>
      ),
    },
    { key: "min", header: "Seuil min HT", cell: (p) => fmtEur(p.thresholdMinCents) },
    { key: "max", header: "Seuil max HT", cell: (p) => fmtEur(p.thresholdMaxCents) },
    {
      key: "default",
      header: "Par défaut",
      cell: (p) => (p.isDefault ? <AdminBadge tone="info">DÉFAUT</AdminBadge> : null),
    },
    {
      key: "updated",
      header: "Mise à jour",
      cell: (p) => p.updatedAt.toISOString().slice(0, 10),
    },
    ...(role === "super_admin"
      ? [
          {
            key: "actions",
            header: "Action",
            cell: (p: ProfileRow) => <ArchiveProfileButton profileId={p.id} />,
          } as AdminTableColumn<ProfileRow>,
        ]
      : []),
  ];

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Échéanciers"
        description={`${profiles.length} profil${profiles.length > 1 ? "s" : ""} actif${profiles.length > 1 ? "s" : ""}`}
      />
      <AdminCard className="mb-[var(--space-admin-7)]">
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Profils disponibles
        </h2>
        <p className="mb-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          Les profils sont sélectionnés automatiquement selon le seuil HT du booking. Override
          custom par booking via le drawer Réservations.
        </p>
        {profiles.length === 0 ? (
          <AdminEmptyState
            title="Aucun profil actif"
            description="Crée le premier via le formulaire ci-dessous."
            variant="inline"
          />
        ) : (
          <AdminTable columns={columns} rows={profiles} getRowId={(p) => p.id} />
        )}
      </AdminCard>
      {role === "super_admin" ? <ScheduleProfileForm /> : null}
    </AdminPageShell>
  );
}
