/**
 * Carte d'une vidéo (vignette 4:3, titre, durée) : composant SERVEUR, zéro JS, jamais de
 * lecteur. Partagé par la page vidéo (« À voir aussi »), la galerie, les pages de thème et
 * de série, et les encarts « En vidéo » (W4). Ne doit importer AUCUN composant client :
 * `src/app/[locale]/videos/__tests__/galerie.spec.tsx` le verrouille.
 *
 * Liens en `<a>` natifs, images en `<img>` natifs : ni `next/link` ni `next/image` (deux
 * composants CLIENT) — chacun ajoutait 2 à 4 ko de JS aux pages porteuses de cartes, dont les
 * 2 157 pages villes qui portent l'encart. Ici une navigation complète ne coûte rien : la
 * cible est une page serveur qui ne se précharge pas.
 */
import { libelleDuree } from "@/content/videos/duree";
import type { VideoPubliee } from "@/server/videos/lecture";

export { libelleDuree };

export function CarteVideo({ video }: { video: VideoPubliee }) {
  const v = video.fichiers.vignette43;
  return (
    <li>
      <a
        href={`/fr/videos/${video.slug}`}
        className="border-border bg-paper hover:border-terracotta/50 block overflow-hidden rounded-xl border transition-colors"
      >
        {/* `<img>` natif et non `next/image` : l'affiche est déjà en AVIF, servie hors de l'optimiseur
            (`unoptimized` revenait au même). `next/image` embarque son composant CLIENT : ~3,7 ko
            de JS ajoutés à CHAQUE page qui porte une carte (2 157 pages villes avec les encarts). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={v.chemin}
          alt=""
          width={v.largeur ?? 960}
          height={v.hauteur ?? 720}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full object-cover"
        />
        <span className="block p-3">
          <span className="text-fg block text-sm font-semibold">{video.titre}</span>
          <span className="text-fg-muted mt-1 block text-xs tabular-nums">
            {libelleDuree(video.dureeSecondes)}
          </span>
        </span>
      </a>
    </li>
  );
}
