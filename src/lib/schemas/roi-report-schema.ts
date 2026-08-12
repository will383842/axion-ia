// Simulateur de gains v2 — validation de la demande d'envoi du rapport.
//
// Le formulaire est volontairement minuscule : prénom et e-mail. Chaque champ
// supplémentaire coûte des abandons, et tout ce qui compte vraiment — secteur,
// effectif, maturité, volumes — a DÉJÀ été collecté par le questionnaire et
// voyage dans le champ `diagnostic`. Le nom d'entreprise reste facultatif : il
// aide à préparer un rappel, il ne conditionne rien.

import { z } from "zod";

export const roiReportRequestSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Indiquez votre prénom.")
    .max(120, "Ce nom est trop long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Cette adresse e-mail semble incorrecte.")
    .max(254),
  companyName: z.string().trim().max(200).optional(),
  /**
   * Réponses encodées (cf. `lib/roi/encode.ts`). Le serveur les redécode et
   * recalcule le rapport lui-même : rien de ce que le client affiche n'est
   * repris tel quel dans l'e-mail.
   */
  diagnostic: z
    .string()
    .trim()
    .min(6, "Diagnostic manquant.")
    .max(600, "Diagnostic invalide."),
  locale: z.string().default("fr"),
  /**
   * Consentement explicite. Obligatoire : l'e-mail sert aussi de point de
   * départ à une relance commerciale, ce que le libellé de la case dit sans
   * détour.
   */
  consent: z.literal(true, {
    errorMap: () => ({ message: "Merci de cocher la case pour recevoir votre rapport." }),
  }),
});

export type RoiReportRequest = z.infer<typeof roiReportRequestSchema>;
