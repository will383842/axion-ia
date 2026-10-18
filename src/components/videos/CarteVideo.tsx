/**
 * Carte d'une vidéo (vignette 4:3, titre, durée) : composant SERVEUR, zéro JS, jamais de
 * lecteur. Partagé par la page vidéo (« À voir aussi »), la galerie, les pages de thème et
 * de série, et les encarts « En vidéo » (W4). Ne doit importer AUCUN composant client :
 * `tests/unit/videos/aucun-js-client-dans-les-listes.spec.ts` le verrouille.
 */
import Image from "next/image";
import Link from "next/link";
import type { VideoPubliee } from "@/server/videos/lecture";

/** « 3 min 04 » — rassure avant le clic. */
export function libelleDuree(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${String(s).padStart(2, "0")}`;
}

export function CarteVideo({ video }: { video: VideoPubliee }) {
  const v = video.fichiers.vignette43;
  return (
    <li>
      <Link
        href={`/fr/videos/${video.slug}`}
        className="border-border bg-paper hover:border-terracotta/50 block overflow-hidden rounded-xl border transition-colors"
      >
        <Image
          src={v.chemin}
          alt=""
          width={v.largeur ?? 960}
          height={v.hauteur ?? 720}
          sizes="(max-width: 768px) 100vw, 280px"
          loading="lazy"
          unoptimized
          className="aspect-[4/3] w-full object-cover"
        />
        <span className="block p-3">
          <span className="text-fg block text-sm font-semibold">{video.titre}</span>
          <span className="text-fg-muted mt-1 block text-xs tabular-nums">
            {libelleDuree(video.dureeSecondes)}
          </span>
        </span>
      </Link>
    </li>
  );
}
