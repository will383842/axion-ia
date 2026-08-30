// Server Component — les 3 segments cible « Pour qui » de la home.
//
// Refonte Will 2026-08-10 : les cartes n'étaient que du texte dans un cadre
// (« pas assez visuel »). Chaque segment porte maintenant une bande visuelle
// qui MONTRE la progression d'échelle : une jauge de 3 barres dont le nombre
// de barres pleines correspond à la taille d'entreprise (1 pour la PME,
// 3 pour le grand groupe). Lue de gauche à droite, la rangée dessine un
// escalier — l'idée d'une montée en échelle passe sans être écrite.
//
// 2026-08-29 : le palier TPE est retiré (repositionnement PME / ETI / grands
// groupes). La jauge passe de 4 à 3 barres pour que la dernière carte reste
// pleine — une jauge de 4 barres dont aucune carte n'atteint le 4ᵉ cran
// donnerait à lire une échelle tronquée.
//
// La bande accepte aussi une vraie image (`image`) au même ratio 16:9, donc la
// bascule vers des photos se fera à CLS = 0 sans toucher au layout. Fichiers
// attendus : `imageTarget` de chaque segment.
//
// Composant serveur pur : icônes Lucide rendues en HTML au build, 0 KB de JS.

import Image from "next/image";
import { Building2, Building, Landmark } from "lucide-react";

import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { homeImageFor } from "@/content/home/home-images";
import { getHomePhotoCredit } from "@/content/home/home-photos";
import { UnsplashCreditList } from "@/components/media/UnsplashCreditList";
import { ACCENT_CLASSES, type ServiceAccent } from "@/content/services-visual";
import { cn } from "@/lib/utils";

/** Dégradé de bande par accent. Littéraux complets (JIT Tailwind v4). */
const BAND_GRADIENT: Record<ServiceAccent, string> = {
  terracotta: "bg-gradient-to-br from-terracotta-soft via-sand to-paper",
  ochre: "bg-gradient-to-br from-ochre-soft via-sand to-paper",
  primary: "bg-gradient-to-br from-primary-soft via-sand to-paper",
  sage: "bg-gradient-to-br from-sage-soft via-sand to-paper",
  plum: "bg-gradient-to-br from-plum-soft via-sand to-paper",
};

/** Remplissage des barres de la jauge, par accent. Littéraux complets. */
const BAR_FILL: Record<ServiceAccent, string> = {
  terracotta: "bg-terracotta",
  ochre: "bg-ochre",
  primary: "bg-primary",
  sage: "bg-sage",
  plum: "bg-plum",
};

/** Hauteurs des 3 barres de la jauge — escalier régulier. */
const BAR_HEIGHTS = ["h-6", "h-12", "h-[4.5rem]"] as const;

interface SegmentVisual {
  id: string;
  accent: ServiceAccent;
  Icon: typeof Building2;
  /** Nombre de barres pleines sur 3 — matérialise la taille d'entreprise. */
  level: 1 | 2 | 3;
  /**
   * Tranche d'effectif affichée EN GRAND dans la bande.
   *
   * Elle vivait avant entre parenthèses dans le titre (« PME (10–249) »), ce
   * qui alourdissait le titre et le faisait passer sur deux lignes sur la
   * dernière carte. Remontée dans la bande, elle la remplit — la jauge seule
   * laissait un vide — et le titre redevient court.
   */
  headcount: string;
  /** Cle du visuel dans HOME_IMAGES / HOME_PHOTO_CREDITS. */
  slot: string;
}

/** Ordre = celui de `audienceSegments` dans la home (PME → ETI → GE). */
const SEGMENT_VISUALS: readonly SegmentVisual[] = [
  {
    id: "pme",
    headcount: "10 – 249",
    accent: "ochre",
    Icon: Building2,
    level: 1,
    slot: "audience-02-pme",
  },
  {
    id: "eti",
    headcount: "250 – 4 999",
    accent: "primary",
    Icon: Building,
    level: 2,
    slot: "audience-03-eti",
  },
  {
    id: "large",
    headcount: "5 000+",
    accent: "sage",
    Icon: Landmark,
    level: 3,
    slot: "audience-04-grands-comptes",
  },
] as const;

