// Questions propres à une offre (`JobOffer.screeningQuestions`, saisies en
// console) et réponses du candidat (champs `answer_<id>` du formulaire).
//
// Demande Will 2026-09-26 : l'offre monteur vidéo exige le prix du candidat
// (par vidéo, selon la durée). Deux conséquences :
//  - une question `required` doit être refusée CÔTÉ SERVEUR si elle manque.
//    L'attribut HTML `required` seul se contourne (requête forgée, navigateur
//    sans validation) : la question « obligatoire » ne l'était que dans le
//    navigateur.
//  - les réponses partent dans la notification Telegram, avec leur libellé :
//    c'est là que Will lit les prix, pas seulement en console.

export interface ScreeningQuestion {
  id: string;
  labelFr?: string;
  labelEn?: string;
  required?: boolean;
}

/** Longueur maximale d'une réponse stockée. */
export const ANSWER_MAX = 2000;

/**
 * Lit le JSON saisi en console. Tout élément sans `id` texte est ignoré : un
 * JSON mal formé ne doit ni planter la candidature ni inventer une question.
 */
export function parseScreeningQuestions(raw: unknown): ScreeningQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (q): q is ScreeningQuestion =>
      q != null && typeof q === "object" && typeof (q as { id?: unknown }).id === "string",
  );
}

/** Réponses non vides du formulaire, tronquées à `ANSWER_MAX`. */
export function collectAnswers(formData: FormData): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer_") && typeof value === "string" && value.trim()) {
      answers[key.slice("answer_".length)] = value.slice(0, ANSWER_MAX);
    }
  }
  return answers;
}

/** Questions obligatoires restées sans réponse. */
export function missingRequired(
  questions: ScreeningQuestion[],
  answers: Record<string, string>,
): ScreeningQuestion[] {
  return questions.filter((q) => q.required && !answers[q.id]);
}

/**
 * Réponses dans l'ordre des questions, avec leur libellé FR, pour la
 * notification. Tronquées à `maxLen` : Telegram refuse un message de plus de
 * 4 096 caractères, et cinq réponses de 2 000 le dépasseraient. Le texte
 * complet reste en console.
 */
export function labeledAnswers(
  questions: ScreeningQuestion[],
  answers: Record<string, string>,
  maxLen = 400,
): Array<{ label: string; value: string }> {
  return questions.flatMap((q) => {
    const v = answers[q.id]?.trim();
    if (!v) return [];
    return [
      {
        label: q.labelFr ?? q.labelEn ?? q.id,
        value: v.length > maxLen ? `${v.slice(0, maxLen)}…` : v,
      },
    ];
  });
}
