/**
 * Lecture des montants d'un devis dans la PHOTO de sa pièce
 * (`DocumentGenere.metadata.renderData.data`).
 *
 * Chemin UNIQUE partagé par la page de signature (`devis-signature-queries.ts`) et par le courriel
 * de confirmation de commande : les deux annoncent ce que le client a signé, pas ce que la
 * configuration du jour recalculerait.
 */

import { z } from "zod";
import { CONDITIONS_PARTICULIERES_MAX } from "@/server/qualiopi/devis/conditions-particulieres";
import { instantane } from "@/server/qualiopi/documents/signature/instantane";
import {
  computeTotauxFacture,
  isRegimeTva,
  TAUX_TVA_STANDARD,
  type TotauxFacture,
} from "@/server/qualiopi/legal/tva";

/**
 * La PHOTO du devis : ce qui a servi à rendre le PDF que le client signe,
 * telle que le gabarit `DevisPdf` la consomme.
 */
export const photoDevis = z.object({
  lignes: z.array(
    z.object({
      designation: z.string(),
      quantite: z.number(),
      prixUnitaireHtCents: z.number(),
      tauxTvaPercent: z.number().nullish(),
    }),
  ),
  regimeTva: z.custom<"assujetti" | "exoneration_261" | "franchise_293b">(isRegimeTva),
  tauxTvaStandardPercent: z.number().optional(),
  client: z.object({ raisonSociale: z.string() }).optional(),
  /** Conditions particulières figées avec la pièce (devis classique). Absent = aucune. */
  conditionsParticulieres: z.string().max(CONDITIONS_PARTICULIERES_MAX).optional(),
  /**
   * Phrase de primauté figée avec la pièce (v5), posée par `donneesPdfDevis` seulement quand le
   * fondateur l'a validée. Absente ou nulle = aucune phrase (photos antérieures comprises).
   */
  phrasePrimaute: z.string().nullish(),
});

export type PhotoDevis = z.infer<typeof photoDevis>;

/** La photo exploitable de `metadata`, ou `null` (absente ou illisible). */
export function lirePhotoDevis(metadata: unknown): PhotoDevis | null {
  const brut = instantane(metadata)?.data;
  if (brut === undefined) return null;
  const lu = photoDevis.safeParse(brut);
  return lu.success ? lu.data : null;
}

/** Totaux calculés avec le régime et le taux de la PHOTO, jamais ceux de la configuration. */
export function totauxDepuisPhoto(snap: PhotoDevis): TotauxFacture {
  // `exactOptionalPropertyTypes` : on retire explicitement un taux absent.
  const lignesFacturables = snap.lignes.map((l) => ({
    designation: l.designation,
    quantite: l.quantite,
    prixUnitaireHtCents: l.prixUnitaireHtCents,
    ...(typeof l.tauxTvaPercent === "number" ? { tauxTvaPercent: l.tauxTvaPercent } : {}),
  }));
  return computeTotauxFacture(
    lignesFacturables,
    snap.regimeTva,
    snap.tauxTvaStandardPercent ?? TAUX_TVA_STANDARD,
  );
}
