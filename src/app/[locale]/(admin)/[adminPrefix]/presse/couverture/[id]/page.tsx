/**
 * Admin — Salle de presse · édition d'une retombée presse.
 *
 * Lit la retombée (FR + EN) directement via prisma. Trois actions :
 *  - mettre à jour le contenu (updateMediaCoverage)
 *  - publier / dépublier (setMediaCoverageStatus)
 *  - supprimer (softDeleteMediaCoverage) → retour à la liste
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  updateMediaCoverage,
  setMediaCoverageStatus,
  softDeleteMediaCoverage,
} from "@/server/actions/press/media-coverage.actions";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminFormField,
  AdminFormSection,
  AdminSubmitButton,
  AdminStatusBadge,
  AdminFormError,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Éditer une retombée | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams?: Promise<{ error?: string }>;
}

export default async function EditMediaCoveragePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const sp = (await searchParams) ?? {};
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  const coverage = await prisma.mediaCoverage.findFirst({
    where: { id, deletedAt: null },
    include: { translations: true },
  });
  if (!coverage) {
    notFound();
  }
  const fr = coverage.translations.find((t) => t.locale === "fr");
  const en = coverage.translations.find((t) => t.locale === "en");
  const isPublished = coverage.status === "published";
  const publishedAtValue = coverage.publishedAt.toISOString().slice(0, 10);

  async function update(formData: FormData): Promise<void> {
    "use server";
    const res = await updateMediaCoverage(id, formData);
    if (!res.ok) {
      redirect(`${base}/couverture/${id}?error=${encodeURIComponent(res.error ?? "unknown")}`);
    }
    redirect(`${base}/couverture/${id}`);
  }

  async function toggleStatus(): Promise<void> {
    "use server";
    await setMediaCoverageStatus(id, isPublished ? "draft" : "published");
    redirect(`${base}/couverture/${id}`);
  }

  async function remove(): Promise<void> {
    "use server";
    await softDeleteMediaCoverage(id);
    redirect(`${base}/couverture`);
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title={fr?.title ?? coverage.outlet}
        description="Modifiez la retombée, publiez/dépubliez ou supprimez-la."
        meta={<AdminStatusBadge type="publication" status={coverage.status} />}
        actions={
          <form action={toggleStatus}>
            <AdminSubmitButton
              variant={isPublished ? "destructive" : "primary"}
              pendingLabel={isPublished ? "Dépublication…" : "Publication…"}
            >
              {isPublished ? "Dépublier" : "Publier"}
            </AdminSubmitButton>
          </form>
        }
      />

      {sp.error ? (
        <div className="mb-[var(--space-admin-5)]">
          <AdminFormError message={`Erreur : ${sp.error}`} />
        </div>
      ) : null}

      <AdminCard>
        <form action={update} className="flex flex-col gap-[var(--space-admin-5)]">
          <AdminFormSection title="Source">
            <AdminFormField
              label="Média"
              name="outlet"
              type="text"
              required
              defaultValue={coverage.outlet}
            />
            <AdminFormField
              label="URL de l'article"
              name="url"
              type="url"
              required
              defaultValue={coverage.url}
            />
            <AdminFormField
              label="Date de publication"
              name="publishedAt"
              type="date"
              required
              defaultValue={publishedAtValue}
            />
          </AdminFormSection>

          <AdminFormSection title="Titre">
            <AdminFormField
              label="Titre (français)"
              name="titleFr"
              type="text"
              required
              defaultValue={fr?.title ?? ""}
            />
            <AdminFormField
              label="Titre (anglais)"
              name="titleEn"
              type="text"
              defaultValue={en?.title ?? ""}
              hint="Optionnel — videz le champ pour retirer la version anglaise."
            />
          </AdminFormSection>

          <div className="flex items-center gap-[var(--space-admin-3)]">
            <AdminSubmitButton pendingLabel="Enregistrement…">
              Enregistrer les modifications
            </AdminSubmitButton>
          </div>
        </form>
      </AdminCard>

      <AdminCard className="mt-[var(--space-admin-6)] border-[color:var(--color-admin-destructive)]">
        <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-destructive)]">
          Supprimer cette retombée
        </h2>
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          La suppression est définitive côté salle de presse (soft-delete).
        </p>
        <form action={remove} className="mt-[var(--space-admin-4)]">
          <AdminSubmitButton variant="destructive" pendingLabel="Suppression…">
            Supprimer
          </AdminSubmitButton>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
