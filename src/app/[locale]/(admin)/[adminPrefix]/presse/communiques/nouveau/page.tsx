/**
 * Admin — Salle de presse · création d'un communiqué.
 *
 * Formulaire FR-only (titre, dek/résumé, catégorie + PDF uploadé). Poste en
 * multipart vers le server action `createPressRelease(formData)` via
 * `useActionState` (cf. NewPressReleaseForm) : en cas de succès → redirige vers
 * l'éditeur du communiqué créé ; en cas d'erreur → réaffiche le formulaire AVEC
 * les valeurs saisies préservées (fini le rechargement qui effaçait tout).
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createPressRelease } from "@/server/actions/press/releases";
import {
  PRESS_TAG_OPTIONS,
  PRESS_REGION_OPTIONS,
  PRESS_SECTOR_OPTIONS,
  PRESS_AUDIENCE_OPTIONS,
} from "@/server/actions/press/taxonomy-options";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { NewPressReleaseForm, type NewReleaseFormState } from "./NewPressReleaseForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Salle de presse — Nouveau communiqué | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

/** Transforme les codes d'erreur bruts du server action en messages FR lisibles. */
function friendlyError(code: string): string {
  switch (code) {
    case "file_required":
      return "Le PDF est obligatoire. Sélectionnez à nouveau votre fichier ci-dessous.";
    case "file_too_large":
      return "PDF trop volumineux : 10 Mo maximum.";
    case "unsupported_extension":
    case "unsupported_mime":
      return "Format de fichier non supporté : PDF uniquement.";
    case "validation_failed":
      return "Formulaire invalide. Vérifiez les champs obligatoires.";
    case "unauthorized":
    case "forbidden":
      return "Session expirée ou accès refusé. Reconnectez-vous.";
    case "create_failed":
      return "La création a échoué (erreur serveur). Réessayez ; si le problème persiste, contactez l'équipe technique.";
    default:
      // Les messages Zod sont déjà rédigés en français (titre, résumé, département).
      return code;
  }
}

/** "" / null → "" ; sinon la chaîne (pour repeupler les champs après erreur). */
function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

export default async function NewPressReleasePage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }
  const base = `/${locale}/${adminPrefix}/presse`;

  async function create(
    _prev: NewReleaseFormState,
    formData: FormData,
  ): Promise<NewReleaseFormState> {
    "use server";
    // Le formulaire poste déjà title / dek / tag / file (PDF) en multipart :
    // on relaie le FormData tel quel (status forcé en brouillon).
    formData.set("status", "draft");
    const res = await createPressRelease(formData);
    if (res.ok && res.id) {
      // Succès : redirect() jette NEXT_REDIRECT (propagé, pas capturé ici).
      redirect(`${base}/communiques/${res.id}`);
    }
    // Erreur : on renvoie l'état AVEC les valeurs saisies pour les préserver
    // (le champ fichier reste, lui, à re-sélectionner — limite navigateur).
    return {
      ok: false,
      error: friendlyError(res.error ?? "create_failed"),
      values: {
        title: str(formData.get("title")),
        dek: str(formData.get("dek")),
        tag: str(formData.get("tag")),
        publishedAt: str(formData.get("publishedAt")),
        audience: str(formData.get("audience")),
        region: str(formData.get("region")),
        departement: str(formData.get("departement")),
        sector: str(formData.get("sector")),
      },
    };
  }

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Nouveau communiqué"
        description="Rédigez le communiqué en français. Il est créé en brouillon ; vous pourrez le publier depuis l'éditeur."
      />

      <NewPressReleaseForm
        action={create}
        tagOptions={PRESS_TAG_OPTIONS}
        audienceOptions={PRESS_AUDIENCE_OPTIONS}
        regionOptions={PRESS_REGION_OPTIONS}
        sectorOptions={PRESS_SECTOR_OPTIONS}
      />
    </AdminPageShell>
  );
}