export interface AudienceSegment {
  id: string;
  title: string;
  lead: string;
  detail: string;
}

export function AudienceSegments({
  segments,
  isFr,
}: {
  segments: readonly AudienceSegment[];
  isFr: boolean;
}) {
  return (
    // Paliers md → lg. (Historique : ces grilles avaient dû éviter `sm:` parce
    // que `--breakpoint-sm` manquait dans le `@theme` et que Tailwind v4 émettait
    // alors les règles `sm:` APRÈS `md:`/`lg:`. Le jeton a été déclaré le
    // 2026-08-10 dans globals.css — l'ordre est rétabli, `sm:` est de nouveau
    // utilisable partout.)
    <>
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {segments.map((seg, idx) => {
          const v = SEGMENT_VISUALS[idx];
          if (!v) return null;
          const a = ACCENT_CLASSES[v.accent];
          const image = homeImageFor(v.slot, isFr);

          return (
            <li key={seg.id} className="h-full">
              <FadeInOnView delay={idx * 70} className="h-full">
                <article
                  className={cn(
                    "bg-paper border-border group flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300",
                    "hover:shadow-subtle hover:-translate-y-1",
                    a.hoverBorder,
                  )}
                >
                  {/* ── Bande visuelle 16:9 ── */}
                  <div
                    className={cn(
                      "relative aspect-[16/9] w-full overflow-hidden",
                      !image && BAND_GRADIENT[v.accent],
                    )}
                  >
                    {image ? (
                      <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <>
                        {/* Jauge d'échelle — `level` barres pleines sur 4. */}
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 flex items-end justify-end gap-2 p-5"
                        >
                          {BAR_HEIGHTS.map((h, barIdx) => (
                            <span
                              key={h}
                              className={cn(
                                "w-3 rounded-full transition-transform duration-500 group-hover:scale-y-105",
                                h,
                                BAR_FILL[v.accent],
                                barIdx < v.level ? "opacity-90" : "opacity-[0.18]",
                              )}
                              style={{ transformOrigin: "bottom" }}
                            />
                          ))}
                        </div>
                        {/* Tranche d'effectif — remplit la bande que la jauge
                          seule laissait vide, et décharge le titre. */}
                        <div className="absolute bottom-5 left-6">
                          <p
                            className={cn(
                              "text-[2.25rem] leading-[0.9] font-semibold tracking-tight",
                              a.text,
                            )}
                            style={{ fontFamily: "var(--font-serif)" }}
                          >
                            {v.headcount}
                          </p>
                          <p className="text-fg-muted mt-1.5 text-[11px] leading-tight font-bold tracking-[0.14em] uppercase">
                            {isFr ? "salariés" : "employees"}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Puce d'icône — présente dans les deux modes */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "shadow-subtle absolute top-4 left-4 inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110",
                        a.chipSolid,
                      )}
                    >
                      <v.Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                  </div>

                  {/* ── Corps ── */}
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-fg text-lg leading-tight font-semibold tracking-tight">
                      {seg.title}
                    </h3>
                    <p
                      className={cn("mt-2 text-base leading-snug italic", a.text)}
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {seg.lead}
                    </p>
                    <p className="text-fg-soft mt-3 text-sm leading-relaxed">{seg.detail}</p>
                  </div>
                </article>
              </FadeInOnView>
            </li>
          );
        })}
      </ul>
      <UnsplashCreditList
        credits={SEGMENT_VISUALS.map((v) => getHomePhotoCredit(v.slot)).filter(
          (c): c is NonNullable<typeof c> => Boolean(c),
        )}
      />
    </>
  );
}
