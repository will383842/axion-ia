/**
 * Admin — Salle de presse · création d'une retombée presse.
 *
 * Formulaire FR-only (média, URL article, date, titre FR, titre EN optionnel,
 * statut). Poste vers le server action `createMediaCoverage(formData)`. En cas
 * de succès → redirige vers l'éditeur ; sinon réaffiche avec l'erreur.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createMediaCoverage } from "@/server/actions/press/media-coverage.actions";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminFormField,
  AdminFormSection,
  AdminSubmitButton,
  AdminFormError,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Nouvelle retombée | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "draft", label: "Brouillon" },
  { value: "published", label: "Publié" },
];

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams?: Promise<{ error?: string }>;
}

export default async function NewMediaCoveragePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = (await searchParams) ?? {};
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  async function create(formData: FormData): Promise<void> {
    "use server";
    const res = await createMediaCoverage(formData);
    if (!res.ok || !res.id) {
      redirect(`${base}/couverture/nouveau?error=${encodeURIComponent(res.error ?? "unknown")}`);
    }
    redirect(`${base}/couverture/${res.id}`);
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouvelle retombée presse"
        description="Référencez un article ou une interview publié par un média externe."
      />

      {sp.error ? <AdminFormError message={`Erreur : ${sp.error}`} /> : null}

      <AdminCard>
        <form action={create} className="flex flex-col gap-[var(--space-admin-5)]">
          <AdminFormSection title="Source">
            <AdminFormField
              label="Média"
              name="outlet"
              type="text"
              required
              autoFocus
              placeholder="Les Échos, France Inter, Le Monde…"
            />
            <AdminFormField
              label="URL de l'article"
              name="url"
              type="url"
              required
              placeholder="https://…"
            />
            <AdminFormField label="Date de publication" name="publishedAt" type="date" required />
          </AdminFormSection>

          <AdminFormSection title="Titre">
            <AdminFormField
              label="Titre (français)"
              name="titleFr"
              type="text"
              required
              placeholder="Titre de l'article / interview"
            />
            <AdminFormField
              label="Titre (anglais)"
              name="titleEn"
              type="text"
              hint="Optionnel — laissez vide si pas de version anglaise."
              placeholder="English headline"
            />
          </AdminFormSection>

          <AdminFormSection title="Publication">
            <AdminFormField
              label="Statut"
              name="status"
              type="select"
              required
              defaultValue="draft"
              options={STATUS_OPTIONS}
            />
          </AdminFormSection>

          <div className="flex items-center gap-[var(--space-admin-3)]">
            <AdminSubmitButton pendingLabel="Création…">Créer la retombée</AdminSubmitButton>
          </div>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
