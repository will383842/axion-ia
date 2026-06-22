import * as React from "react";
import { Newspaper, ImageDown, Mail, ArrowRight } from "lucide-react";

// Section pont « Que se passe-t-il vraiment à Axion-IA ? » — ton SOBRE/institutionnel
// (décision Will 2026-06-22), réécriture originale (aucun plagiat). Invite le
// journaliste à parcourir les communiqués, récupérer les visuels de marque et
// contacter les relations presse. Liens d'ancre internes (même page) → <a href="#">.
//
// Server component, zéro JS client. Le wrapper <Section> (eyebrow/titre) est fourni
// par la page ; ce composant rend le corps (intro citable + 3 points d'entrée).

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
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <p
        id="press-whats-really"
        className="text-fg max-w-xl text-lg leading-relaxed sm:text-xl"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        {intro}
      </p>
      <ul className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        {links.map((link) => {
          const Icon = ICON[link.iconKind];
          return (
            <li key={link.href}>
              <a
                href={link.href}
                className="group border-border bg-paper hover:border-terracotta focus-visible:ring-terracotta flex min-h-[44px] items-start gap-4 rounded-xl border p-5 transition hover:shadow-[var(--shadow-subtle)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:items-center"
              >
                <span className="bg-terracotta-soft text-terracotta-deep inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-fg block text-base leading-tight font-semibold">
                    {link.title}
                  </span>
                  <span className="text-fg-soft mt-1 block text-sm leading-relaxed">
                    {link.description}
                  </span>
                </span>
                <span className="text-terracotta mt-1 inline-flex shrink-0 items-center gap-1 text-sm font-medium lg:mt-0">
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
