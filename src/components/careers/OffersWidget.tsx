// Widget embarquable des offres d'emploi Axion-IA.com.
//
// Composant central, PUR (aucun hook, aucun "use client") → rendu serveur dans
// la route d'embed `/[locale]/carrieres/widget` ET réutilisable pour les aperçus
// visuels. Aux couleurs du site via tokens globals.css (terracotta / paper /
// mocha) — jamais de hex hardcodé.
//
// Contraintes d'embed :
//   - liens en URL ABSOLUE (`baseUrl`) ouverts dans un nouvel onglet
//     (`target="_blank"`) : le widget vit dans un iframe sur un site tiers, on
//     ne veut pas remplacer la page hôte.
//   - `<img>` natif (pas next/image) : l'embed doit rester autonome et léger,
//     les visuels Unsplash sont déjà dimensionnés et hotlinkés.
//
// Variants :
//   - "compact" : liste verticale dense (logo + N lignes) — idéal sidebar.
//   - "large"   : grille de cartes avec visuel — idéal page carrières partenaire.

import { isNew, salaryLabel, workModeLabel } from "@/lib/careers/format";
import { filterOffersByCity } from "@/lib/careers/city-widget";
import { careerImage } from "@/content/careers/careers-images";
import type { JobOffer } from "../../../prisma/generated/client";

export type OffersWidgetVariant = "compact" | "large";
export type OffersWidgetTheme = "light" | "dark";

export interface OffersWidgetProps {
  locale: string;
  /** Offres publiées (déjà triées). Le composant tronque à `count`. */
  offers: JobOffer[];
  variant?: OffersWidgetVariant;
  /** Nombre d'offres affichées (1–12). */
  count?: number;
  theme?: OffersWidgetTheme;
  /**
   * Ville canonique (déjà résolue via `resolveWidgetCity`) → n'affiche que les
   * offres de cette ville OU multi-villes l'incluant OU remote. `null`/absent =
   * toutes les offres.
   */
  city?: string | null;
  /** Origine absolue du site (ex. https://axion-ia.com) pour les liens. */
  baseUrl: string;
}

interface ThemeTokens {
  root: string;
  border: string;
  card: string;
  cardHover: string;
  muted: string;
  accent: string;
  /** Couleur du titre de carte au hover (classe Tailwind littérale). */
  titleHover: string;
  badge: string;
  cta: string;
}

const THEMES: Record<OffersWidgetTheme, ThemeTokens> = {
  light: {
    root: "bg-paper text-fg",
    border: "border-border",
    card: "bg-bg",
    cardHover: "hover:border-terracotta",
    muted: "text-fg-muted",
    accent: "text-terracotta",
    titleHover: "group-hover:text-terracotta",
    badge: "bg-terracotta text-white",
    cta: "bg-terracotta text-white hover:bg-terracotta/90",
  },
  dark: {
    root: "bg-mocha-rich text-mocha-fg",
    border: "border-mocha-fg/15",
    card: "bg-mocha-fg/5",
    cardHover: "hover:border-terracotta-soft",
    muted: "text-mocha-fg/70",
    accent: "text-terracotta-soft",
    titleHover: "group-hover:text-terracotta-soft",
    badge: "bg-terracotta-soft text-mocha-rich",
    cta: "bg-terracotta-soft text-mocha-rich hover:opacity-90",
  },
};

export const OFFERS_WIDGET_MAX = 12;

/** Borne le `count` reçu (query-param) dans [1, 12]. */
export function clampOffersCount(raw: number | string | undefined, fallback = 5): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  if (n == null || Number.isNaN(n)) return fallback;
  return Math.min(OFFERS_WIDGET_MAX, Math.max(1, Math.trunc(n)));
}

function metaLine(o: JobOffer, isFr: boolean): string {
  const parts: string[] = [];
  parts.push(o.city ?? workModeLabel(o.workMode, isFr));
  if (o.city && o.workMode !== "on_site") parts.push(workModeLabel(o.workMode, isFr));
  if (o.contractLabel) parts.push(o.contractLabel);
  const sal = salaryLabel(o, isFr);
  if (sal) parts.push(sal);
  return parts.join(" · ");
}

