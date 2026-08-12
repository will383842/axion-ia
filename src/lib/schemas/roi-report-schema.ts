// Simulateur de gains v2 — validation de la demande d'envoi du rapport.
//
// Le formulaire est volontairement minuscule : prénom et e-mail. Chaque champ
// supplémentaire coûte des abandons, et tout ce qui compte vraiment — secteur,
// effectif, maturité, volumes — a DÉJÀ été collecté par le questionnaire et
// voyage dans le champ `diagnostic`. Le nom d'entreprise reste facultatif : il
// aide à préparer un rappel, il ne conditionne rien.

import { z } from "zod";

export const roiReportRequestSchema = z.object({
  nom: z.string().trim().min(2, "Indiquez votre prénom.").max(120, "Ce nom est trop long."),
  email: z.string().trim().toLowerCase().email("Cette adresse e-mail semble incorrecte.").max(254),
  companyName: z.string().trim().max(200).optional(),
  /**
   * Réponses encodées (cf. `lib/roi/encode.ts`). Le serveur les redécode et
   * recalcule le rapport lui-même : rien de ce que le client affiche n'est
   * repris tel quel dans l'e-mail.
   */
  diagnostic: z.string().trim().min(6, "Diagnostic manquant.").max(600, "Diagnostic invalide."),
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

/**
 * Deuxième temps : le numéro de téléphone, demandé APRÈS l'envoi du rapport.
 *
 * ── Pourquoi il n'est pas dans le formulaire principal ────────────────────
 * Un champ de plus sur le formulaire d'entrée coûte des conversions, et le
 * téléphone est le champ le plus coûteux de tous — c'est celui qui fait dire
 * « ils vont me harceler ». Le demander une fois que la personne a déjà donné
 * son e-mail et reçu quelque chose change complètement la nature de la
 * demande : elle n'est plus le prix à payer pour voir le rapport, elle est un
 * service supplémentaire qu'on propose à quelqu'un de déjà engagé.
 *
 * ── Pourquoi la règle est plus permissive qu'ailleurs sur le site ─────────
 * `unified-contact-schema` exige un indicatif pays. Sur un formulaire de
 * contact classique, c'est justifié. Ici, refuser « 06 12 34 56 78 » — ce que
 * tape spontanément tout dirigeant français — sur un champ FACULTATIF ferait
 * exactement l'inverse de ce qu'on cherche : l'abandon d'un numéro déjà
 * consenti. On accepte donc le format national, et on range tel quel.
 */
export const roiCallbackSchema = z.object({
  submissionId: z.string().uuid("Référence invalide."),
  telephone: z
    .string()
    .trim()
    .min(8, "Numéro trop court.")
    .max(30, "Numéro trop long.")
    .regex(/^[+0-9][\s0-9()\-.]{6,28}$/, "Ce numéro semble incorrect."),
});

export type RoiCallbackRequest = z.infer<typeof roiCallbackSchema>;
