/**
 * Admin — Salle de presse · création d'un communiqué.
 *
 * Formulaire FR-only (titre, dek/résumé, catégorie + PDF uploadé). Poste en
 * multipart vers le server action `createPressRelease(formData)`. En cas de
 * succès → redirige vers l'éditeur du communiqué créé ; sinon réaffiche le
 * formulaire avec l'erreur.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createPressRelease } from "@/server/actions/press/releases";
import type { PressReleaseTag } from "../../../../../../../../prisma/generated/client";
import {
  PRESS_TAG_OPTIONS,
  PRESS_REGION_OPTIONS,
  PRESS_SECTOR_OPTIONS,
  PRESS_AUDIENCE_OPTIONS,
} from "@/server/actions/press/taxonomy-options";
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
  title: "Salle de presse — Nouveau communiqué | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const TAG_OPTIONS: ReadonlyArray<{ value: PressReleaseTag; label: string }> = PRESS_TAG_OPTIONS;

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams?: Promise<{ error?: string }>;
}

export default async function NewPressReleasePage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = (await searchParams) ?? {};
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  async function create(formData: FormData): Promise<void> {
    "use server";
    // Le formulaire poste déjà title / dek / tag / file (PDF) en multipart :
    // on relaie le FormData tel quel (status forcé en brouillon).
    formData.set("status", "draft");
    const res = await createPressRelease(formData);
    if (!res.ok || !res.id) {
      redirect(`${base}/communiques/nouveau?error=${encodeURIComponent(res.error ?? "unknown")}`);
    }
    redirect(`${base}/communiques/${res.id}`);
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau communiqué"
        description="Rédigez le communiqué en français. Il est créé en brouillon ; vous pourrez le publier depuis l'éditeur."
      />

      {sp.error ? <AdminFormError message={`Erreur : ${sp.error}`} /> : null}

      <AdminCard>
        <form action={create} className="flex flex-col gap-[var(--space-admin-5)]">
          <AdminFormSection title="Contenu (français)">
            <AdminFormField
              label="Titre"
              name="title"
              type="text"
              required
              autoFocus
              placeholder="Axion-IA lance…"
            />
            <AdminFormField
              label="Résumé (dek)"
              name="dek"
              type="text"
              hint="Phrase d'accroche affichée sous le titre (optionnel)."
              placeholder="Résumé en une phrase"
            />
            <div className="admin-form-field flex flex-col gap-[var(--space-admin-2)]">
              <label
                htmlFor="press-pdf"
                className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]"
              >
                Communiqué (PDF)
                <span
                  aria-hidden="true"
                  className="ml-[var(--space-admin-2)] text-[color:var(--color-admin-destructive)]"
                >
                  *
                </span>
              </label>
              <input
                id="press-pdf"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                required
                className="w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-5)] py-[var(--space-admin-4)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)] file:mr-[var(--space-admin-4)] file:rounded-[var(--radius-admin-sm)] file:border-0 file:bg-[color:var(--color-admin-info)] file:px-[var(--space-admin-4)] file:py-[var(--space-admin-2)] file:text-[color:var(--color-admin-paper)]"
              />
              <small className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                PDF uniquement, 10 Mo maximum.
              </small>
            </div>
          </AdminFormSection>

          <AdminFormSection title="Classification">
            <AdminFormField
              label="Catégorie"
              name="tag"
              type="select"
              required
              options={TAG_OPTIONS}
            />
          </AdminFormSection>

          <AdminFormSection
            title="Ciblage média"
            description="Permet aux journalistes de filtrer les communiqués sur /presse (région, secteur, audience). Tous les champs sont optionnels."
          >
            <AdminFormField
              label="Audience"
              name="audience"
              type="select"
              defaultValue="GENERAL"
              options={PRESS_AUDIENCE_OPTIONS}
              hint="Général = tout public ; Fondateur = angle dirigeant/portrait."
            />
            <AdminFormField
              label="Région"
              name="region"
              type="select"
              defaultValue=""
              options={PRESS_REGION_OPTIONS}
            />
            <AdminFormField
              label="Département (code INSEE)"
              name="departement"
              type="text"
              placeholder="ex. 75, 2A, 974"
              hint="Code département en texte libre (optionnel)."
            />
            <AdminFormField
              label="Secteur d'activité"
              name="sector"
              type="select"
              defaultValue=""
              options={PRESS_SECTOR_OPTIONS}
            />
          </AdminFormSection>

          <div className="flex items-center gap-[var(--space-admin-3)]">
            <AdminSubmitButton pendingLabel="Création…">Créer le brouillon</AdminSubmitButton>
          </div>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
