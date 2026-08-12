import { getEditorialPhoto } from "@/content/pages/editorial-photos";

import { UnsplashCredit } from "./UnsplashCredit";

/**
 * Attribution d'un visuel éditorial curé, résolue depuis son slot.
 *
 * Évite de répéter la paire photographe/URL sur chaque page : le SSOT
 * `editorial-photos.ts` étant auto-généré, une re-curation change le
 * photographe sans qu'aucune page n'ait à être touchée.
 *
 * ⚠️ Obligation CGU Unsplash : ne pas retirer sans retirer la photo.
 */
export function EditorialPhotoCredit({ slot, className }: { slot: string; className?: string }) {
  const photo = getEditorialPhoto(slot);
  if (!photo) return null;

  return (
    <UnsplashCredit
      photographerName={photo.photographer}
      photographerUrl={photo.photographerUrl}
      {...(className ? { className } : {})}
    />
  );
}
