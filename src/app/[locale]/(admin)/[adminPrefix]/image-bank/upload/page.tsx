/**
 * Admin — Image upload page.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ImageUploadDropzone } from "@/components/admin/image-bank/ImageUploadDropzone";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Image bank — Upload | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function UploadPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  return (
    <main className="space-y-6 p-8">
      <header>
        <h1 className="text-3xl font-bold">Upload image</h1>
        <p className="text-fg-muted">
          Glisser-déposer une image (PNG, JPEG, WebP, AVIF, HEIC) ≤ 5 MB pour upload synchrone.
          Au-delà, pipeline async via worker.
        </p>
      </header>

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
                dropzoneTitle: "Drag &amp; drop or click to upload",
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
    </main>
  );
}
