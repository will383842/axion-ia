"use client";
// use-client: charge l'île des chapitres à la demande (import dynamique, navigateur seulement).

// Les chapitres et le `?t=` entrant n'ont pas besoin d'être dans le chunk de la page : ils
// vivent dans un chunk à part, chargé après l'hydratation. La place est réservée pendant le
// chargement (CLS = 0) : une ligne de bouton par chapitre.
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { chapitresAffichables } from "@/content/videos/chapitres";
import type { ChapitresVideo as ChapitresVideoType } from "./ChapitresVideo";

type Props = ComponentProps<typeof ChapitresVideoType>;

const HAUTEUR_LIGNE_PX = 32;

const Chapitres = dynamic(() => import("./ChapitresVideo").then((m) => m.ChapitresVideo), {
  ssr: false,
});

export function ChapitresVideoDiffere(props: Props) {
  const lignes = chapitresAffichables(props.dureeSecondes, props.chapitres).length;
  return (
    <div style={lignes > 0 ? { minHeight: lignes * HAUTEUR_LIGNE_PX + 12 } : undefined}>
      <Chapitres {...props} />
    </div>
  );
}
