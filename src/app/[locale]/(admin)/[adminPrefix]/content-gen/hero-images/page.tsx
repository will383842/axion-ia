/**
 * Rattrapage des photos hero Unsplash — page admin.
 *
 * Bouton qui pose une vraie photo Unsplash sur les articles publiés qui n'en
 * ont pas (et, en option, remplace les anciens héros image-bank). Tourne dans
 * le conteneur app → accès DB direct, aucune exposition réseau.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminPageShell, AdminPageHeader } from "@/components/admin/ui";
import { HeroImagesBackfill } from "./_v2/HeroImagesBackfill";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

export default async function HeroImagesPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  return (
    <AdminPageShell width="narrow">
      <AdminPageHeader
        title="Photos hero Unsplash"
        description="Pose une vraie photo Unsplash (créditée) sur les articles publiés qui n'en ont pas. Doctrine « Unsplash uniquement » — aucune image générée par IA."
      />
      <HeroImagesBackfill />
    </AdminPageShell>
  );
}
