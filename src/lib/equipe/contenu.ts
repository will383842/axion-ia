/**
 * Contenu rédigé d'une fiche (module PUR : aucun accès base, aucun React).
 *
 * `FicheCollaborateur` porte l'identité et les règles (nom affiché, indexable…) ;
 * `ContenuFiche` porte les textes des sections. Une section absente n'est PAS
 * rendue : jamais de titre de niveau 2 sans contenu.
 */

export interface LigneAvantApres {
  avant: string;
  apres: string;
}

export interface PointTitre {
  titre: string;
  texte: string;
}

export interface LienFiche {
  href: string;
  libelle: string;
}

export interface ServiceFiche {
  id: string;
  nom: string;
  texte: string;
  liens: ReadonlyArray<LienFiche>;
}

export interface SectionFiche {
  id: string;
  titre: string;
  paragraphes: ReadonlyArray<string>;
  lien?: LienFiche;
  liste?: ReadonlyArray<string>;
}

export interface QuestionFiche {
  id: string;
  question: string;
  answer: string;
}

export interface ContenuFiche {
  /** `<title>` sans suffixe de marque. */
  titreSeo: string;
  metaDescription: string;
  /** Ligne sous le H1. */
  sousTitre: string;
  /** Date de dernière révision éditoriale (ISO) : date visible ET `dateModified`. */
  dateMiseAJour: string;
  pastilles: ReadonlyArray<string>;
  /** Bandeau de faits (2 à 4 faits vérifiables) ; absent sans faits. */
  faits?: ReadonlyArray<{ chiffre: string; libelle: string }>;
  /** Compétences / technologies renseignées par la personne (sections propres à la catégorie). */
  competences?: ReadonlyArray<string>;
  /** Sections propres à la catégorie (déjà remplies du prénom) ; absentes : aucune. */
  sectionsCategorie?: ReadonlyArray<SectionFiche>;
  /** Fiche d'identité (`<dl>`). */
  identite: ReadonlyArray<{ terme: string; valeur: string }>;
  avantApres?: { titre: string; lignes: ReadonlyArray<LigneAvantApres>; phrase: string };
  rassurance?: { titre: string; accroche: string; points: ReadonlyArray<PointTitre> };
  porteEntree?: {
    titre: string;
    accroche: string;
    points: ReadonlyArray<PointTitre>;
    bouton: string;
    lien: LienFiche;
  };
  services?: { titre: string; intro: string; items: ReadonlyArray<ServiceFiche> };
  methode?: {
    titre: string;
    etapes: ReadonlyArray<{ numero: string; titre: string; texte: string }>;
  };
  parcours?: { titre: string; blocs: ReadonlyArray<PointTitre> };
  citations?: { titre: string; items: ReadonlyArray<string> };
  faq: ReadonlyArray<QuestionFiche>;
  appelFinal: {
    titre: string;
    texte: string;
    bouton: string;
    boutonSecondaire: string;
    /** Boutons propres à la catégorie ; absents : les deux boutons par défaut. */
    actions?: ReadonlyArray<{ libelle: string; href: string; variante: "primaire" | "secondaire" }>;
  };
  /** Profils vérifiables (`sameAs`) : LinkedIn, etc. */
  liens: { linkedin?: string };
}
