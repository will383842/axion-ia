/**
 * Admin — Salle de presse · édition d'un communiqué.
 *
 * Lit le communiqué (FR) directement via prisma. Trois actions :
 *  - mettre à jour le contenu (updatePressRelease)
 *  - publier / dépublier (setPressReleaseStatus)
 *  - supprimer (deletePressRelease) → retour à la liste
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  updatePressRelease,
  setPressReleaseStatus,
  deletePressRelease,
} from "@/server/actions/press/releases";
import type { PressReleaseTag } from "../../../../../../../../prisma/generated/client";
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
  title: "Salle de presse — Éditer un communiqué | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const TAG_OPTIONS: ReadonlyArray<{ value: PressReleaseTag; label: string }> = [
  { value: "launch", label: "Lancement" },
  { value: "partnership", label: "Partenariat" },
  { value: "study", label: "Étude" },
  { value: "product", label: "Produit" },
  { value: "milestone", label: "Jalon" },
];

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams?: Promise<{ error?: string }>;
}

export default async function EditPressReleasePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const sp = (await searchParams) ?? {};
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  const release = await prisma.pressRelease.findFirst({
    where: { id, deletedAt: null },
    include: { translations: { where: { locale: "fr" } } },
  });
  if (!release) {
    notFound();
  }
  const fr = release.translations[0];
  const isPublished = release.status === "published";
  const currentPdfName = release.pdfFileName;

  async function update(formData: FormData): Promise<void> {
    "use server";
    // Le formulaire poste title / dek / tag / file (PDF optionnel) en multipart :
    // on relaie le FormData tel quel. PDF vide = conserver l'actuel.
    const res = await updatePressRelease(id, formData);
    if (!res.ok) {
      redirect(`${base}/communiques/${id}?error=${encodeURIComponent(res.error ?? "unknown")}`);
    }
    redirect(`${base}/communiques/${id}`);
  }

  async function toggleStatus(): Promise<void> {
    "use server";
    await setPressReleaseStatus(id, isPublished ? "draft" : "published");
    redirect(`${base}/communiques/${id}`);
  }

  async function remove(): Promise<void> {
    "use server";
    await deletePressRelease(id);
    redirect(`${base}/communiques`);
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title={fr?.title ?? "Communiqué"}
        description="Modifiez le contenu, publiez/dépubliez ou supprimez ce communiqué."
        meta={<AdminStatusBadge type="publication" status={release.status} />}
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
          <AdminFormSection title="Contenu (français)">
            <AdminFormField
              label="Titre"
              name="title"
              type="text"
              required
              defaultValue={fr?.title ?? ""}
            />
            <AdminFormField
              label="Résumé (dek)"
              name="dek"
              type="text"
              defaultValue={fr?.dek ?? ""}
              hint="Phrase d'accroche affichée sous le titre (optionnel)."
            />
            <div className="admin-form-field flex flex-col gap-[var(--space-admin-2)]">
              <label
                htmlFor="press-pdf"
                className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
              >
                Communiqué (PDF)
              </label>
              {currentPdfName ? (
                <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
                  PDF actuel : <strong>{currentPdfName}</strong>
                </p>
              ) : (
                <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)] italic">
                  Aucun PDF pour le moment.
                </p>
              )}
              <input
                id="press-pdf"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                className="w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-5)] py-[var(--space-admin-4)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)] file:mr-[var(--space-admin-4)] file:rounded-[var(--radius-admin-sm)] file:border-0 file:bg-[color:var(--color-admin-info)] file:px-[var(--space-admin-4)] file:py-[var(--space-admin-2)] file:text-[color:var(--color-admin-paper)]"
              />
              <small className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Laisser vide pour conserver le PDF actuel. PDF uniquement, 10 Mo maximum.
              </small>
            </div>
          </AdminFormSection>

          <AdminFormSection title="Classification">
            <AdminFormField
              label="Catégorie"
              name="tag"
              type="select"
              required
              defaultValue={release.tag}
              options={TAG_OPTIONS}
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
          Supprimer ce communiqué
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
