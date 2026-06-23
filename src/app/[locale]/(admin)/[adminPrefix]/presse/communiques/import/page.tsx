/**
 * Admin — Salle de presse · import groupé de communiqués.
 *
 * Multi-upload : on dépose N PDF d'un coup + une catégorie commune. Chaque PDF
 * devient un communiqué en brouillon (titre pré-rempli = nom du fichier nettoyé).
 * Poste en multipart vers `bulkCreatePressReleases(formData)`.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { bulkCreatePressReleases } from "@/server/actions/press/releases";
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
  title: "Salle de presse — Import groupé | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const TAG_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "launch", label: "Lancement" },
  { value: "partnership", label: "Partenariat" },
  { value: "study", label: "Étude" },
  { value: "product", label: "Produit" },
  { value: "milestone", label: "Jalon" },
];

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams?: Promise<{ error?: string }>;
}

export default async function BulkImportPressReleasesPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = (await searchParams) ?? {};
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  async function importAll(formData: FormData): Promise<void> {
    "use server";
    const res = await bulkCreatePressReleases(formData);
    if (!res.ok) {
      redirect(`${base}/communiques/import?error=${encodeURIComponent(res.error ?? "unknown")}`);
    }
    redirect(`${base}/communiques?imported=${res.created}`);
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Importer plusieurs communiqués"
        description="Déposez plusieurs PDF d'un coup. Chacun crée un communiqué en brouillon, titre pré-rempli depuis le nom du fichier — à compléter puis publier ensuite."
      />

      {sp.error ? (
        <div className="mb-[var(--space-admin-5)]">
          <AdminFormError message={`Erreur : ${sp.error}`} />
        </div>
      ) : null}

      <AdminCard>
        <form action={importAll} className="flex flex-col gap-[var(--space-admin-5)]">
          <AdminFormSection title="Fichiers">
            <div className="admin-form-field flex flex-col gap-[var(--space-admin-2)]">
              <label
                htmlFor="press-pdfs"
                className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
              >
                Communiqués (PDF)
                <span
                  aria-hidden="true"
                  className="ml-[var(--space-admin-2)] text-[color:var(--color-admin-destructive)]"
                >
                  *
                </span>
              </label>
              <input
                id="press-pdfs"
                name="files"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                required
                className="w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-5)] py-[var(--space-admin-4)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)] file:mr-[var(--space-admin-4)] file:rounded-[var(--radius-admin-sm)] file:border-0 file:bg-[color:var(--color-admin-info)] file:px-[var(--space-admin-4)] file:py-[var(--space-admin-2)] file:text-[color:var(--color-admin-paper)]"
              />
              <small className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Sélection multiple autorisée. PDF uniquement, 10 Mo maximum par fichier.
              </small>
            </div>
          </AdminFormSection>

          <AdminFormSection title="Classification commune">
            <AdminFormField
              label="Catégorie (appliquée à tous)"
              name="tag"
              type="select"
              required
              options={TAG_OPTIONS}
            />
          </AdminFormSection>

          <div className="flex items-center gap-[var(--space-admin-3)]">
            <AdminSubmitButton pendingLabel="Import…">Importer les communiqués</AdminSubmitButton>
          </div>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
