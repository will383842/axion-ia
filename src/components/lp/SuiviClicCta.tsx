"use client";
// use-client: écoute du clic pour émettre l'événement de tunnel.

// Enveloppe de mesure autour d'un bouton déjà rendu (ex. `Cta`), sans toucher à
// son apparence.
//
// ── Pourquoi elle existe, alors que `VslCta` existe déjà ────────────────────
// `VslCta` émet « Landing CTA Clicked » avec `placement`, mais il IMPOSE son
// propre habillage (60 px, pilule terracotta). Sur l'ancienne page
// `/apporteur-affaires`, gardée comme TÉMOIN d'un test de pages, changer
// l'habillage des boutons fausserait la comparaison : on veut mesurer la page
// telle qu'elle est. Cette enveloppe ajoute la mesure et rien d'autre.
//
// `display: contents` : le conteneur n'existe pas dans la mise en page (aucun
// décalage, CLS inchangé). La capture se fait au clic dans l'enveloppe, donc
// avant la navigation vers l'ancre ou la page suivante.

import * as React from "react";
import { trackFunnel } from "@/lib/tracking";

interface SuiviClicCtaProps {
  /** Identifiant de la page (`landing`), pour comparer les variantes. */
  landing: string;
  /** Emplacement du bouton : `hero`, `montants`, `final`… (l'emplacement, pas le libellé). */
  placement: string;
  children: React.ReactNode;
}

export function SuiviClicCta({ landing, placement, children }: SuiviClicCtaProps) {
  const onClickCapture = React.useCallback(() => {
    trackFunnel("Landing CTA Clicked", { landing, placement });
  }, [landing, placement]);

  return (
    <div className="contents" onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
