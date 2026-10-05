// Écran « déplacer » d'un rendez-vous SUR PLACE (2026-10-04, salon GOFAB).
//
// La réservation directe ne sait demander qu'un appel ou une visio : un
// rendez-vous sur place ne se rejoue pas depuis notre page. Afficher les
// créneaux menait donc à une impasse — « Confirmer ce nouvel horaire », puis
// un refus, en boucle. On ne les montre pas : on donne tout de suite la sortie
// qui marche. Calendly, lui, sait reporter un rendez-vous sur place : son lien
// natif (`reschedule_url`) est proposé quand la ligne le porte.

/** Seul un lien Calendly en https est proposé — jamais une URL arbitraire. */
export function lienCalendlyFiable(url: string | null | undefined): string | null {
  const v = (url ?? "").trim();
  return /^https:\/\/calendly\.com\//i.test(v) ? v : null;
}

export function ReportSurPlace({ lienCalendly }: { lienCalendly: string | null | undefined }) {
  const lien = lienCalendlyFiable(lienCalendly);
  return (
    <div>
      <h1
        className="text-fg text-[clamp(1.5rem,5vw,2rem)] leading-tight font-semibold tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Déplacer votre rendez-vous
      </h1>
      <p className="text-fg-soft mt-2 text-[15px]">
        Ce rendez-vous a lieu sur place : il ne se déplace pas depuis cette page.
      </p>
      {lien ? (
        <a
          href={lien}
          data-cta="appel_reporter_sur_place_calendly"
          className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-terracotta mt-6 flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Choisir un autre créneau
        </a>
      ) : null}
      <p className="text-fg-soft mt-4 text-[15px]">
        {lien ? "Ou répondez" : "Répondez"} simplement à l&apos;e-mail de confirmation, ou
        écrivez-nous à{" "}
        <a
          href="mailto:contact@axion-ia.com"
          className="text-terracotta-deep underline underline-offset-2"
        >
          contact@axion-ia.com
        </a>
        .
      </p>
    </div>
  );
}
