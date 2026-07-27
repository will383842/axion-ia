"use client";
// use-client: état de montage local + bouton onClick. Le chargement d'un embed
// tiers ne peut pas être déclenché depuis le serveur.
//
// POURQUOI CE COMPOSANT EXISTE — art. 82 de la loi Informatique et Libertés.
// Jusqu'au 2026-07-26, /appel émettait widget.js et le conteneur
// `.calendly-inline-widget[data-url]` dans le HTML SSR. widget.js s'initialise
// AU PARSE : l'iframe Calendly et ses cookies tiers étaient posés sur le
// terminal du visiteur AVANT toute hydratation React, donc avant que la CMP
// (`CookieConsent`, volontairement non rendue au SSR) puisse exister. Le gate de
// consentement était architecturalement inatteignable — Calendly gagnait
// toujours la course. Ce n'était pas un oubli de garde, c'était structurel.
// Constat vérifié en prod avant correctif :
//   curl -s https://axion-ia.com/fr/appel | grep -c 'calendly-inline-widget' → 1
//
// PIÈGE 1 — NE PAS remettre `calendly-inline-widget` ni `data-url` dans le HTML
// rendu avant le clic. Ce sont exactement les deux marqueurs que l'auto-scan de
// widget.js cherche : s'ils existent, un widget.js chargé par n'importe quel
// autre chemin ré-initialise l'embed sans consentement et ce fichier ne sert
// plus à rien.
//
// PIÈGE 2 — NE PAS brancher ce gate sur la clé `axion-cookie-consent-v1` de la
// CMP. Ce serait la solution la plus rapide et elle est mauvaise : cette clé
// porte le consentement Microsoft Clarity (mesure d'audience). Refuser Clarity
// bloquerait alors la prise de rendez-vous ; accepter Clarity autoriserait
// silencieusement un transfert US de nature toute différente. Finalités et
// bases légales distinctes → consentement spécifique (RGPD art. 4.11).
//
// PIÈGE 3 — le choix n'est VOLONTAIREMENT pas persisté (ni localStorage, ni
// cookie). Le persister déclencherait l'obligation de l'art. 7.3 — un retrait
// aussi simple que le recueil — donc un écran de révocation dédié à construire
// et à maintenir. Ne pas cliquer = ne pas charger : le retrait est déjà trivial.
//
// PIÈGE 4 — dégradation sans JS. Si l'hydratation échoue sur /appel (résidu
// React 418, motif historique de l'archi SSR supprimée), le bouton ci-dessous
// est inerte et le calendrier devient inatteignable, alors qu'avant il
// s'affichait sans React. On transforme donc une panne intermittente
// rattrapable par F5 en panne totale — d'où le lien externe en CTA PRIMAIRE.
// Il fonctionne bien sans hydratation : /appel porte `export const revalidate =
// 86400` (appel/page.tsx:17), donc ce Client Component est pré-rendu et son
// `<a href target="_blank">` est présent dans le HTML initial. Une navigation à
// l'initiative de l'utilisateur est hors du champ de l'art. 82. NE PAS le
// rétrograder en mention secondaire : c'est ce qui a été fait de l'ancien bloc
// « Le calendrier ne s'affiche pas ? », retiré en même temps.
//
// PIÈGE 5 — CLS. Budget interne CLS = 0 strict, et /appel n'est PAS dans
// `lighthouserc.json` : aucun gate CI ne verra un saut de mise en page. Le
// placeholder et le conteneur chargé partagent la même boîte (`height`,
// `minWidth: 320px`) via la constante `box`. Ne pas modifier l'un sans l'autre.
//
// PIÈGE 6 — couleurs. NE PAS revenir à `bg-terracotta text-paper` : le design
// system apparie terracotta avec `text-mocha-fg` (`ui/button.tsx:22`), et
// /fr/appel fait partie des 15 pages tenues à 0 violation axe serious/critical
// (`tests/e2e/a11y.spec.ts`) — or `color-contrast` est classé serious. Ce
// placeholder est la PREMIÈRE surface terracotta réellement rendue sur cette
// page (l'autre occurrence est dans une branche morte en prod).

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { CalendlyBoot } from "./CalendlyBoot";

