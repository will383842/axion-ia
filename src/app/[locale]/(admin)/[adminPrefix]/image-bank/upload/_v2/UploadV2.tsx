// Refonte admin mai 2026 — PR 8 (ADR 0028 IMPLEMENTATION-PLAN.md § PR 8).
//
// Image bank Upload V2 — AdminPageShell + AdminPageHeader + AdminCard.

import { AdminPageShell, AdminPageHeader, AdminCard } from "@/components/admin/ui";
import { ImageUploadDropzone } from "@/components/admin/image-bank/ImageUploadDropzone";

interface Props {
  locale: "fr" | "en";
}

export function UploadV2({ locale }: Props): React.ReactElement {
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Téléverser une image"
        description="Glisser-déposer une image (PNG, JPEG, WebP, AVIF, HEIC) Jusqu'à 5 Mo : traitement immédiat. Au-delà, le traitement se fait en arrière-plan et prend quelques minutes."
      />
      <AdminCard>
        <ImageUploadDropzone
          labels={
            locale === "fr"
              ? {
                  dropzoneTitle: "Glisser-déposer ou cliquer pour uploader",
                  dropzoneSubtitle: "PNG, JPEG, WebP, AVIF, HEIC · max 5 MB sync",
                  submit: "Uploader",
                  submitting: "Upload en cours…",
                  titleField: "Titre (slug auto-généré)",
                  altField: "Alt text FR (optionnel — Claude Vision le génère automatiquement)",
                  captionField: "Légende (optionnel)",
                  descriptionField: "Description (optionnel)",
                  sourceFolderField: "Dossier source (service automatiquement détecté)",
                  targetCityField: "Ville (ex: Lyon)",
                  successMessage:
                    "Image uploadée avec succès — enrichissement Claude Vision en cours",
                  errorPrefix: "Erreur",
                }
              : {
                  dropzoneTitle: "Drag & drop or click to upload",
                  dropzoneSubtitle: "PNG, JPEG, WebP, AVIF, HEIC · max 5 MB sync",
                  submit: "Upload",
                  submitting: "Uploading…",
                  titleField: "Title (slug auto-generated)",
                  altField: "Alt text FR (optional — Claude Vision generates it)",
                  captionField: "Caption (optional)",
                  descriptionField: "Description (optional)",
                  sourceFolderField: "Source folder (service auto-detected)",
                  targetCityField: "City (e.g. Lyon)",
                  successMessage: "Image uploaded — Claude Vision enrichment in progress",
                  errorPrefix: "Error",
                }
          }
        />
      </AdminCard>
    </AdminPageShell>
  );
}
