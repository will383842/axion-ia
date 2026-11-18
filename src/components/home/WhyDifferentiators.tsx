// Server Component — les six raisons de nous choisir de l'accueil.
//
// Refonte 2026-11-09 (maquette validée) : le composant ne porte plus aucun texte.
// L'accueil lui passe les six raisons (`titre`, `texte`, `slot`) depuis
// `_accueil/contenu.ts` ; il ne garde que la mise en forme — une bande visuelle
// 16:9, l'icône et le texte — et le choix de l'icône et de la teinte par visuel.
// Les anciens textes et chiffres (« 13 régions et 5 DROM », « grand groupe »,
// « 5 métiers ») sont supprimés : ils n'étaient plus vrais.
//
// L'ordre d'affichage est celui du tableau reçu (celui de la maquette : why-04,
// 05, 01, 06, 02, 03). Les visuels viennent de `home-images.ts` (AVIF local,
// 1600×900) ; les crédits photographes sont rendus sous la grille — obligation
// des CGU Unsplash, à ne pas retirer sans retirer les photos.

import {
  Calculator,
  FolderOpen,
  Plug,
  ShieldCheck,
  Tag,
  User,
  type LucideIcon,
} from "lucide-react";

import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { UnsplashCreditList } from "@/components/media/UnsplashCreditList";
import { FeatureMediaCard } from "@/components/marketing/FeatureMediaCard";
import { getHomePhotoCredit } from "@/content/home/home-photos";
import { homeImageFor } from "@/content/home/home-images";
import type { ServiceAccent } from "@/content/services-visual";

export interface RaisonAffichee {
  titre: string;
  texte: string;
  /** Clé du visuel dans `HOME_IMAGES` / `HOME_PHOTO_CREDITS`. */
  slot: string;
}

/** Icône et teinte de chaque visuel (la raison change de texte, pas de visuel). */
const PRESENTATION: Readonly<Record<string, { Icon: LucideIcon; accent: ServiceAccent }>> = {
  "why-04-meme-expert": { Icon: User, accent: "terracotta" },
  "why-05-votre-rythme": { Icon: Calculator, accent: "primary" },
  "why-01-aucun-intermediaire": { Icon: FolderOpen, accent: "sage" },
  "why-06-meme-exigence": { Icon: Plug, accent: "ochre" },
  "why-02-cinq-metiers": { Icon: ShieldCheck, accent: "plum" },
  "why-03-couverture": { Icon: Tag, accent: "terracotta" },
};

export function WhyDifferentiators({ raisons }: { raisons: ReadonlyArray<RaisonAffichee> }) {
  return (
    <>
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
        {raisons.map((raison, idx) => {
          const presentation = PRESENTATION[raison.slot] ?? {
            Icon: Tag,
            accent: "terracotta" as const,
          };
          const image = homeImageFor(raison.slot, true);
          return (
            <li key={raison.slot} className="h-full">
              <FadeInOnView delay={idx * 40} className="h-full">
                <FeatureMediaCard
                  index={idx + 1}
                  accent={presentation.accent}
                  Icon={presentation.Icon}
                  title={raison.titre}
                  description={raison.texte}
                  {...(image ? { image } : {})}
                />
              </FadeInOnView>
            </li>
          );
        })}
      </ul>
      <UnsplashCreditList
        credits={raisons
          .map((r) => getHomePhotoCredit(r.slot))
          .filter((c): c is NonNullable<typeof c> => Boolean(c))}
      />
    </>
  );
}
