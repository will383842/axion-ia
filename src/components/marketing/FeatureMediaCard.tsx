// Server Component — carte « média + texte » de la home (refonte Will 2026-08-10).
//
// Remplace les anciennes cartes « cadre + petite icône » jugées vieillottes.
// Chaque carte porte une BANDE MÉDIA en 16:9 au-dessus du texte :
//
// - `image` fourni  → la vraie photo/illustration (next/image, lazy, object-cover)
// - `image` absent  → une composition on-brand : dégradé d'accent + halo radial
//                     + trame de points, puce d'icône, et surtout le CHIFFRE-CLÉ
//                     (`stat`) qui occupe la bande.
//
// Sans `stat`, la bande n'est que du décor et se lit comme un emplacement
// d'image vide — c'est le premier retour de Will sur cette refonte. Le
// chiffre-clé est donc ce qui fait tenir le bloc en prod tel quel, sans
// attendre de photo. Le jour où Will dépose les .avif dans
// `public/illustrations/`, il suffit de passer `image={{ src, alt }}` — aucune
// autre ligne à toucher, et le ratio 16:9 est identique dans les deux modes
// donc la bascule se fait à CLS = 0.
//
// Perf : aucune classe `blur-*` (filtre coûteux au paint sur 6 cartes) — le
// halo est un dégradé radial, pas une forme floutée. Composant serveur pur :
// les icônes Lucide sont rendues en HTML au build, 0 KB de JS client.

import Image from "next/image";
import { Check, type LucideIcon } from "lucide-react";

import { ACCENT_CLASSES, type ServiceAccent } from "@/content/services-visual";
import { cn } from "@/lib/utils";

/** Dégradé de fond de la bande média, par accent. Littéraux complets (JIT v4). */
const BAND_GRADIENT: Record<ServiceAccent, string> = {
  terracotta: "bg-gradient-to-br from-terracotta-soft via-sand to-paper",
  ochre: "bg-gradient-to-br from-ochre-soft via-sand to-paper",
  primary: "bg-gradient-to-br from-primary-soft via-sand to-paper",
  sage: "bg-gradient-to-br from-sage-soft via-sand to-paper",
  plum: "bg-gradient-to-br from-plum-soft via-sand to-paper",
};

/**
 * Variable CSS de l'accent — sert au halo radial de la bande.
 *
 * On passe par un `radial-gradient` en style inline plutôt que par une forme
 * `rounded-full` teintée : une forme pleine, même à faible opacité, laisse un
 * BORD DUR visible en travers de la bande (constaté au premier rendu). Le
 * dégradé radial s'éteint progressivement — pas d'arête, et aucun filtre
 * `blur-*` (coûteux au paint sur 6 cartes).
 */
const ACCENT_VAR: Record<ServiceAccent, string> = {
  terracotta: "--color-terracotta",
  ochre: "--color-ochre",
  primary: "--color-primary",
  sage: "--color-sage",
  plum: "--color-plum",
};

/** Teinte du numéro géant en filigrane. Littéraux complets. */
const BAND_NUMERAL: Record<ServiceAccent, string> = {
  terracotta: "text-terracotta-deep",
  ochre: "text-ochre-deep",
  primary: "text-primary",
  sage: "text-sage",
  plum: "text-plum-deep",
};

export interface FeatureMediaCardProps {
  /** Rang 1-based — sert au numéro en filigrane (01, 02, …). */
  index: number;
  accent: ServiceAccent;
  Icon: LucideIcon;
  title: string;
  description: string;
  /** Sur-titre optionnel affiché au-dessus du titre (ex. « 10 – 249 salariés »). */
  eyebrow?: string;
  /**
   * Chiffre-clé affiché DANS la bande quand il n'y a pas encore d'image.
   *
   * Sans lui la bande n'est que du décor et se lit comme un emplacement vide
   * (retour Will 2026-08-10 : « ils sont vides, ça ne fait pas top »). Avec lui
   * elle porte une information — c'est ce qui fait la différence entre un
   * visuel en attente et un visuel fini.
   */
  stat?: { figure: string; label: string };
  /**
   * Points scannables sous la description. À préférer à un paragraphe long :
   * c'est le remède au reproche « beaucoup trop textuel » — l'œil accroche des
   * items courts là où il décroche d'un pavé de six lignes.
   */
  bullets?: readonly string[];
  /** Ligne de pied mise en avant (ex. « Livrable : plan chiffré »). */
  footnote?: { label: string; value: string };
  /**
   * Visuel réel. Tant qu'il est absent, la bande affiche le motif génératif.
   * `sizes` par défaut = 3 colonnes desktop / 1 colonne mobile.
   */
  image?: { src: string; alt: string };
}

