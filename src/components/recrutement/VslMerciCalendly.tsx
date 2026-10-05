"use client";
// use-client: préremplissage Calendly depuis sessionStorage, calendrier chargé au clic, écoute de la réservation — navigateur seulement.

// Choix du créneau, sur la page de merci de la page VSL apporteurs.
//
// Trois éléments, du plus sûr au plus riche :
//  1. UN GROS BOUTON « Choisir mon créneau » — un simple lien vers Calendly. Il
//     fonctionne sans JavaScript et sans consentement (navigation à l'initiative
//     du visiteur, hors du champ de l'art. 82). C'est le chemin principal.
//  2. Le calendrier INTÉGRÉ, chargé au CLIC seulement (`CalendlyConsentGate`,
//     ADR 0034) : aucun cookie Calendly avant que la personne l'ait demandé.
//  3. L'écoute de la réservation (`CalendlyEventCapture`) : une réservation faite
//     dans l'iframe est enregistrée côté site.
//
// Le serveur fournit des adresses SANS donnée personnelle. Une fois l'île
// hydratée, le prénom et l'e-mail saisis à l'étape 1 (gardés dans
// `sessionStorage`, jamais dans notre adresse) sont ajoutés à l'adresse Calendly :
// l'e-mail de réservation sera le même que celui de l'étape 1, ce qui permet de
// rattacher la réservation à la fiche (`rattachement-apporteur.ts`).

import * as React from "react";
import { trackFunnel } from "@/lib/tracking";
import { CalendarCheck } from "lucide-react";
import { CalendlyConsentGate } from "@/components/booking/CalendlyConsentGate";
import { CalendlyEventCapture } from "@/components/booking/CalendlyEventCapture";
import { lireIdentitePourMerci } from "@/lib/recrutement/vsl-etat";
import { trackMetaSchedule } from "@/lib/analytics/meta-pixel";
import { VSL_MERCI } from "@/content/recrutement/vsl-apporteur-merci";

interface VslMerciCalendlyProps {
  /** Lien Calendly direct (avec les UTM d'arrivée). */
  lien: string;
  /** Adresse d'intégration (même lien + paramètres d'affichage). */
  integre: string;
  landing: string;
  trackingContext: {
    utmSource?: string;
    utmCampaign?: string;
    utmMedium?: string;
    utmContent?: string;
    referrer?: string;
    pageUrl: string;
  };
}

const subscribeNoop = () => () => {};

/** Ajoute `name` et `email` (paramètres standard de Calendly) à une adresse. */
export function avecIdentiteCalendly(
  url: string,
  identite: { prenom: string; email: string } | null,
): string {
  if (!identite) return url;
  try {
    const u = new URL(url);
    if (identite.prenom) u.searchParams.set("name", identite.prenom);
    if (identite.email) u.searchParams.set("email", identite.email);
    return u.toString();
  } catch {
    return url;
  }
}

export function VslMerciCalendly({
  lien,
  integre,
  landing,
  trackingContext,
}: VslMerciCalendlyProps) {
  // Chaîne JSON stable (primitive) : `useSyncExternalStore` n'exige pas un objet
  // à identité stable, et le serveur rend sans identité.
  const brut = React.useSyncExternalStore(
    subscribeNoop,
    () => JSON.stringify(lireIdentitePourMerci()),
    () => "null",
  );
  const identite = React.useMemo(
    () => JSON.parse(brut) as { prenom: string; email: string } | null,
    [brut],
  );
  const lienFinal = React.useMemo(() => avecIdentiteCalendly(lien, identite), [lien, identite]);
  const integreFinal = React.useMemo(
    () => avecIdentiteCalendly(integre, identite),
    [integre, identite],
  );

  React.useEffect(() => {
    trackFunnel("Call Booking Viewed", { landing });
  }, [landing]);

  // `Schedule` (Meta) à la réservation faite dans le calendrier intégré. `eventID`
  // = `schedule:<uuid de la réservation>`, comme l'envoi serveur. Sans pixel
  // (bannière non acceptée), `trackMetaSchedule` ne fait rien.
  React.useEffect(() => {
    const surMessage = (e: MessageEvent) => {
      if (e.origin !== "https://calendly.com" && !e.origin.endsWith(".calendly.com")) return;
      const d = e.data as { event?: unknown; payload?: { event?: { uri?: unknown } } } | null;
      if (!d || d.event !== "calendly.event_scheduled") return;
      const uri = d.payload?.event?.uri;
      const id = typeof uri === "string" ? uri.split("/").filter(Boolean).pop() : undefined;
      if (id && /^[A-Za-z0-9_-]{6,80}$/.test(id)) trackMetaSchedule(`schedule:${id}`);
    };
    window.addEventListener("message", surMessage);
    return () => window.removeEventListener("message", surMessage);
  }, []);

  return (
    <>
      <CalendlyEventCapture calendlyUrl={lien} trackingContext={trackingContext} />

      <div className="flex flex-col items-center gap-3">
        <a
          href={lienFinal}
          target="_blank"
          rel="noopener noreferrer"
          data-cta="vsl-merci-creneau"
          className="bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta-deep flex min-h-[64px] w-full items-center justify-center gap-2.5 rounded-full px-8 text-center text-lg font-bold tracking-tight transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
        >
          <CalendarCheck aria-hidden="true" className="h-5 w-5 shrink-0" />
          {VSL_MERCI.cta}
        </a>
        <p className="text-fg-muted text-center text-sm">{VSL_MERCI.ctaMicro}</p>
      </div>

      <div className="mt-8">
        <CalendlyConsentGate url={integreFinal} fallbackUrl={lienFinal} isFr height={680} />
      </div>
    </>
  );
}
