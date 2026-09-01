/**
 * Les questions de l'event-type, lues chez Calendly plutôt que recopiées.
 *
 * ## Pourquoi ce module ne contient AUCUN libellé
 *
 * Calendly apparie les réponses sur le **texte exact** de la question — casse et
 * accents compris. Recopier les libellés dans notre code créerait deux vérités
 * pour un seul fait, et la nôtre pourrirait au premier changement fait dans leur
 * interface. Le jour où Will reformule « Quel est votre besoin ? », notre
 * formulaire continuerait d'envoyer l'ancienne formulation, et Calendly
 * rangerait la réponse nulle part.
 *
 * Pire, et c'est le cas qui a motivé ce module : une question **ajoutée** chez
 * Calendly n'apparaîtrait jamais dans notre formulaire. Personne ne verrait
 * d'erreur — les rendez-vous continueraient d'arriver, simplement amputés d'une
 * réponse que Will croirait poser à tout le monde. Un silence de plus.
 *
 * ## 🔴 La règle qui gouverne tout le fichier
 *
 * **Une question qu'on ne sait pas rendre rend le formulaire INDISPONIBLE.**
 *
 * La tentation inverse — ignorer ce qu'on ne comprend pas et afficher le reste —
 * produit exactement la panne qu'on cherche à éviter : un formulaire qui a l'air
 * complet, une réservation qui aboutit, et une réponse obligatoire vide que
 * personne ne réclame. Mieux vaut renvoyer le visiteur sur la page Calendly, qui
 * saura poser la question, que de réserver à sa place en sautant un champ.
 *
 * C'est le même contrat que `availability.ts` : le repli n'est pas un cas
 * d'erreur, c'est le défaut.
 */

/** Les types de question que notre formulaire sait rendre. */
export const TYPES_RENDUS = ["string", "text", "phone_number", "single_select"] as const;

export type TypeQuestion = (typeof TYPES_RENDUS)[number];

export interface QuestionEventType {
  /** Le libellé EXACT, tel que Calendly le renverra dans `questions_and_answers`. */
  readonly libelle: string;
  readonly type: TypeQuestion;
  /** Position telle que Calendly la numérote — c'est elle qu'attend l'API. */
  readonly position: number;
  readonly requise: boolean;
  /** Choix proposés, pour `single_select` uniquement. */
  readonly choix: readonly string[];
  /** Le visiteur peut-il saisir une réponse libre en plus des choix ? */
  readonly autreAutorise: boolean;
  /**
   * Identifiant stable du champ dans le DOM.
   *
   * 🔑 Dérivé de la POSITION, pas du libellé. Un `name` d'input dérivé du texte
   * changerait à chaque reformulation, et une saisie en cours de route se
   * perdrait au redéploiement. La position, elle, est ce que l'API utilise déjà.
   */
  readonly champ: string;
}

/**
 * Ce que la lecture peut rendre.
 *
 * `incomplet` n'est pas une erreur technique : l'API a répondu, on a compris sa
 * réponse, et elle contient une question que nous ne savons pas poser. Le cas
 * mérite son propre nom parce que sa réponse est différente d'une panne — il
 * faut prévenir, pas réessayer.
 */
export type LectureQuestions =
  | { readonly ok: true; readonly questions: readonly QuestionEventType[] }
  | { readonly ok: false; readonly raison: "incomplet"; readonly typesInconnus: readonly string[] };

/** Préfixe des champs de question dans le formulaire. */
export const PREFIXE_CHAMP = "q";

/** Le nom du champ de formulaire pour une position donnée. */
export function champDeLaPosition(position: number): string {
  return `${PREFIXE_CHAMP}${position}`;
}

function estUnTypeRendu(v: unknown): v is TypeQuestion {
  return typeof v === "string" && (TYPES_RENDUS as readonly string[]).includes(v);
}

