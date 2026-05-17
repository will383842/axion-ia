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
        title="Upload image"
        description="Glisser-déposer une image (PNG, JPEG, WebP, AVIF, HEIC) ≤ 5 MB pour upload synchrone. Au-delà, pipeline async via worker."
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
                  titleField: "Titre",
                  altField: "Texte alternatif (alt)",
                  captionField: "Légende",
                  descriptionField: "Description",
                  successMessage: "Image uploadée avec succès",
                  errorPrefix: "Erreur",
                }
              : {
                  dropzoneTitle: "Drag & drop or click to upload",
                  dropzoneSubtitle: "PNG, JPEG, WebP, AVIF, HEIC · max 5 MB sync",
                  submit: "Upload",
                  submitting: "Uploading…",
                  titleField: "Title",
                  altField: "Alt text",
                  captionField: "Caption",
                  descriptionField: "Description",
                  successMessage: "Image uploaded successfully",
                  errorPrefix: "Error",
                }
          }
        />
      </AdminCard>
    </AdminPageShell>
  );
}
