"use client";
// use-client: enveloppe du dépôt commun (FAC-10) avec l'action et les textes des apporteurs.

import {
  DepotPiece as DepotPieceCommun,
  type PieceAffichee,
} from "@/components/dossier-en-ligne/DepotPiece";

import { deposerPieceAction } from "./actions";
import { TEXTES } from "./textes";

export type { PieceAffichee };

export function DepotPiece(
  props: Omit<React.ComponentProps<typeof DepotPieceCommun>, "action" | "textes">,
) {
  return <DepotPieceCommun action={deposerPieceAction} textes={TEXTES} {...props} />;
}
