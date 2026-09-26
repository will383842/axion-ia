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
  /**
   * Libellé COURT pour Telegram (« demi-journée », « 30 s », « son/lumière »).
   * Le libellé complet reste celui du formulaire et de la console.
   */
  court?: string;
  /**
   * Ligne Telegram où regrouper la réponse (« Matériel », « Exemples »).
   * Les prix se regroupent d'office sur la ligne « Prix ».
   *
   * 🔑 Pourquoi : un message Telegram est plafonné à 10 lignes (règle de Will,
   * `channels/telegram.ts`). Neuf questions sur neuf lignes coupaient le
   * message au deuxième prix — mesuré en production le 2026-09-26 (« TRONQUE
   * 11 lignes »). Regroupées, elles tiennent en quatre.
   */
  ligne?: string;
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

/**
 * Une réponse telle qu'on la LIT : un prix devient « 250 € », quelle que soit
 * la saisie (« 250 », « 250 € », « 250 euros »). Telegram et la console passent
 * par ici : le 2026-09-26, la console affichait « 250 » et « 450 € » côte à
 * côte pour le même candidat, pendant que Telegram lisait « 250 € ».
 * Tout le reste est rendu tel quel.
 */
export function valeurAffichee(q: ScreeningQuestion | undefined, brut: string): string {
  const montant = q?.type === "price" ? normaliserMontant(brut) : null;
  return montant !== null ? `${montant} €` : brut;
}

/** Questions obligatoires restées sans réponse. */
export function missingRequired(
  questions: ScreeningQuestion[],
  answers: Record<string, string>,
): ScreeningQuestion[] {
  return questions.filter((q) => q.required && !answers[q.id]);
}

/**
 * Les réponses, en LIGNES prêtes pour Telegram, dans l'ordre des questions.
 *
 *  - Une question sans `ligne` (et qui n'est pas un prix) fait sa propre ligne,
 *    sous son libellé court, sinon complet.
 *  - Les questions d'une même `ligne` — et tous les prix, sur « Prix » — sont
 *    réunies : « Prix : demi-journée 180 € · journée 320 € ».
 *  - Un retour à la ligne dans une réponse (plusieurs liens) devient « · » : il
 *    compterait sinon comme une ligne de plus contre le plafond de 10.
 *  - Chaque ligne est tronquée à `maxLen` : le message entier est plafonné à
 *    800 caractères. Le texte complet reste en console.
 */
export function labeledAnswers(
  questions: ScreeningQuestion[],
  answers: Record<string, string>,
  maxLen = 180,
): Array<{ label: string; value: string }> {
  const lignes = new Map<string, string[]>();
  for (const q of questions) {
    const brut = answers[q.id]?.trim();
    if (!brut) continue;
    const valeur = valeurAffichee(q, brut).replace(/\s*\n\s*/g, " · ");
    const groupe = q.ligne ?? (q.type === "price" ? "Prix" : undefined);
    if (groupe) {
      const morceau = q.court ? `${q.court} ${valeur}` : valeur;
      lignes.set(groupe, [...(lignes.get(groupe) ?? []), morceau]);
    } else {
      lignes.set(q.court ?? q.labelFr ?? q.labelEn ?? q.id, [valeur]);
    }
  }
  return [...lignes].map(([label, morceaux]) => {
    const v = morceaux.join(" · ");
    return { label, value: v.length > maxLen ? `${v.slice(0, maxLen)}…` : v };
  });
}
