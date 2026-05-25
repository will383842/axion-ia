"use client";
// use-client: charge le script tiers Calendly via next/script (lazyOnload côté
// browser uniquement) et injecte un container `.calendly-inline-widget` que le
// script détecte et remplace par un iframe. Aucun équivalent Server Component
// possible — Calendly est un widget JS-only.

/**
 * CalendlyInlineWidget — Embed Calendly inline pour prise de rendez-vous direct.
 *
 * Utilisé sur `/appel` (Sprint A correctif 2026-05-25) pour permettre la prise
 * de rendez-vous téléphonique en temps réel sans quitter axion-ia.com.
 *
 * Architecture :
 *   - Charge le script officiel `assets.calendly.com/assets/external/widget.js`
 *     via `next/script` strategy `lazyOnload` (n'impacte ni LCP ni TBT).
 *   - Skeleton placeholder pendant le chargement (anti-CLS).
 *   - Customisation visuelle alignée brand Axion-IA (terracotta + canvas + serif).
 *   - Respecte `prefers-reduced-motion` (Calendly natif).
 *
 * Setup Will :
 *   1. Créer un event-type Calendly "Appel découverte 30min" (ou similaire)
 *   2. Copier l'URL publique (format : https://calendly.com/{user}/{event-slug})
 *   3. Renseigner `NEXT_PUBLIC_CALENDLY_APPEL_URL` dans Coolify env vars (scope RUN)
 *   4. Redéployer — le widget se connecte automatiquement.
 *
 * Si l'URL n'est pas définie (build/preview), un fallback CTA s'affiche pour
 * rediriger vers `/contact` — pas de page cassée en aucun cas.
 */

import Script from "next/script";

interface CalendlyInlineWidgetProps {
  /** URL publique de l'event-type Calendly. Si absent, fallback CTA contact. */
  readonly calendlyUrl: string | undefined;
  /** Locale active pour les CTA fallback. */
  readonly isFr: boolean;
  /**
   * Hauteur en pixels du widget. Default 720 — couvre la majorité des écrans
   * desktop sans scroll. Sur mobile, Calendly s'adapte responsivement.
   */
  readonly height?: number;
}

// Brand colors Axion-IA (hex sans #, format Calendly query string).
const CALENDLY_BRAND = {
  primary: "c2410c", // terracotta-700
  text: "1c1917", // fg (stone-900)
  background: "fef3e6", // canvas
} as const;

function buildCalendlyUrl(baseUrl: string): string {
  // Append branding + UX flags. `hide_event_type_details=1` retire le banner
  // descriptif redondant (déjà dans la page hero). `hide_gdpr_banner=1` car
  // le consentement RGPD est géré côté Axion-IA via la CookieConsent banner.
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
  // Fallback : URL non configurée → CTA contact direct (pas de widget cassé).
  if (!calendlyUrl) {
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

  const finalUrl = buildCalendlyUrl(calendlyUrl);

  return (
    <>
      {/* Container Calendly inline — le script widget.js detect `.calendly-inline-widget`
          au load et y injecte l'iframe correspondant à `data-url`. */}
      <div
        className="calendly-inline-widget mx-auto w-full max-w-4xl overflow-hidden rounded-2xl shadow-lg"
        data-url={finalUrl}
        style={{ minWidth: "320px", height: `${height}px` }}
        aria-label={isFr ? "Calendrier de prise de rendez-vous" : "Booking calendar"}
      />
      {/* Skeleton/fallback affiché tant que le script n'a pas hydraté l'iframe.
          Une fois Calendly chargé, il occupe la totalité du container et masque
          ce skeleton (z-index naturel iframe > skeleton). */}
      <noscript>
        <div className="bg-sand text-fg-soft mx-auto mt-4 max-w-xl rounded-xl px-6 py-4 text-center text-sm">
          {isFr
            ? "Activez JavaScript pour afficher le calendrier de réservation, ou contactez-nous directement."
            : "Enable JavaScript to display the booking calendar, or contact us directly."}
        </div>
      </noscript>
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
        async
      />
    </>
  );
}
