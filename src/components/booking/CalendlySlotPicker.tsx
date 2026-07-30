// Sélecteur de créneaux — Server Component, aucun JavaScript envoyé (ADR 0038).
//
// Ce que rend ce composant est du HTML statique : une grille de dates et une
// liste de liens. Pas de `use client`, pas d'état, pas d'iframe, pas de script
// tiers. Trois conséquences voulues :
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
// 2026-07-30 — PASSAGE EN GRILLE MENSUELLE, sur retour de Will (« que ça fasse
// plus calendrier »). La première version empilait les jours les uns sous les
// autres : correct, mais ça se lisait comme une liste, pas comme un agenda.
//
// PIÈGE 1 — ne PAS transformer ça en Client Component pour rendre la sélection
// de jour interactive. Tout l'intérêt tient au fait que cette surface ne charge
// rien. La navigation entre jours passe donc par des ANCRES (`#j-AAAA-MM-JJ`) :
// les horaires de TOUS les jours sont déjà dans la page, cliquer une date y
// défile. Zéro JS, et ça fonctionne même si React ne s'hydrate jamais.
//
// PIÈGE 2 — CLS. La boîte partage `height` et `minWidth` avec
// `CalendlyConsentGate` (constante `box` des deux côtés) : le repli et le rendu
// nominal occupent la même place. `/appel` n'est PAS dans `lighthouserc.json`,
// donc aucun gate CI ne verrait un saut de mise en page.
//
// PIÈGE 3 — couleurs. Les dates disponibles et les pastilles d'horaire utilisent
// l'appariement `outline` du design system (bordure + `text-terracotta` sur
// `bg-paper`), et l'état survolé bascule sur `bg-terracotta text-mocha-fg`. NE
// PAS écrire `bg-terracotta text-paper` : `/fr/appel` fait partie des 15 pages
// tenues à 0 violation axe serious/critical (`tests/e2e/a11y.spec.ts`) et
// `color-contrast` y est classé serious. Le design system apparie terracotta
// avec `text-mocha-fg` (`ui/button.tsx`).
//
// PIÈGE 4 — l'heure affichée est celle de PARIS, et elle est écrite comme
// telle. Calendly, lui, affichera le créneau dans le fuseau du visiteur. Le
// lien porte l'instant exact, donc les deux sont cohérents — mais retirer la
// mention « heure de Paris » rendrait l'écart incompréhensible pour un visiteur
// hors métropole.
//
// PIÈGE 5 — la grille est construite en arithmétique UTC PURE, à partir des
// clés `AAAA-MM-JJ` déjà exprimées en jour parisien par `parisDayKey()`. Ne pas
// y réintroduire de `new Date(iso)` interprété en heure locale : le décalage
// ferait glisser les cases d'un jour la moitié de l'année. Les formateurs de
// DATE sont donc en `timeZone: "UTC"` ; seul le formateur d'HEURE est en
// `Europe/Paris`, car lui part d'un instant réel.

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

