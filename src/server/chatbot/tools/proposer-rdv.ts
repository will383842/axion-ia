// Tool `proposer_rdv` (T-15, ADR-CB-09) — renvoie le lien de prise de RDV.
//
// PAS de création serveur : on oriente vers la page Calendly/réservation FR
// (C-03 : Calendly, pas cal.com). URL toujours ∈ routes connues (FR-only).

import { z } from "zod";

export const ProposerRdvInputSchema = z
  .object({
    type_rdv: z.enum(["decouverte", "audit", "formation"]),
  })
  .strict();

export type ProposerRdvInput = z.infer<typeof ProposerRdvInputSchema>;

export interface ProposerRdvResult {
  readonly url: string;
  readonly label: string;
}

/** Mappe le type de RDV vers une page FR connue (post-redirect). */
export function proposerRdv(rawInput: unknown): ProposerRdvResult {
  const { type_rdv } = ProposerRdvInputSchema.parse(rawInput);
  switch (type_rdv) {
    case "decouverte":
      return { url: "/fr/appel", label: "Réserver un échange découverte" };
    case "audit":
    case "formation":
      return { url: "/fr/reserver", label: "Réserver un créneau" };
  }
}
