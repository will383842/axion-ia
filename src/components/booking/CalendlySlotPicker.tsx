// Sélecteur de créneaux — Server Component, aucun JavaScript envoyé (ADR 0038).
//
// Ce que rend ce composant est du HTML statique : une liste de liens. Pas de
// `use client`, pas d'état, pas d'iframe, pas de script tiers. Trois
// conséquences voulues :
//
//   1. RGPD — le navigateur du visiteur n'émet aucune requête vers Calendly, ne
//      reçoit aucun cookie tiers et ne transmet pas son IP. L'article 82 de la
//      loi Informatique et Libertés vise l'accès au terminal : ici il n'y en a
//      pas, donc pas de consentement à recueillir, donc pas de pavé à afficher.
//      Le visiteur ne rejoint Calendly qu'en cliquant — à son initiative.
//   2. Robustesse — la régression assumée d'ADR 0034 (« si l'hydratation échoue,
//      le bouton est inerte et le calendrier inatteignable ») disparaît : des
//      liens dans le HTML initial fonctionnent sans React.
//   3. Performance — plus rien de Calendly dans le chemin critique.
//
// PIÈGE 1 — ne PAS transformer ça en Client Component pour ajouter un filtre,
// un sélecteur de fuseau ou une animation. Tout l'intérêt tient au fait que
// cette surface ne charge rien et ne dépend de rien.
//
// PIÈGE 2 — CLS. La boîte partage `height` et `minWidth` avec
// `CalendlyConsentGate` (constante `box` des deux côtés) : le repli et le rendu
// nominal occupent la même place. `/appel` n'est PAS dans `lighthouserc.json`,
// donc aucun gate CI ne verrait un saut de mise en page.
//
// PIÈGE 3 — couleurs. Les pastilles de créneau utilisent l'appariement `outline`
// du design system (`border-border-strong` / `text-fg` / `bg-paper`). NE PAS
// passer à `bg-terracotta text-paper` : `/fr/appel` fait partie des 15 pages
// tenues à 0 violation axe serious/critical (`tests/e2e/a11y.spec.ts`) et
// `color-contrast` y est classé serious. Le design system apparie terracotta
// avec `text-mocha-fg` (`ui/button.tsx`).
//
// PIÈGE 4 — l'heure affichée est celle de PARIS, et elle est écrite comme
// telle. Calendly, lui, affichera le créneau dans le fuseau du visiteur. Le
// lien porte l'instant exact, donc les deux sont cohérents — mais retirer la
// mention « heure de Paris » rendrait l'écart incompréhensible pour un visiteur
// hors métropole.

import * as React from "react";
import { Link } from "@/i18n/navigation";
import type { CalendlyAvailabilityDay } from "@/server/calendly/availability";

interface CalendlySlotPickerProps {
  readonly days: readonly CalendlyAvailabilityDay[];
  /** URL publique de l'event-type — cible du lien « toutes les disponibilités ». */
  readonly fallbackUrl: string;
  readonly isFr: boolean;
  readonly height: number;
}

function formatters(isFr: boolean) {
  const locale = isFr ? "fr-FR" : "en-GB";
  return {
    day: new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/Paris",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    time: new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

export function CalendlySlotPicker({ days, fallbackUrl, isFr, height }: CalendlySlotPickerProps) {
  const fmt = formatters(isFr);
  // Même boîte que le repli — voir PIÈGE 2.
  const box: React.CSSProperties = { minWidth: "320px", height: `${height}px` };

  return (
    <div
      className="border-border bg-paper mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-lg"
      style={box}
    >
      <div className="border-border border-b px-5 py-4 text-center sm:px-6">
        <p className="text-fg text-lg font-semibold tracking-tight">
          {isFr ? "Choisissez votre créneau" : "Choose your slot"}
        </p>
        <p className="text-fg-soft mt-1 text-sm">
          {isFr ? "30 minutes · heure de Paris" : "30 minutes · Paris time"}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        <ul className="space-y-5">
          {days.map((day) => {
            // Toutes les pastilles d'un jour tombent le même jour civil : la
            // première suffit à en dater l'intitulé.
            const first = day.slots[0];
            if (!first) return null;
            return (
              <li key={day.dateKey}>
                <p className="text-fg text-sm font-semibold first-letter:uppercase">
                  {fmt.day.format(new Date(first.startIso))}
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {day.slots.map((slot) => {
                    const label = `${fmt.day.format(new Date(slot.startIso))} ${
                      isFr ? "à" : "at"
                    } ${fmt.time.format(new Date(slot.startIso))}`;
                    return (
                      <li key={slot.startIso}>
                        <a
                          href={slot.schedulingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-cta="appel_slot_pick"
                          aria-label={
                            isFr
                              ? `Réserver ${label} (ouvre Calendly dans un nouvel onglet)`
                              : `Book ${label} (opens Calendly in a new tab)`
                          }
                          className="border-border-strong text-fg bg-paper hover:border-terracotta hover:text-terracotta focus-visible:ring-primary inline-flex h-11 items-center rounded-full border px-4 text-base font-semibold tabular-nums transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {fmt.time.format(new Date(slot.startIso))}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-border bg-sand border-t px-5 py-3 text-center sm:px-6">
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-cta="appel_slots_all"
          className="text-terracotta text-sm font-semibold underline underline-offset-2"
        >
          {isFr ? "Voir toutes les disponibilités ↗" : "See all available times ↗"}
        </a>
        {/* Une ligne, pas un pavé : le visiteur n'a rien à consentir ici, mais
            il a le droit de savoir où il atterrit en cliquant. */}
        <p className="text-fg-muted mt-1.5 text-xs">
          {isFr ? "Confirmation sur Calendly (États-Unis) · " : "Confirmation on Calendly (USA) · "}
          <Link href="/sous-processeurs" className="underline underline-offset-2">
            {isFr ? "nos sous-traitants" : "our sub-processors"}
          </Link>
        </p>
      </div>
    </div>
  );
}
