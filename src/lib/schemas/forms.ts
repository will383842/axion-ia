// Form schemas — schemas restants après unification (2026-05-24).
//
// Les schemas contact/audit/auditRequest/implementation/quoteRequest et
// intervention ont été consolidés dans `unified-contact-schema.ts`. Voir
// _AUDIT/FORMS-UNIFICATION-2026-05-24/.
//
// Schemas restants :
//   - demandeGuideSchema : formulaire du guide IA (page du guide + encarts
//     d'articles) — lot L2, 2026-09-24.
//
// `bookingSchema` et `option48hSchema` ont été supprimés avec le système de
// réservation payante (2026-08-26).

import { z } from "zod";

// Shared field validators
const email = z.string().trim().toLowerCase().email("Email invalide.");

/**
 * Demande du guide IA (lot L2, 2026-09-24).
 *
 * 🔴 Remplace `newsletterSchema`, dont `consent: z.literal(true)` couvrait DEUX
 * finalités d'une seule case OBLIGATOIRE : recevoir le guide ET la lettre. Un
 * consentement à la lettre dont dépend le guide est présumé non libre (RGPD
 * art. 7.4, considérant 43). Décision n° 1 de Will : le guide part sur la seule
 * adresse ; la lettre est une case FACULTATIVE, décochée par défaut.
 */
export const demandeGuideSchema = z.object({
  email,
  lettre: z.boolean().default(false),
});
export type DemandeGuideInput = z.infer<typeof demandeGuideSchema>;
