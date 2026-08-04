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
                  // 🔴 Les libellés FRANÇAIS de ce formulaire étaient truffés
                  // d'anglais : « uploader », « Upload en cours », « slug »,
                  // « Alt text », « max 5 MB sync ». Vu en production.
                  dropzoneTitle: "Glisser-déposer un fichier, ou cliquer pour le choisir",
                  dropzoneSubtitle: "PNG, JPEG, WebP, AVIF, HEIC · jusqu'à 5 Mo",
                  submit: "Ajouter l'image",
                  submitting: "Ajout en cours…",
                  titleField: "Titre (l'adresse est déduite automatiquement)",
                  altField: "Texte alternatif FR (facultatif — généré automatiquement sinon)",
                  captionField: "Légende (facultatif)",
                  descriptionField: "Description (facultatif)",
                  sourceFolderField: "Dossier source (le service est détecté automatiquement)",
                  targetCityField: "Ville (ex. Lyon)",
                  successMessage: "Image ajoutée — la description automatique est en cours",
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
