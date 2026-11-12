// Crédit de la photo du héros (CGU Unsplash §9 : l'attribution est OBLIGATOIRE et se rend SUR la
// page). La photo vient du lot curé de `/memo-isere` (servi en local, 0 hotlink). On ne retire pas
// ce crédit sans retirer la photo.
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { memoPhoto } from "@/content/recrutement/memo-isere-photos";

export function CreditsPhotos() {
  const p = memoPhoto("hero");
  return (
    <div className="mx-auto w-full max-w-[1140px] px-4 pb-6">
      <UnsplashCredit
        photographerName={p.photographer}
        photographerUrl={p.photographerUrl}
        className="text-right"
      />
    </div>
  );
}
