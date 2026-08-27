/**
 * Admin — Salle de presse · édition d'un asset du kit média.
 *
 * 🔴 Cet écran manquait. Le kit média n'offrait qu'upload + suppression : un
 * titre mal saisi, un mauvais type ou un asset resté en brouillon ne pouvaient
 * être corrigés qu'en supprimant le fichier et en le re-téléversant. L'action
 * `updatePressMediaAsset` existait pourtant depuis l'origine — écrite, jamais
 * branchée à une interface (aucun appelant dans `src/`).
 *
 * Trois actions, calquées sur l'éditeur de communiqué :
 *  - mettre à jour les métadonnées (updatePressMediaAsset)
 *  - publier / dépublier (updatePressMediaAsset, champ status)
 *  - supprimer (deletePressMediaAsset) → retour à la liste
 *
 * Le FICHIER n'est pas remplaçable ici (l'action ne fait pas de re-upload) :
 * pour changer le binaire, supprimer puis re-téléverser. C'est dit à l'écran.
 */

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { updatePressMediaAsset, deletePressMediaAsset } from "@/server/actions/press/media";
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
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Éditer un média | Axion-IA Admin",
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
  { value: "archived", label: "Archivé" },
] as const;

type KitKind = (typeof KIND_OPTIONS)[number]["value"];
type KitStatus = (typeof STATUS_OPTIONS)[number]["value"];

/**
 * Le `<select>` ne peut renvoyer qu'une des valeurs proposées — mais un POST
 * forgé, si. On borne donc ici plutôt que de forcer le type : une valeur hors
 * liste devient `undefined` (« champ non fourni »), et `updatePressMediaAsset`
 * la laisse simplement inchangée au lieu d'écrire n'importe quoi.
 */
function asKind(v: FormDataEntryValue | null): KitKind | undefined {
  return KIND_OPTIONS.some((o) => o.value === v) ? (v as KitKind) : undefined;
}
function asStatus(v: FormDataEntryValue | null): KitStatus | undefined {
  return STATUS_OPTIONS.some((o) => o.value === v) ? (v as KitStatus) : undefined;
}

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
  searchParams?: Promise<{ error?: string }>;
}

export default async function PressMediaEditPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const sp = (await searchParams) ?? {};
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  const asset = await prisma.pressMediaAsset.findFirst({
    where: { id, deletedAt: null },
    include: { translations: { where: { locale: "fr" } } },
  });
  if (!asset) {
    notFound();
  }
  const fr = asset.translations[0];
  const isPublished = asset.status === "published";

  async function update(formData: FormData): Promise<void> {
    "use server";
    const sortParsed = Number.parseInt(String(formData.get("sortOrder") ?? "").trim(), 10);
    const kind = asKind(formData.get("kind"));
    const status = asStatus(formData.get("status"));
    const res = await updatePressMediaAsset(id, {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
      ...(Number.isFinite(sortParsed) ? { sortOrder: sortParsed } : {}),
    });
    if (!res.ok) {
      redirect(`${base}/kit-media/${id}?error=${encodeURIComponent(res.error ?? "unknown")}`);
    }
    redirect(`${base}/kit-media/${id}`);
  }

  async function toggleStatus(): Promise<void> {
    "use server";
    await updatePressMediaAsset(id, { status: isPublished ? "draft" : "published" });
    redirect(`${base}/kit-media/${id}`);
  }

  async function remove(): Promise<void> {
    "use server";
    await deletePressMediaAsset(id);
    redirect(`${base}/kit-media`);
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title={fr?.title ?? asset.fileName ?? "Média"}
        description="Corrigez le titre, la description, le type, l'ordre d'affichage — ou publiez/dépubliez ce fichier."
        meta={<AdminStatusBadge type="image-asset" status={asset.status} />}
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
          <AdminFormSection title="Fichier">
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
              Fichier actuel : <strong>{asset.fileName ?? "—"}</strong>
              {asset.fileFormat ? ` (${asset.fileFormat.toUpperCase()})` : ""}
            </p>
            <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Le binaire n&apos;est pas remplaçable depuis cet écran : supprimez cet asset et
              téléversez le nouveau fichier.
            </p>
            <AdminFormField
              label="Type de fichier"
              name="kind"
              type="select"
              required
              defaultValue={asset.kind}
              options={KIND_OPTIONS}
            />
          </AdminFormSection>

          <AdminFormSection title="Métadonnées (français)">
            <AdminFormField
              label="Titre"
              name="title"
              type="text"
              required
              defaultValue={fr?.title ?? ""}
            />
            <AdminFormField
              label="Description"
              name="description"
              type="textarea"
              rows={4}
              defaultValue={fr?.description ?? ""}
              hint="Conseils d'usage, mentions, contexte (optionnel)."
            />
            <AdminFormField
              label="Statut"
              name="status"
              type="select"
              required
              defaultValue={asset.status}
              options={STATUS_OPTIONS}
            />
            <AdminFormField
              label="Ordre d'affichage"
              name="sortOrder"
              type="number"
              defaultValue={String(asset.sortOrder)}
              hint="Croissant : 0 apparaît en premier dans le kit public."
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
          Supprimer ce fichier
        </h2>
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          Le binaire est retiré du disque et l&apos;entrée passe en archivé.
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
