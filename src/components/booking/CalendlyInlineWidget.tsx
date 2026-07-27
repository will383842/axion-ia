// Server Component — embed Calendly INLINE NATIF (audit 2026-07-06).
//
// Historique : ce composant a d'abord été un Client Component à « double voie »
// (script inline `dangerouslySetInnerHTML` + useEffect appelant manuellement
// `initInlineWidget`). Cette archi souffrait d'une COURSE d'init entre les deux
// voies + d'un mismatch d'hydratation (résidu React 418 sur /appel), d'où un
// écran blanc INTERMITTENT et l'erreur bénigne « postMessage target origin
// mismatch » (double handshake), corrigés au prix d'un F5.
//
// 2026-07-26 — LA VOIE « AUTO-INIT AU PARSE » A ÉTÉ SUPPRIMÉE VOLONTAIREMENT.
// Ne la restaure PAS en croyant corriger la régression « écran blanc ».
//
// L'archi précédente rendait `.calendly-inline-widget[data-url]` + le
// `<script async>` widget.js directement dans le HTML SSR. C'était le chemin
// officiel Calendly et il était immunisé contre l'hydratation — mais il posait
// les cookies tiers de calendly.com sur le terminal du visiteur AU PARSE, donc
// avant que la CMP (`CookieConsent`, volontairement non rendue au SSR) puisse
// seulement exister. Le gate de consentement était architecturalement
// inatteignable : Calendly gagnait toujours la course. Article 82 de la loi
// Informatique et Libertés : la simple ouverture de /fr/appel provoquait un
// accès en écriture au terminal sans information ni consentement préalable.
// Constat vérifié en prod le 2026-07-26 :
//   curl -s https://axion-ia.com/fr/appel | grep -c 'calendly-inline-widget' → 1
//
// Le chargement est désormais déclenché par un clic explicite
// (`CalendlyConsentGate`), motif « click-to-load » recommandé par la CNIL pour
// les contenus tiers. Contrepartie assumée : un clic de plus dans le funnel, et
// l'init redevient dépendante de l'hydratation — d'où le lien externe en CTA
// PRIMAIRE dans le placeholder, qui reste cliquable sans JS.
// Décision et arbitrage : docs/adr/0034-calendly-click-to-load.md (supersède la
// partie « auto-init au parse » d'ADR 0030).
//
// `<CalendlyBoot>` est inchangé et reste la brique d'init (garde
// ANTI-DOUBLE-IFRAME conservée) ; il n'est monté qu'après le clic.
//
// CSP : `script-src` (soft public) autorise déjà `https://assets.calendly.com`
// et `frame-src`/`connect-src` autorisent `calendly.com` + `*.calendly.com`.
// COEP : `unsafe-none` site-wide (proxy.ts, audit 2026-07-07) pour que l'iframe
// credentialée Calendly établisse sa session — y compris en navigation SPA (où
// une COEP `credentialless` de la page d'arrivée persistait et bloquait
// l'iframe, d'où l'ancien bug intermittent « il faut F5 »).

import { CalendlyConsentGate } from "./CalendlyConsentGate";

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
  // GARDER `hide_gdpr_banner=1`. Contre-intuitif, donc à ne pas « corriger » :
  // le bandeau natif de Calendly s'affiche DANS l'iframe, donc APRÈS que la
  // requête iframe a déjà déposé ses cookies. Il ne protège rien. Il
  // superposerait en revanche une seconde demande de consentement,
  // contradictoire avec la nôtre, juste après un clic explicite du visiteur.
  // C'est notre placeholder (CalendlyConsentGate) qui informe et recueille — et
  // qui, parce qu'on masque leur notice, mentionne les finalités propres de
  // Calendly et lie calendly.com/privacy.
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
      {/* Rien de Calendly n'est émis dans le HTML SSR : ni les deux
          `<link rel="preconnect">` (ils ouvraient un handshake TLS vers Calendly
          avant tout choix, ce qui fuite déjà l'IP du visiteur), ni widget.js, ni
          le marqueur `.calendly-inline-widget[data-url]` que cherche l'auto-scan.
          Le gate ne rend tout cela qu'après un clic explicite.

          L'ancien bloc de repli « Le calendrier ne s'affiche pas ? / Ouvrir
          Calendly directement → » a été retiré ICI et non oublié : le
          placeholder porte désormais son propre lien externe en CTA primaire,
          vers la même cible. Le conserver afficherait deux liens concurrents
          sous une question dont la prémisse est fausse avant le clic (rien n'est
          censé s'afficher), sur une surface de recueil de consentement. */}
      <CalendlyConsentGate url={finalUrl} fallbackUrl={calendlyUrl} isFr={isFr} height={height} />
    </div>
  );
}
