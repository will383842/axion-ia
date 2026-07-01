/**
 * Admin — Salle de presse · upload d'un asset du kit média.
 *
 * Formulaire multipart (fichier de marque). Poste la FormData brute au server
 * action `uploadPressMediaAsset` (champs : file, kind, title, description,
 * status). En cas de succès → retour à la liste du kit média.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { uploadPressMediaAsset } from "@/server/actions/press/media";
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
  title: "Salle de presse — Uploader un média | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const KIND_OPTIONS = [
  { value: "logo", label: "Logo" },
  { value: "wordmark", label: "Logotype texte" },
  { value: "photo", label: "Photo" },
  { value: "brand_book", label: "Livret de marque" },
  { value: "boilerplate", label: "Texte de présentation" },
  { value: "color_charter", label: "Charte couleur" },
  { value: "graphic_charter", label: "Charte graphique" },
] as const;

const STATUS_OPTIONS = [
  { value: "draft", label: "Brouillon" },
  { value: "published", label: "Publié" },
];

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams?: Promise<{ error?: string }>;
}

export default async function PressMediaUploadPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = (await searchParams) ?? {};
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  async function upload(formData: FormData): Promise<void> {
    "use server";
    const res = await uploadPressMediaAsset(formData);
    if (!res.ok) {
      redirect(`${base}/kit-media/upload?error=${encodeURIComponent(res.error ?? "unknown")}`);
    }
    redirect(`${base}/kit-media`);
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Uploader un média"
        description="Ajoutez un fichier de marque (logo, wordmark, charte couleur/graphique, brand book, boilerplate, photo). Stocké hors web-root, servi via la salle de presse."
      />

      {sp.error ? (
        <div className="mb-[var(--space-admin-5)]">
          <AdminFormError message={`Erreur : ${sp.error}`} />
        </div>
      ) : null}

      <AdminCard>
        <form
          action={upload}
          encType="multipart/form-data"
          className="flex flex-col gap-[var(--space-admin-5)]"
        >
          <AdminFormSection title="Fichier">
            <div className="admin-form-field flex flex-col gap-[var(--space-admin-2)]">
              <label
                htmlFor="press-media-file"
                className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
              >
                Fichier
                <span
                  aria-hidden="true"
                  className="ml-[var(--space-admin-2)] text-[color:var(--color-admin-destructive)]"
                >
                  *
                </span>
              </label>
              <input
                id="press-media-file"
                name="file"
                type="file"
                required
                className="w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-5)] py-[var(--space-admin-4)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)] focus:border-[color:var(--color-admin-info)] focus:outline-none"
              />
              <small className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                PNG, SVG, PDF, ZIP… selon le type d&apos;asset.
              </small>
            </div>
            <AdminFormField
              label="Type d'asset"
              name="kind"
              type="select"
              required
              options={KIND_OPTIONS as ReadonlyArray<{ value: string; label: string }>}
            />
          </AdminFormSection>

          <AdminFormSection title="Métadonnées (français)">
            <AdminFormField
              label="Titre"
              name="title"
              type="text"
              required
              placeholder="Logo principal Axion-IA"
            />
            <AdminFormField
              label="Description"
              name="description"
              type="textarea"
              rows={4}
              hint="Conseils d'usage, mentions, contexte (optionnel)."
            />
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
            <AdminSubmitButton pendingLabel="Upload…">Uploader</AdminSubmitButton>
          </div>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
