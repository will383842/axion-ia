/**
 * Admin — Salle de presse · création d'un communiqué.
 *
 * Formulaire FR-only (titre, dek, corps, catégorie). Poste vers le server action
 * `createPressRelease` du contrat. En cas de succès → redirige vers l'éditeur
 * d'édition du communiqué créé ; sinon réaffiche le formulaire avec l'erreur.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createPressRelease } from "@/server/actions/press/releases";
import type { PressReleaseTag } from "../../../../../../../../prisma/generated/client";
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

const TAG_OPTIONS: ReadonlyArray<{ value: PressReleaseTag; label: string }> = [
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
    const res = await createPressRelease({
      tag: (formData.get("tag") as PressReleaseTag) ?? "launch",
      status: "draft",
      fr: {
        title: String(formData.get("title") ?? "").trim(),
        dek: String(formData.get("dek") ?? "").trim() || undefined,
        body: String(formData.get("body") ?? "").trim(),
      },
    });
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
              label="Chapô (dek)"
              name="dek"
              type="text"
              hint="Phrase d'accroche affichée sous le titre (optionnel)."
              placeholder="Résumé en une phrase"
            />
            <AdminFormField
              label="Corps"
              name="body"
              type="textarea"
              required
              rows={14}
              hint="Texte intégral du communiqué."
            />
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

          <div className="flex items-center gap-[var(--space-admin-3)]">
            <AdminSubmitButton pendingLabel="Création…">Créer le brouillon</AdminSubmitButton>
          </div>
        </form>
      </AdminCard>
    </AdminPageShell>
  );
}
