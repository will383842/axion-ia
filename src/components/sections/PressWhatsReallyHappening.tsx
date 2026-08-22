import * as React from "react";
import { Newspaper, ImageDown, Mail, ArrowRight } from "lucide-react";

// Section pont « Que se passe-t-il vraiment à Axion-IA ? » — ton SOBRE/institutionnel
// (décision Will 2026-06-22), réécriture originale (aucun plagiat). Invite le
// journaliste à parcourir les communiqués, récupérer les visuels de marque et
// contacter les relations presse. Liens d'ancre internes (même page) → <a href="#">.
//
// Refonte visuelle 2026-06-23 (Will) : passage à un lead serif pleine largeur +
// 3 cartes premium alignées sur la grille « 5 activités » (PressActivitiesStrip)
// — tuile d'icône terracotta, numéro en filigrane, liseré d'accent au survol,
// lift léger. Server component, zéro JS client (budget Web Vitals), hauteurs de
// carte égales (items-stretch) → 0 CLS.

interface WhatsReallyLink {
  /** Ancre interne (ex. "#communiques"). */
  href: string;
  /** Icône lucide par point d'entrée. */
  iconKind: "releases" | "media" | "contact";
  title: string;
  description: string;
  cta: string;
}

interface PressWhatsReallyHappeningProps {
  /** Paragraphe d'intro citable (AEO/Speakable). */
  intro: string;
  links: ReadonlyArray<WhatsReallyLink>;
}

const ICON: Record<WhatsReallyLink["iconKind"], React.ComponentType<{ className?: string }>> = {
  releases: Newspaper,
  media: ImageDown,
  contact: Mail,
};

export function PressWhatsReallyHappening({ intro, links }: PressWhatsReallyHappeningProps) {
  return (
    <div className="flex flex-col gap-10">
      {/* Lead citable (AEO/Speakable) — pleine largeur, ton éditorial serif. */}
      <p
        id="press-whats-really"
        className="text-fg max-w-3xl text-lg leading-relaxed sm:text-xl"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        {intro}
      </p>

      {/* 3 points d'entrée — cartes premium alignées sur la grille « 5 activités ». */}
      <ul className="grid gap-5 sm:grid-cols-3">
        {links.map((link, idx) => {
          const Icon = ICON[link.iconKind];
          return (
            <li key={link.href} className="flex">
              <a
                href={link.href}
                className="group border-border bg-paper hover:border-terracotta focus-visible:ring-terracotta relative flex w-full flex-col overflow-hidden rounded-2xl border p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {/* Liseré d'accent supérieur révélé au survol */}
                <span
                  aria-hidden="true"
                  className="bg-terracotta absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
                />
                <span className="mb-5 flex items-center justify-between">
                  <span className="bg-terracotta-soft text-terracotta-deep group-hover:bg-terracotta group-hover:text-paper inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  {/*
                    🔴 2026-08-21 — `opacity-30` mettait ce numéro à 1,62:1.
                    Mesuré par axe-core : « cecac7 » sur « ffffff », 19,5 pt — donc du
                    « grand texte », seuil WCAG 1.4.3 = 3:1. Trois nœuds en
                    violation `serious` sur /fr/presse, le seul défaut
                    d'accessibilité restant des 123 routes publiques auditées.

                    `--color-fg-muted` (« 5a4f44 ») composé sur blanc donne :
                    30 % → 1,63   ·   60 % → 2,95   ·   65 % → 3,28   ·   70 % → 3,68.
                    On prend 70 % : la marge absorbe un futur ajustement du
                    jeton sans replonger sous le seuil.

                    ⚠️ Le numéro reste visiblement plus discret que le titre,
                    mais il n'est plus fantomatique. C'est un changement VISIBLE
                    sur une page publique — assumé : un texte qu'on ne peut pas
                    lire n'est pas une décoration discrète, c'est un défaut.
                  */}
                  <span className="text-fg-muted font-serif text-2xl leading-none font-semibold tabular-nums opacity-70 select-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="text-fg text-lg leading-tight font-semibold">{link.title}</span>
                <span className="text-fg-soft mt-2 flex-1 text-sm leading-relaxed">
                  {link.description}
                </span>
                <span className="text-terracotta mt-5 inline-flex items-center gap-1 text-sm font-medium">
                  {link.cta}
                  <ArrowRight
                    className="h-4 w-4 transition group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