const CALENDLY_EMBED_ID = "calendly-inline-embed";

interface CalendlyConsentGateProps {
  /** URL Calendly paramétrée (couleurs, hide_event_type_details, hide_gdpr_banner). */
  readonly url: string;
  /** URL Calendly brute — cible du lien « nouvel onglet », sans nos paramètres. */
  readonly fallbackUrl: string;
  readonly isFr: boolean;
  readonly height: number;
}

export function CalendlyConsentGate({ url, fallbackUrl, isFr, height }: CalendlyConsentGateProps) {
  const [loaded, setLoaded] = React.useState(false);

  // Même boîte avant et après le clic — voir PIÈGE 5.
  const box: React.CSSProperties = { minWidth: "320px", height: `${height}px` };

  if (loaded) {
    return (
      <>
        {/* suppressHydrationWarning : widget.js injecte une <iframe> enfant que
            React n'a pas rendue. */}
        <div
          id={CALENDLY_EMBED_ID}
          className="calendly-inline-widget mx-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-lg"
          data-url={url}
          suppressHydrationWarning
          style={box}
          aria-label={isFr ? "Calendrier de prise de rendez-vous" : "Booking calendar"}
        />
        {/* CalendlyBoot injecte widget.js via document.createElement puis poll
            `window.Calendly` — aucun <script> en JSX. Sa garde anti-double-iframe
            reste indispensable : ne pas la retirer. */}
        <CalendlyBoot url={url} />
      </>
    );
  }

  return (
    <div
      className="border-border bg-sand mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-5 rounded-2xl border px-6 py-10 text-center shadow-lg"
      style={box}
    >
      <p className="text-fg text-lg font-semibold tracking-tight">
        {isFr ? "Calendrier de réservation Calendly" : "Calendly booking calendar"}
      </p>
      <p className="text-fg-soft max-w-xl text-base leading-relaxed">
        {isFr
          ? "Afficher le calendrier charge un service fourni par Calendly LLC (Atlanta, États-Unis). Calendly reçoit alors votre adresse IP, dépose ses propres cookies sur votre terminal et traite ces données pour ses propres finalités. Le transfert vers les États-Unis est encadré par les Clauses Contractuelles Types."
          : "Displaying the calendar loads a service provided by Calendly LLC (Atlanta, USA). Calendly then receives your IP address, sets its own cookies on your device and processes that data for its own purposes. The transfer to the United States is covered by Standard Contractual Clauses."}
      </p>
      <p className="text-fg-muted text-sm">
        <Link href="/sous-processeurs" className="text-terracotta underline underline-offset-2">
          {isFr ? "Nos sous-traitants" : "Our sub-processors"}
        </Link>
        {" · "}
        <Link href="/cookies" className="text-terracotta underline underline-offset-2">
          {isFr ? "Politique de cookies" : "Cookie policy"}
        </Link>
        {" · "}
        {/* On masque la notice native de Calendly (`hide_gdpr_banner=1`, cf.
            CalendlyInlineWidget) : on doit donc porter le renvoi à leur propre
            politique. Ne pas retirer ce lien. */}
        <a
          href="https://calendly.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-terracotta underline underline-offset-2"
        >
          {isFr ? "Confidentialité Calendly ↗" : "Calendly privacy ↗"}
        </a>
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setLoaded(true)}
          data-cta="appel_calendly_consent"
          className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {isFr ? "Afficher le calendrier" : "Show the calendar"}
        </button>
        {/* CTA primaire, pas une mention de bas de bloc — voir PIÈGE 4.
            Appariement `outline` du design system (border-border-strong /
            text-fg / bg-paper) : prominence égale, contraste sûr — voir PIÈGE 6. */}
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-cta="appel_calendly_new_tab"
          className="border-border-strong text-fg bg-paper hover:border-fg focus-visible:ring-primary inline-flex h-12 items-center gap-2 rounded-full border px-6 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {isFr ? "Ouvrir Calendly dans un nouvel onglet ↗" : "Open Calendly in a new tab ↗"}
        </a>
      </div>
    </div>
  );
}
