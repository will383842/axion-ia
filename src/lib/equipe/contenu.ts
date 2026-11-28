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
  /** Nom d'une icône lucide. */
  icone?: string;
  /** Carte mise en avant. */
  enAvant?: boolean;
}

/** Clé d'icône d'une ligne d'identité ou d'un chiffre clé (table côté composant). */
export type CleIcone =
  | "personne"
  | "fonction"
  | "entreprise"
  | "resultat"
  | "cible"
  | "services"
  | "zone"
  | "experience"
  | "methode"
  | "donnees"
  | "contact"
  | "langues"
  | "competences"
  | "lieu";

/** H2 en question et réponse directe de section (40 à 60 mots pour Williams). */
export interface ReponseDirecte {
  surTitre: string;
  question: string;
  reponse: string;
}

export interface ChiffreCle {
  valeur: string;
  libelle: string;
  icone?: CleIcone;
}

export type IdSection =
  | "en-bref"
  | "pour-qui"
  | "avant-apres"
  | "rassurance"
  | "methode"
  | "journee-ia"
  | "services"
  | "parcours"
  | "constats"
  | "faq";

/** Carte « Vous êtes… » : coût, action, gain qualitatif (aucun chiffre inventé). */
export interface CarteVousEtes {
  cle: string;
  titre: string;
  cout: string;
  action: string;
  gain: string;
  /** Nom d'une icône lucide. */
  icone: string;
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
  /** Chiffres clés (faits vérifiés uniquement) ; absents : bloc masqué. */
  chiffresCles?: ReadonlyArray<ChiffreCle>;
  /** Une question H2 et une réponse directe par section rendue. */
  entetes?: Partial<Record<IdSection, ReponseDirecte>>;
  /** Pastilles du héros avec icône. */
  pastillesDetaillees?: ReadonlyArray<{ libelle: string; icone?: CleIcone }>;
  /** Secteurs, phrase et lien sous les cartes « Vous êtes… ». */
  pourQui?: {
    secteurs: ReadonlyArray<{ libelle: string; icone: string }>;
    phrase?: string;
    lien?: LienFiche;
  };
  /** Bloc « Vous êtes… » : par taille puis par métier ; masqué sans données. */
  vousEtes?: {
    tailles: ReadonlyArray<CarteVousEtes>;
    metiers: ReadonlyArray<CarteVousEtes>;
  };
  /** Bloc « Partout en France » : H2 et réponse directe ; villes et régions viennent des pages de ville. */
  partoutEnFrance?: { question: string; reponse: string };
  /** Liens internes de la fiche (chaque href existe dans le routage). */
  liensInternes?: ReadonlyArray<LienFiche>;
  /** Fiche d'identité (`<dl>`). */
  identite: ReadonlyArray<{ terme: string; valeur: string; icone?: CleIcone }>;
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
    etapes: ReadonlyArray<{ numero: string; titre: string; texte: string; obtenu?: string }>;
    conclusion?: string;
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
