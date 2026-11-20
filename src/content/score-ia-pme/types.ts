// Score IA TPE-PME — types des questions passées en props au parcours (données pures).

export interface OptionProps {
  readonly value: string;
  readonly label: string;
  /** Titre de famille (secteurs) : affiché dans le `fieldset`, jamais dans la `legend`. */
  readonly groupe?: string;
}

export interface QuestionProps {
  readonly id: string;
  readonly type: "single" | "multi";
  readonly label: string;
  readonly options: readonly OptionProps[];
  readonly max?: number;
  /** Valeur exclusive (« none ») : cocher décoche le reste, et inversement. */
  readonly exclusif?: string;
  /** Ordre aléatoire par session, tiré au démarrage ; `exclusif` et `fin` restent en dernier. */
  readonly melanger?: boolean;
  /** Mention sous la question (région, fonction : « ne change pas votre score »). */
  readonly note?: string;
}
