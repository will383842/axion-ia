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
  /**
   * Forme du champ (2026-09-26, demande Will) :
   *  - `price` : UN SEUL montant en euros, jamais une fourchette. « 200 à
   *    300 € » laisse la négociation ouverte ; Will veut le prix exact de
   *    chaque prestation pour comparer les candidats. Refusé côté serveur
   *    s'il ne s'agit pas d'un nombre.
   *  - `short` : une ligne (matériel, ville de départ…).
   *  - absent : zone de texte libre, comme avant.
   * Une valeur inconnue retombe sur la zone de texte : un JSON saisi en
   * console ne doit jamais casser le formulaire.
   */
  type?: "price" | "short";
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

/**
 * Un montant, et un seul : « 250 », « 250 € », « 1 200 », « 49,90 ». Tout ce
 * qui ressemble à une fourchette (« 200-300 », « 200 à 300 », « à partir de »)
 * est refusé.
 */
const MONTANT = /^\d{1,3}(?:[ \u00a0\u202f]?\d{3})*(?:[.,]\d{1,2})?$/;

/** Le montant nettoyé (« 1 200,50 € » → « 1200,50 »), ou `null` s'il n'en est pas un. */
export function normaliserMontant(brut: string): string | null {
  const v = brut
    .trim()
    .replace(/\s*(€|eur|euros?)\s*$/i, "")
    .trim();
  if (!MONTANT.test(v)) return null;
  return v.replace(/[ \u00a0\u202f]/g, "");
}

/** Questions `price` dont la réponse n'est pas UN montant. */
export function prixInvalides(
  questions: ScreeningQuestion[],
  answers: Record<string, string>,
): ScreeningQuestion[] {
  return questions.filter(
    (q) => q.type === "price" && answers[q.id] && normaliserMontant(answers[q.id]!) === null,
  );
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
    const brut = answers[q.id]?.trim();
    if (!brut) return [];
    // Un prix se lit « 250 € » dans Telegram, quelle que soit la saisie.
    const montant = q.type === "price" ? normaliserMontant(brut) : null;
    const v = montant !== null ? `${montant} €` : brut;
    return [
      {
        label: q.labelFr ?? q.labelEn ?? q.id,
        value: v.length > maxLen ? `${v.slice(0, maxLen)}…` : v,
      },
    ];
  });
}