function texte(o: Record<string, unknown>, cle: string): string | null {
  const v = o[cle];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Traduit les `custom_questions` d'un event-type en questions rendables.
 *
 * Pure et sans réseau : c'est ici que vivent toutes les décisions, donc c'est
 * ici qu'on peut les éprouver sans dépendre de Calendly.
 */
export function lireLesQuestions(customQuestions: unknown): LectureQuestions {
  if (!Array.isArray(customQuestions)) {
    // Un event-type sans question est parfaitement légitime — et l'absence de
    // la clé se lit comme « aucune », pas comme une panne.
    return { ok: true, questions: [] };
  }

  const questions: QuestionEventType[] = [];
  const typesInconnus: string[] = [];

  for (const brut of customQuestions) {
    if (typeof brut !== "object" || brut === null) {
      // Une entrée qu'on ne sait pas lire est une question qu'on ne posera pas.
      // La sauter en silence contredirait la règle du fichier.
      typesInconnus.push("entrée illisible dans custom_questions");
      continue;
    }
    const q = brut as Record<string, unknown>;

    // 🔑 Une question DÉSACTIVÉE ne doit pas être posée : Calendly jetterait la
    // réponse, et le visiteur aurait rempli un champ pour rien. Elle n'est pas
    // pour autant un type inconnu — on l'écarte sans fermer le formulaire.
    if (q["enabled"] === false) continue;

    const libelle = texte(q, "name");
    if (!libelle) {
      // 🔴 FERME, ne saute pas. Une question active sans libellé — en cours
      // d'édition chez Calendly, ou dont le champ a changé de nom — est
      // exactement le cas que la règle de ce fichier vise : le formulaire
      // s'afficherait complet, la réservation aboutirait, et une réponse
      // peut-être obligatoire manquerait sans que personne ne l'apprenne.
      //
      // Ce `continue` silencieux a survécu à la première version alors que le
      // fichier expliquait, en majuscules et vingt lignes plus haut, pourquoi
      // il ne fallait pas le faire.
      typesInconnus.push("question active sans libellé");
      continue;
    }

    const type = q["type"];
    if (!estUnTypeRendu(type)) {
      // ⚠️ ICI se joue la règle du fichier. Un `multi_select`, un téléversement
      // ou un type que Calendly ajoutera demain arrive dans cette branche, et
      // le formulaire entier devient indisponible. C'est voulu : afficher les
      // autres champs donnerait une réservation amputée qui a l'air complète.
      typesInconnus.push(typeof type === "string" ? type : String(type));
      continue;
    }

    const position = q["position"];
    if (typeof position !== "number" || !Number.isInteger(position) || position < 0) {
      // La position N'EST PAS décorative : c'est elle que l'API attend dans
      // `questions_and_answers`. Une position illisible rendrait la réponse
      // inappariable, donc la question est traitée comme non rendable.
      typesInconnus.push(`position illisible pour « ${libelle} »`);
      continue;
    }

    const choixBruts = q["answer_choices"];
    const choix = Array.isArray(choixBruts)
      ? choixBruts.filter((c): c is string => typeof c === "string" && c.trim() !== "")
      : [];

    // Un menu déroulant sans choix ne se rend pas : le visiteur verrait une
    // liste vide et ne pourrait pas répondre à une question peut-être requise.
    if (type === "single_select" && choix.length === 0) {
      typesInconnus.push(`liste vide pour « ${libelle} »`);
      continue;
    }

    questions.push({
      libelle,
      type,
      position,
      requise: q["required"] === true,
      choix,
      autreAutorise: q["include_other"] === true,
      champ: champDeLaPosition(position),
    });
  }

  if (typesInconnus.length > 0) return { ok: false, raison: "incomplet", typesInconnus };

  // Trié sur la position, parce que c'est l'ordre que le visiteur voit chez
  // Calendly et qu'un ordre différent chez nous se remarquerait.
  questions.sort((a, b) => a.position - b.position);
  return { ok: true, questions };
}
