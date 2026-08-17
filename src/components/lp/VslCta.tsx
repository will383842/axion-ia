"use client";
// use-client: émission de l'événement de tunnel au clic.

// Bouton d'appel à l'action des pages d'atterrissage publicitaires.
//
// Il existe pour une seule raison : savoir LEQUEL des boutons a été cliqué.
// Une page de ce format en porte plusieurs (sous le titre, sous la vidéo, en
// bas), et l'emplacement qui convertit n'est jamais celui qu'on croit. Sans
// `placement`, on saurait qu'il y a eu un clic, pas d'où il vient — donc rien
// d'actionnable.
//
// L'événement part AVANT la navigation. C'est délibéré : `trackEvent` est
// synchrone et sans effet de bord bloquant, alors qu'un envoi différé serait
// perdu au déchargement de la page.

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { trackFunnel } from "@/lib/tracking";

interface VslCtaProps {
  href: string;
  label: string;
  /** `hero`, `sous-video`, `bas-de-page` — l'emplacement, pas le libellé. */
  placement: string;
  landing: string;
  className?: string;
}

export function VslCta({ href, label, placement, landing, className }: VslCtaProps) {
  const onClick = React.useCallback(() => {
    trackFunnel("Landing CTA Clicked", { landing, placement });
  }, [landing, placement]);

  return (
    <Link
      href={href as never}
      onClick={onClick}
      data-cta={`vsl-${landing}-${placement}`}
      className={cn(
        // 60 px de haut, pleine largeur au pouce : c'est le seul geste que la
        // page attend, il ne doit jamais demander de viser.
        "bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta-on-mocha flex min-h-[60px] w-full items-center justify-center gap-2.5 rounded-full px-7 text-center text-[17px] font-bold tracking-tight transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none sm:w-auto",
        className,
      )}
    >
      {label}
      <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0" />
    </Link>
  );
}
