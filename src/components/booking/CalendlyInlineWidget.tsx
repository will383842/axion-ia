// Server Component — embed Calendly INLINE NATIF (audit 2026-07-06).
//
// Historique : ce composant a d'abord été un Client Component à « double voie »
// (script inline `dangerouslySetInnerHTML` + useEffect appelant manuellement
// `initInlineWidget`). Cette archi souffrait d'une COURSE d'init entre les deux
// voies + d'un mismatch d'hydratation (résidu React 418 sur /appel), d'où un
// écran blanc INTERMITTENT et l'erreur bénigne « postMessage target origin
// mismatch » (double handshake), corrigés au prix d'un F5.
//
// Nouvelle archi = embed NATIF officiel Calendly, immunisé contre l'hydratation :
//   • Ce Server Component rend un markup STATIQUE `.calendly-inline-widget`
//     avec `data-url` + le `<script async>` de widget.js, DIRECTEMENT dans le
//     HTML SSR. Au chargement direct / F5, widget.js s'exécute au parse et
//     AUTO-SCANNE le DOM → initialise le conteneur, SANS aucune dépendance à
//     React ni à l'hydratation. C'est le chemin supporté officiellement.
//     (Aucun hoistable rendu par un Client Component → leçon PR 173 respectée.)
//   • `<CalendlyBoot>` (Client, rend `null`) couvre la navigation SPA et
//     l'auto-guérison, avec une garde ANTI-DOUBLE-IFRAME → plus de course.
//
// CSP : `script-src` (soft public) autorise déjà `https://assets.calendly.com`
// et `frame-src`/`connect-src` autorisent `calendly.com` + `*.calendly.com`.
// COEP : /appel est en `unsafe-none` (cf. `isCredentialedEmbedderPath`, PR 182)
// pour que l'iframe credentialée Calendly établisse sa session.

import { CalendlyBoot } from "./CalendlyBoot";

const CALENDLY_WIDGET_JS = "https://assets.calendly.com/assets/external/widget.js";
const CALENDLY_EMBED_ID = "calendly-inline-embed";

interface CalendlyInlineWidgetProps {
  readonly calendlyUrl: string | undefined;
  readonly isFr: boolean;
  readonly height?: number;
}

const CALENDLY_BRAND = {
  primary: "c2410c",
  text: "1c1917",
  background: "fef3e6",
} as const;

function buildCalendlyUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("hide_event_type_details", "1");
  url.searchParams.set("hide_gdpr_banner", "1");
  url.searchParams.set("primary_color", CALENDLY_BRAND.primary);
  url.searchParams.set("text_color", CALENDLY_BRAND.text);
  url.searchParams.set("background_color", CALENDLY_BRAND.background);
  return url.toString();
}

export function CalendlyInlineWidget({
  calendlyUrl,
  isFr,
  height = 720,
}: CalendlyInlineWidgetProps) {
  const finalUrl = calendlyUrl ? buildCalendlyUrl(calendlyUrl) : null;

  if (!calendlyUrl || !finalUrl) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-border bg-sand mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 text-center"
      >
        <p className="text-fg text-base leading-relaxed">
          {isFr
            ? "Le calendrier en ligne est temporairement indisponible."
            : "The online calendar is temporarily unavailable."}
        </p>
        <a
          href={isFr ? "/fr/contact" : "/en/contact"}
          data-cta="appel_fallback_contact"
          className="bg-terracotta text-paper hover:bg-terracotta/90 focus-visible:ring-terracotta inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {isFr ? "Nous écrire à la place" : "Contact us instead"}
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Préconnexions (hoistables — sûrs dans un Server Component). Réduisent la
          latence du chargement de widget.js + du handshake de l'iframe, ce qui
          diminue la fenêtre de course qui provoquait l'écran blanc intermittent. */}
      <link rel="preconnect" href="https://assets.calendly.com" />
      <link rel="preconnect" href="https://calendly.com" />

      {/* Conteneur natif Calendly : classe + data-url reconnus par l'auto-scan de
          widget.js. suppressHydrationWarning car widget.js injecte une <iframe>
          enfant que React n'a pas rendue. */}
      <div
        id={CALENDLY_EMBED_ID}
        className="calendly-inline-widget mx-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-lg"
        data-url={finalUrl}
        suppressHydrationWarning
        style={{ minWidth: "320px", height: `${height}px` }}
        aria-label={isFr ? "Calendrier de prise de rendez-vous" : "Booking calendar"}
      />

      {/* Voie 1 (chargement direct / F5) : widget.js en SSR → auto-init au parse,
          indépendant de l'hydratation React. `data-calendly-loader` permet au
          shim de le retrouver sans en réinjecter un second. */}
      <script src={CALENDLY_WIDGET_JS} async data-calendly-loader="" />

      {/* Voie 2 (navigation SPA + auto-guérison) : ré-init manuel, garde-fou iframe. */}
      <CalendlyBoot url={finalUrl} />

      <div className="mx-auto mt-4 max-w-xl text-center">
        <p className="text-fg-muted text-sm">
          {isFr ? "Le calendrier ne s’affiche pas ?" : "Calendar not showing?"}{" "}
          <a
            href={calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-terracotta font-medium underline underline-offset-2"
          >
            {isFr ? "Ouvrir Calendly directement →" : "Open Calendly directly →"}
          </a>
        </p>
      </div>
    </div>
  );
}
