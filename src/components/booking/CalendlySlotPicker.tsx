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
import type { CalendlyAvailabilityDay } from "@/server/calendly/availability";

interface CalendlySlotPickerProps {
  readonly days: readonly CalendlyAvailabilityDay[];
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

// Trois lettres, comme Calendly — « L M M J V S D » demande un effort de
// lecture parce que lundi/mardi et mardi/mercredi partagent leur initiale.
const WEEKDAYS_FR = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"] as const;
const WEEKDAYS_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

/**
 * Feuille de style émise avec le composant — UN SEUL JOUR d'horaires à la fois,
 * et pastille pleine sur le jour affiché. C'est ce qui manquait pour que ça se
 * lise comme Calendly : empiler les 28 jours donnait une longue liste où le
 * clic sur une date ne faisait que défiler.
 *
 * POURQUOI DU CSS ÉMIS ICI, et pas des classes Tailwind :
 * les règles dépendent des clés de date du jeu de créneaux, donc des valeurs
 * connues seulement à l'exécution — Tailwind ne compile que des classes
 * littérales présentes dans les sources. Un `<style>` est autorisé :
 * `style-src` porte `'unsafe-inline'` (`src/lib/csp.ts`).
 *
 * POURQUOI ÇA RESTE À ZÉRO JAVASCRIPT : la sélection passe par `:target`,
 * c'est-à-dire l'ancre `#j-AAAA-MM-JJ` déjà posée sur chaque jour. Cliquer une
 * date change le fragment d'URL, et le CSS seul fait le reste.
 *
 * DÉGRADATION — si `:has()` n'est pas supporté (Firefox < 121), AUCUNE de ces
 * règles ne s'applique : on retombe exactement sur le comportement précédent,
 * tous les jours empilés et l'ancre qui défile. Rien ne casse, et surtout aucun
 * créneau ne devient inatteignable.
 *
 * ⚠️ PAS DE COULEUR EN DUR ici : `var(--color-terracotta)` / `--color-mocha-fg`
 * viennent du `@theme` de `globals.css`. Le linter anti-hex couvre
 * `src/components`, et c'est aussi le seul moyen de suivre les tokens si la
 * palette bouge (cf. PIÈGE 3 sur l'appariement terracotta/mocha-fg).
 */
function styleUnJourALaFois(cles: readonly string[]): string {
  // Filtrage par `parseKey` AVANT toute concaténation : ces clés viennent de
  // l'API Calendly, et tout ce qui entre dans un `<style>` doit être une forme
  // que l'on a nous-mêmes validée. `AAAA-MM-JJ` ne peut contenir ni `}` ni `<`,
  // donc rien qui permette de sortir de la règle ou de la balise.
  const dateKeys = cles.filter((k) => parseKey(k) !== null);
  const premier = dateKeys[0];
  if (!premier) return "";

  const CAL = "[data-axion-cal]";
  const JOURS = "[data-axion-jours]";
  const pastillePleine = "background-color:var(--color-terracotta);color:var(--color-mocha-fg)";

  // Les sélecteurs de pastille pleine sont regroupés en UNE règle : la
  // déclaration est la même pour les 28 jours, la répéter gonflait le HTML de
  // ~2,5 Ko pour rien (page tenue à un budget serré, cf. AGENTS.md).
  const pleines = [
    // Aucune ancre active (arrivée sur la page) → premier jour porteur, comme
    // Calendly qui présélectionne la première date disponible.
    `${CAL}:not(:has(${JOURS}>li:target)) a[href="#j-${premier}"]`,
    // Puis, jour par jour, la pastille du jour ciblé.
    ...dateKeys.map((key) => `${CAL}:has(#j-${key}:target) a[href="#j-${key}"]`),
  ].join(",");

  const regles = [
    // Une ancre est active → on ne montre QUE ce jour-là.
    `${CAL} ${JOURS}:has(>li:target)>li:not(:target){display:none}`,
    // Aucune ancre → seul le premier jour est déplié.
    `${CAL} ${JOURS}:not(:has(>li:target))>li:not(:first-child){display:none}`,
    `${pleines}{${pastillePleine}}`,
  ].join("");

  // `@supports selector(:has(*))` — la garde n'est PAS décorative :
  //   1. elle dit explicitement que tout ce bloc dépend de `:has()`, et donne
  //      au navigateur qui ne l'implémente pas un repli propre (tous les jours
  //      affichés, exactement le comportement d'avant) ;
  //   2. elle protège les TESTS. jsdom ne sait pas analyser `:has()` : sans
  //      cette enveloppe, son moteur de sélecteurs lève une `SyntaxError` dès
  //      qu'un test interroge le DOM rendu, et TOUTE la suite du composant
  //      tombe (constaté : 11 tests en échec). Encapsulé, le bloc est ignoré.
  return `@supports selector(:has(*)){${regles}}`;
}

export function CalendlySlotPicker({ days, isFr, height }: CalendlySlotPickerProps) {
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
      data-axion-cal=""
      className="border-border bg-paper mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-lg"
      style={box}
    >
      {/* Contenu entièrement dérivé des clés de date (`AAAA-MM-JJ`, validées par
          `parseKey`) — aucune donnée visiteur n'y transite. */}
      <style dangerouslySetInnerHTML={{ __html: styleUnJourALaFois(days.map((d) => d.dateKey)) }} />

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
            <div key={`${month.y}-${month.m}`} className="mb-5 last:mb-0">
              <p className="text-fg mb-3 text-center text-lg font-semibold first-letter:uppercase">
                {fmt.month.format(new Date(Date.UTC(month.y, month.m - 1, 1)))}
              </p>
              <div className="grid grid-cols-7 gap-y-1.5">
                {weekdays.map((w, i) => (
                  <div
                    key={`${w}-${i}`}
                    aria-hidden="true"
                    className="text-fg-muted pb-1 text-center text-[10px] font-semibold tracking-wider"
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
                        className="text-fg-muted flex h-10 items-center justify-center text-sm"
                      >
                        {cell.d}
                      </div>
                    );
                  }
                  const libelle = fmt.dayLong.format(utcOf(cell.key));
                  return (
                    <div key={cell.key} className="flex items-center justify-center">
                      {/* Pastille pleine et TEINTÉE, pas un contour : c'est ce
                          qui rend une date disponible lisible d'un coup d'œil
                          au milieu des dates grisées. Le fond à 10 % garde le
                          texte terracotta largement au-dessus du seuil AA ; le
                          survol bascule sur l'appariement plein du design
                          system (`bg-terracotta` + `text-mocha-fg`). */}
                      <a
                        href={`#j-${cell.key}`}
                        data-cta="appel_cal_day"
                        aria-label={
                          isFr
                            ? `${libelle} — ${day.slots.length} créneaux disponibles`
                            : `${libelle} — ${day.slots.length} slots available`
                        }
                        className="bg-terracotta/10 text-terracotta hover:bg-terracotta hover:text-mocha-fg focus-visible:ring-terracotta flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {cell.d}
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Les horaires ───────────────────────────────────────────── */}
        <div className="px-5 py-4 sm:px-6 md:min-h-0 md:overflow-y-auto">
          <ul data-axion-jours="" className="mx-auto max-w-xs space-y-5 md:max-w-sm">
            {days.map((day) => (
              // `scroll-mt` : sans lui, l'ancre colle l'intitulé au bord haut de
              // la zone défilante et le rend illisible.
              <li key={day.dateKey} id={`j-${day.dateKey}`} className="scroll-mt-3">
                <p className="text-fg mb-3 text-base font-semibold first-letter:uppercase">
                  {fmt.dayLong.format(utcOf(day.dateKey))}
                </p>
                {/* Boutons PLEINE LARGEUR empilés, comme la colonne d'horaires
                    de Calendly : une cible large se vise mieux au pouce qu'une
                    pastille, et la lecture verticale suit l'ordre du temps. */}
                <ul className="space-y-2">
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
                          className="border-terracotta text-terracotta hover:bg-terracotta hover:text-mocha-fg focus-visible:ring-terracotta flex h-11 w-full items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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

      {/* PIED DE BOÎTE RETIRÉ le 2026-07-31, sur demande de Will. Il portait
          deux choses, et aucune n'est perdue :

          — « Voir toutes les disponibilités » : cette porte de sortie datait
            d'un calendrier qui n'affichait que 5 jours. Depuis, la boîte montre
            l'horizon entier (28 jours, jusqu'à 16 créneaux par jour), donc le
            lien renvoyait vers ce que la page affiche déjà. Le REPLI, lui,
            garde son propre lien externe en CTA primaire : si l'API échoue,
            `CalendlyConsentGate` reste la porte de sortie.

          — « Confirmation sur Calendly (États-Unis) · nos sous-traitants » :
            information de transparence, PAS une obligation de consentement —
            l'article 82 ne s'applique pas ici, le navigateur ne parle jamais à
            Calendly avant un clic du visiteur (cf. en-tête de ce fichier).
            ✅ VÉRIFIÉ AVANT RETRAIT : `Calendly LLC` reste déclaré comme
            sous-traitant dans `src/content/subprocessors.ts`, donc publié sur
            `/sous-processeurs`. La divulgation subsiste là où elle doit être.
            ⚠️ Si un jour on retire Calendly de ce fichier, il faudra remettre
            une information quelque part : ce serait alors la seule mention. */}
    </div>
  );
}