export function FeatureMediaCard({
  index,
  accent,
  Icon,
  title,
  description,
  eyebrow,
  image,
  stat,
  bullets,
  footnote,
}: FeatureMediaCardProps) {
  const a = ACCENT_CLASSES[accent];

  return (
    <article
      className={cn(
        "bg-paper border-border group flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300",
        "hover:shadow-subtle hover:-translate-y-1",
        a.hoverBorder,
      )}
    >
      {/* ── Bande média 16:9 — ratio identique image / motif ⇒ CLS = 0 ── */}
      <div
        className={cn(
          "relative aspect-[16/9] w-full overflow-hidden",
          !image && BAND_GRADIENT[accent],
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
            {/* Halo d'accent — dégradé radial, extinction douce, aucun bord dur */}
            <span
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.32] transition-transform duration-500 group-hover:scale-110"
              style={{
                backgroundImage: `radial-gradient(115% 90% at 80% 6%, var(${ACCENT_VAR[accent]}) 0%, transparent 62%)`,
              }}
            />
            {/* Trame de points fine — donne de la matière sans image */}
            <span
              aria-hidden="true"
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: "radial-gradient(var(--color-border-strong) 1px, transparent 1px)",
                backgroundSize: "14px 14px",
              }}
            />
            {stat ? (
              /* Chiffre-clé — c'est LUI qui remplit la bande. Grand chiffre
                 serif à pleine opacité + libellé court : le bloc se lit comme
                 fini, pas comme un emplacement d'image en attente.

                 Ancré en bas à DROITE (diagonale avec la puce d'icône, en haut
                 à gauche) : sur les cartes en 4 colonnes la bande est trop
                 basse pour empiler puce + grand chiffre à gauche — « 1er » se
                 lisait « Ter » sous la puce (constaté /memo-isere 2026-08-12,
                 latent sur toutes les cartes à chiffre court). La diagonale
                 supprime la collision sans rétrécir la bande. */
              <div className="absolute inset-x-6 bottom-5 text-right">
                <p
                  className={cn(
                    "leading-[0.85] font-semibold tracking-tight whitespace-nowrap",
                    // Chiffres courts (« 474 », « ROI ») en très grand — étroits,
                    // ils restent loin de la puce. Libellés longs (« 6–8 sem. »,
                    // « 10 000 € ») un cran plus bas : moins hauts, ils passent
                    // SOUS la puce même en occupant toute la largeur.
                    stat.figure.length > 4 ? "text-[2rem]" : "text-[3.25rem]",
                    BAND_NUMERAL[accent],
                  )}
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {stat.figure}
                </p>
                <p className="text-fg-muted mt-1.5 text-[11px] leading-tight font-bold tracking-[0.14em] uppercase">
                  {stat.label}
                </p>
              </div>
            ) : (
              /* Repli sans chiffre-clé : numéro d'ordre en filigrane. */
              <span
                aria-hidden="true"
                className={cn(
                  "absolute bottom-4 left-6 text-[5.5rem] leading-[0.78] font-semibold opacity-[0.18] select-none",
                  BAND_NUMERAL[accent],
                )}
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {String(index).padStart(2, "0")}
              </span>
            )}
          </>
        )}

        {/* Puce d'icône — posée sur la bande dans les deux modes */}
        <span
          aria-hidden="true"
          className={cn(
            "shadow-subtle absolute top-4 left-4 inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110",
            a.chipSolid,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>

      {/* ── Corps ── */}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {eyebrow ? (
          <p className={cn("mb-2 text-xs font-bold tracking-[0.14em] uppercase", a.text)}>
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-fg text-base leading-tight font-bold tracking-tight sm:text-lg">
          {title}
        </h3>
        <p className="text-fg-soft mt-2 text-sm leading-relaxed">{description}</p>

        {bullets && bullets.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {bullets.map((b) => (
              <li key={b} className="text-fg-soft flex items-start gap-2 text-sm leading-snug">
                <Check
                  aria-hidden="true"
                  className={cn("mt-0.5 h-4 w-4 shrink-0", a.text)}
                  strokeWidth={2.5}
                />
                <span className="min-w-0">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {footnote ? (
          <>
            {/* Pousse le pied en bas : les cartes d'une même rangée alignent
                leur ligne de livrable même quand les textes ont des longueurs
                différentes. */}
            <div className="flex-1" />
            <div className="border-fg/10 mt-5 border-t pt-4">
              <p className={cn("text-[11px] font-bold tracking-[0.14em] uppercase", a.text)}>
                {footnote.label}
              </p>
              <p className="text-fg mt-1 text-sm leading-snug font-semibold">{footnote.value}</p>
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}
