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

/** Sur-titre, H2 en question et réponse directe d'une section (réponse facultative ; 40 à 60 mots pour Williams). */
export interface EnteteSection {
  surTitre: string;
  question: string;
  reponse?: string;
}

/** Alias historique du lot R2c1. */
export type ReponseDirecte = EnteteSection;

/** Identifiants des sections de la fiche de Williams qui portent une réponse directe. */
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

export interface ChiffreCle {
  valeur: string;
  libelle: string;
  icone?: CleIcone;
}

/**
 * Carte « Vous êtes… » : le visiteur se reconnaît (« vous »), gains qualitatifs seulement
 * (aucun chiffre ni montant). `icone` est une clé résolue par le composant.
 */
export interface CarteVousEtes {
  cle: string;
  titre: string;
  /** Ce que la situation coûte aujourd'hui (en mots, jamais en euros). */
  cout: string;
  /** Ce que l'on peut faire. */
  action: string;
  /** Ce que l'on y gagne (qualitatif). */
  gain: string;
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
  /** Compétences / technologies renseignées par la personne (sections propres à la catégorie). */
  competences?: ReadonlyArray<string>;
  /** Sections propres à la catégorie (déjà remplies du prénom) ; absentes : aucune. */
  sectionsCategorie?: ReadonlyArray<SectionFiche>;
  /** Chiffres clés (faits vérifiés uniquement) ; absents : bloc masqué. */
  chiffresCles?: ReadonlyArray<ChiffreCle>;
  /** Par id de section : sur-titre, H2 en question et réponse directe. */
  entetes?: Readonly<Record<string, EnteteSection>>;
  /** Pastilles du héros avec icône. */
  pastillesDetaillees?: ReadonlyArray<{ libelle: string; icone?: CleIcone }>;
  /** Secteurs, phrase et lien sous les cartes « Vous êtes… ». */
  pourQui?: {
    question?: string;
    secteurs: ReadonlyArray<{ libelle: string; icone: string }>;
    phrase?: string;
    lien?: LienFiche;
  };
  /** Cartes « Vous êtes… » par taille d'entreprise (3 au plus pour une fiche de membre) ; vide : bloc masqué. */
  vousEtes?: ReadonlyArray<CarteVousEtes>;
  /** Cartes « Vous êtes… » par métier (second groupe du bloc) ; absentes : groupe masqué. */
  vousEtesMetiers?: ReadonlyArray<CarteVousEtes>;
  /** Bloc « Partout en France » : sur-titre, H2 et réponse directe ; villes et régions viennent des pages de ville. */
  presence?: { surTitre: string; question: string; reponse: string; phraseLieu?: string };
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
    /** Étiquette de moment de chaque étape (« Matin », « Après-midi »…), dans l'ordre des points. */
    moments?: ReadonlyArray<string>;
    /** Chiffres de la journée (faits déjà publiés dans le texte). */
    chiffres?: ReadonlyArray<{ valeur: string; libelle: string }>;
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