/** `AAAA-MM-JJ` → composantes numériques. Aucune conversion de fuseau. */
function parseKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Lundi = 0 … dimanche = 6, en arithmétique UTC (voir PIÈGE 5). */
function mondayIndex(y: number, m: number, d: number): number {
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Jour 0 du mois suivant = dernier jour du mois demandé. */
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

interface MonthGrid {
  readonly y: number;
  readonly m: number;
  /** Cases de la grille ; `null` = case vide avant le 1er ou après le dernier. */
  readonly cells: ReadonlyArray<{ d: number; key: string } | null>;
}

/**
 * Construit une grille par mois réellement porteur de créneaux.
 *
 * On ne rend PAS les mois vides : ils n'apprendraient rien et allongeraient la
 * boîte sans raison.
 *
 * Les SEMAINES entièrement dépourvues de créneaux sont rognées en tête et en
 * queue de mois. Sans ça, un horizon qui démarre le 31 juillet affichait les
 * cinq semaines de juillet pour une seule date cliquable — le calendrier
 * paraissait vide alors qu'il ne l'est pas. Les semaines conservées gardent en
 * revanche TOUS leurs jours, y compris ceux sans créneau : c'est ce qui fait la
 * différence entre un calendrier et une liste.
 */
function buildMonths(dayKeys: readonly string[]): MonthGrid[] {
  const available = new Set(dayKeys);
  const months = new Map<string, { y: number; m: number }>();
  for (const key of dayKeys) {
    const p = parseKey(key);
    if (!p) continue;
    months.set(`${p.y}-${pad2(p.m)}`, { y: p.y, m: p.m });
  }

  return [...months.values()]
    .sort((a, b) => a.y - b.y || a.m - b.m)
    .map(({ y, m }) => {
      const cells: Array<{ d: number; key: string } | null> = [];
      for (let i = 0; i < mondayIndex(y, m, 1); i++) cells.push(null);
      for (let d = 1; d <= daysInMonth(y, m); d++) {
        cells.push({ d, key: `${y}-${pad2(m)}-${pad2(d)}` });
      }
      while (cells.length % 7 !== 0) cells.push(null);

      const weeks: Array<Array<{ d: number; key: string } | null>> = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      const porteuse = (w: (typeof weeks)[number]): boolean =>
        w.some((c) => c !== null && available.has(c.key));
      const first = weeks.findIndex(porteuse);
      const last = weeks.findLastIndex(porteuse);
      const gardees = first === -1 ? weeks : weeks.slice(first, last + 1);

      return { y, m, cells: gardees.flat() };
    });
}

function formatters(isFr: boolean) {
  const locale = isFr ? "fr-FR" : "en-GB";
  return {
    month: new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" }),
    dayLong: new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
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

const WEEKDAYS_FR = ["L", "M", "M", "J", "V", "S", "D"] as const;
const WEEKDAYS_EN = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function CalendlySlotPicker({ days, fallbackUrl, isFr, height }: CalendlySlotPickerProps) {
  const fmt = formatters(isFr);
  // Même boîte que le repli — voir PIÈGE 2.
  const box: React.CSSProperties = { minWidth: "320px", height: `${height}px` };

  const byKey = new Map(days.map((d) => [d.dateKey, d]));
  const months = buildMonths(days.map((d) => d.dateKey));
  const weekdays = isFr ? WEEKDAYS_FR : WEEKDAYS_EN;

  /** Date UTC reconstruite depuis la clé, pour les seuls intitulés. */
  const utcOf = (key: string): Date => {
    const p = parseKey(key);
    return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)) : new Date(0);
  };

  return (
    <div
      className="border-border bg-paper mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-lg"
      style={box}
    >
      <div className="border-border border-b px-5 py-3.5 text-center sm:px-6">
        <p className="text-fg text-lg font-semibold tracking-tight">
          {isFr ? "Choisissez votre créneau" : "Choose your slot"}
        </p>
        <p className="text-fg-soft mt-0.5 text-sm">
          {isFr ? "30 minutes · heure de Paris" : "30 minutes · Paris time"}
        </p>
      </div>

      {/* Deux régimes de défilement, et c'est délibéré :
          — en dessous de `md`, la colonne défile d'UN SEUL TENANT (calendrier
            puis horaires). Deux zones défilantes empilées dans 720 px donnaient
            un calendrier coupé en plein mois, avec sa propre barre : illisible.
          — à partir de `md`, chaque panneau défile indépendamment, ce qui garde
            le calendrier visible pendant qu'on parcourt les horaires. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:overflow-hidden">
        {/* ── Le calendrier ──────────────────────────────────────────── */}
        <div className="border-border shrink-0 px-4 py-4 md:min-h-0 md:overflow-y-auto md:border-r">
          {months.map((month) => (
            <div key={`${month.y}-${month.m}`} className="mb-4 last:mb-0">
              <p className="text-fg mb-2 text-center text-sm font-semibold first-letter:uppercase">
                {fmt.month.format(new Date(Date.UTC(month.y, month.m - 1, 1)))}
              </p>
              <div className="grid grid-cols-7 gap-1">
                {weekdays.map((w, i) => (
                  <div
                    key={`${w}-${i}`}
                    aria-hidden="true"
                    className="text-fg-muted pb-1 text-center text-[11px] font-medium"
                  >
                    {w}
                  </div>
                ))}
                {month.cells.map((cell, i) => {
                  if (!cell) return <div key={`vide-${i}`} aria-hidden="true" />;
                  const day = byKey.get(cell.key);
                  if (!day) {
                    return (
                      <div
                        key={cell.key}
                        className="text-fg-muted flex h-9 items-center justify-center text-sm"
                      >
                        {cell.d}
                      </div>
                    );
                  }
                  const libelle = fmt.dayLong.format(utcOf(cell.key));
                  return (
                    <a
                      key={cell.key}
                      href={`#j-${cell.key}`}
                      data-cta="appel_cal_day"
                      aria-label={
                        isFr
                          ? `${libelle} — ${day.slots.length} créneaux disponibles`
                          : `${libelle} — ${day.slots.length} slots available`
                      }
                      className="border-terracotta text-terracotta hover:bg-terracotta hover:text-mocha-fg focus-visible:ring-terracotta flex h-9 items-center justify-center rounded-lg border text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {cell.d}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-fg-muted mt-2 text-center text-[11px] leading-snug">
            {isFr
              ? "Les dates encadrées ont des créneaux libres."
              : "Outlined dates have available slots."}
          </p>
        </div>

        {/* ── Les horaires ───────────────────────────────────────────── */}
        <div className="px-5 py-4 sm:px-6 md:min-h-0 md:overflow-y-auto">
          <ul className="space-y-5">
            {days.map((day) => (
              // `scroll-mt` : sans lui, l'ancre colle l'intitulé au bord haut de
              // la zone défilante et le rend illisible.
              <li key={day.dateKey} id={`j-${day.dateKey}`} className="scroll-mt-3">
                <p className="text-fg text-sm font-semibold first-letter:uppercase">
                  {fmt.dayLong.format(utcOf(day.dateKey))}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {day.slots.map((slot) => {
                    const heure = fmt.time.format(new Date(slot.startIso));
                    return (
                      <li key={slot.startIso}>
                        <a
                          href={slot.schedulingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-cta="appel_slot_pick"
                          aria-label={
                            isFr
                              ? `Réserver ${fmt.dayLong.format(utcOf(day.dateKey))} à ${heure}`
                              : `Book ${fmt.dayLong.format(utcOf(day.dateKey))} at ${heure}`
                          }
                          className="border-border-strong text-fg bg-paper hover:border-terracotta hover:text-terracotta focus-visible:ring-primary inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold tabular-nums transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {heure}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-border bg-sand border-t px-5 py-2.5 text-center sm:px-6">
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
        <p className="text-fg-muted mt-1 text-xs">
          {isFr ? "Confirmation sur Calendly (États-Unis) · " : "Confirmation on Calendly (USA) · "}
          <Link href="/sous-processeurs" className="underline underline-offset-2">
            {isFr ? "nos sous-traitants" : "our sub-processors"}
          </Link>
        </p>
      </div>
    </div>
  );
}
