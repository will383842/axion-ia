// Form schemas — schemas restants après unification (2026-05-24).
//
// Les schemas contact/audit/auditRequest/implementation/quoteRequest et
// intervention ont été consolidés dans `unified-contact-schema.ts`. Voir
// _AUDIT/FORMS-UNIFICATION-2026-05-24/.
//
// Schemas restants :
//   - newsletterSchema : NewsletterForm + double opt-in (RFC 8058)
//
// `bookingSchema` et `option48hSchema` ont été supprimés avec le système de
// réservation payante (2026-08-26).

import { z } from "zod";

// Shared field validators
const email = z.string().email("Email invalide.");

// Newsletter (single-step)
export const newsletterSchema = z.object({
  email,
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;