export function OffersWidget({
  locale,
  offers,
  variant = "large",
  count = 5,
  theme = "light",
  city = null,
  baseUrl,
}: OffersWidgetProps) {
  const isFr = locale !== "en";
  const t = THEMES[theme];
  // Filtre ville (ville OU multi-villes OU remote) avant la troncature au count.
  const displayed = filterOffersByCity(offers, city);
  const shown = displayed.slice(0, clampOffersCount(count));
  // Le lien d'attribution + le hub pointent TOUJOURS vers /carrieres (ancre de
  // marque, autorité concentrée) — jamais une URL ville (anti link-scheme).
  const hubUrl = `${baseUrl}/${locale}/carrieres`;
  const offerUrl = (slug: string) => `${baseUrl}/${locale}/carrieres/${slug}`;
  const total = displayed.length;
  const tagline = city
    ? isFr
      ? `Recrute à ${city}`
      : `Hiring in ${city}`
    : isFr
      ? "On recrute"
      : "We're hiring";

  return (
    <div
      className={`axion-offers-embed flex flex-col gap-4 rounded-2xl border ${t.border} ${t.root} p-4 font-sans sm:p-5`}
      data-variant={variant}
      data-theme={theme}
    >
      {/* En-tête — wordmark + accroche + compteur */}
      <header className="flex items-center justify-between gap-3">
        <a
          href={hubUrl}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2"
          aria-label="Axion-IA — Carrières"
        >
          <span
            className="text-lg leading-none font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Axion
            <span aria-hidden="true" className={`mx-0.5 ${t.muted}`}>
              -
            </span>
            <span className={`italic ${t.accent}`} style={{ fontFamily: "var(--font-serif)" }}>
              IA
            </span>
          </span>
          <span className={`text-xs ${t.muted}`}>· {tagline}</span>
        </a>
        {total > 0 ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.badge}`}>
            {total} {isFr ? (total > 1 ? "postes" : "poste") : total > 1 ? "roles" : "role"}
          </span>
        ) : null}
      </header>

      {/* Corps */}
      {shown.length === 0 ? (
        <p className={`py-6 text-center text-sm ${t.muted}`}>
          {city
            ? isFr
              ? `Pas d'offre à ${city} ni en télétravail pour l'instant — revenez bientôt.`
              : `No role in ${city} or remote right now — check back soon.`
            : isFr
              ? "Pas d'offre ouverte en ce moment — revenez bientôt."
              : "No open role right now — check back soon."}
        </p>
      ) : variant === "compact" ? (
        <ul className="flex flex-col gap-2" role="list">
          {shown.map((o) => (
            <li key={o.id}>
              <a
                href={offerUrl(o.slug)}
                target="_blank"
                rel="noopener"
                className={`group block rounded-xl border ${t.border} ${t.card} ${t.cardHover} px-3 py-2.5 transition-colors`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 text-sm font-semibold">
                    {isFr ? o.titleFr : o.titleEn}
                  </span>
                  {isNew(o.datePosted) ? (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.badge}`}
                    >
                      {isFr ? "Nouveau" : "New"}
                    </span>
                  ) : null}
                </div>
                <span className={`mt-0.5 line-clamp-1 block text-xs ${t.muted}`}>
                  {metaLine(o, isFr)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" role="list">
          {shown.map((o) => {
            const img = careerImage(o.slug);
            return (
              <li key={o.id}>
                <a
                  href={offerUrl(o.slug)}
                  target="_blank"
                  rel="noopener"
                  className={`group flex h-full flex-col overflow-hidden rounded-xl border ${t.border} ${t.card} ${t.cardHover} transition-colors`}
                >
                  <span className="relative block aspect-[16/7] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- embed autonome, image Unsplash hotlinkée déjà dimensionnée */}
                    <img
                      src={img.url}
                      alt={img.alt}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {isNew(o.datePosted) ? (
                      <span
                        className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.badge}`}
                      >
                        {isFr ? "Nouveau" : "New"}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-1 flex-col p-3">
                    <span className={`text-sm font-semibold transition-colors ${t.titleHover}`}>
                      {isFr ? o.titleFr : o.titleEn}
                    </span>
                    <span className={`mt-1 line-clamp-2 text-xs ${t.muted}`}>
                      {isFr ? o.summaryFr : o.summaryEn}
                    </span>
                    <span className={`mt-2 line-clamp-1 text-[11px] ${t.muted}`}>
                      {metaLine(o, isFr)}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pied — CTA hub + signature */}
      <footer className="flex items-center justify-between gap-3 pt-1">
        <a
          href={hubUrl}
          target="_blank"
          rel="noopener"
          className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${t.cta}`}
        >
          {isFr ? "Voir toutes les offres" : "See all roles"}
          <span aria-hidden="true">→</span>
        </a>
        <a
          href={`${baseUrl}/${locale}/carrieres`}
          target="_blank"
          rel="noopener"
          className={`text-[10px] ${t.muted} hover:underline`}
        >
          {isFr ? "Propulsé par" : "Powered by"} Axion-IA
        </a>
      </footer>
    </div>
  );
}
