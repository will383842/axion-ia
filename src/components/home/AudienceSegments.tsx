// Server Component — les 4 segments cible « Pour qui » de la home.
//
// Refonte Will 2026-08-10 : les 4 cartes n'étaient que du texte dans un cadre
// (« pas assez visuel »). Chaque segment porte maintenant une bande visuelle
// qui MONTRE la progression d'échelle : une jauge de 4 barres dont le nombre
// de barres pleines correspond à la taille d'entreprise (1 pour l'artisan,
// 4 pour le grand groupe). Lue de gauche à droite, la rangée dessine un
// escalier — l'idée « toutes les tailles » passe sans être écrite.
//
// La bande accepte aussi une vraie image (`image`) au même ratio 16:9, donc la
// bascule vers des photos se fera à CLS = 0 sans toucher au layout. Fichiers
// attendus : `imageTarget` de chaque segment.
//
// Composant serveur pur : icônes Lucide rendues en HTML au build, 0 KB de JS.

import Image from "next/image";
import { Hammer, Building2, Building, Landmark } from "lucide-react";

import { FadeInOnView } from "@/components/motion/FadeInOnView";
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

/** Hauteurs des 4 barres de la jauge — escalier régulier. */
const BAR_HEIGHTS = ["h-6", "h-10", "h-14", "h-[4.5rem]"] as const;

interface SegmentVisual {
  id: string;
  accent: ServiceAccent;
  Icon: typeof Hammer;
  /** Nombre de barres pleines sur 4 — matérialise la taille d'entreprise. */
  level: 1 | 2 | 3 | 4;
  /**
   * Tranche d'effectif affichée EN GRAND dans la bande.
   *
   * Elle vivait avant entre parenthèses dans le titre (« PME (10–249) »), ce
   * qui alourdissait le titre et le faisait passer sur deux lignes sur la
   * dernière carte. Remontée dans la bande, elle la remplit — la jauge seule
   * laissait un vide — et le titre redevient court.
   */
  headcount: string;
  imageTarget: string;
  image?: { src: string; alt: string };
}

/** Ordre = celui de `audienceSegments` dans la home (TPE → PME → ETI → GE). */
const SEGMENT_VISUALS: readonly SegmentVisual[] = [
  {
    id: "tpe",
    headcount: "1 – 9",
    accent: "terracotta",
    Icon: Hammer,
    level: 1,
    imageTarget: "public/illustrations/home-audience-01-tpe.avif",
  },
  {
    id: "pme",
    headcount: "10 – 249",
    accent: "ochre",
    Icon: Building2,
    level: 2,
    imageTarget: "public/illustrations/home-audience-02-pme.avif",
  },
  {
    id: "eti",
    headcount: "250 – 4 999",
    accent: "primary",
    Icon: Building,
    level: 3,
    imageTarget: "public/illustrations/home-audience-03-eti.avif",
  },
  {
    id: "large",
    headcount: "5 000+",
    accent: "sage",
    Icon: Landmark,
    level: 4,
    imageTarget: "public/illustrations/home-audience-04-grands-comptes.avif",
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
    <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {segments.map((seg, idx) => {
        const v = SEGMENT_VISUALS[idx];
        if (!v) return null;
        const a = ACCENT_CLASSES[v.accent];

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
                    !v.image && BAND_GRADIENT[v.accent],
                  )}
                >
                  {v.image ? (
                    <Image
                      src={v.image.src}
                      alt={v.image.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
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
  );
}
