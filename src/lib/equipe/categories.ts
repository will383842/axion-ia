import type { Categorie, FormePoint } from "./types";
import { CATEGORIES_IDS } from "./types";
import { MODELES, type ModeleCategorie } from "./modeles-categorie";

export interface DefinitionCategorie {
  id: Categorie;
  libelleSingulier: string;
  libellePluriel: string;
  /** Nom du jeton de couleur de `globals.css` (jamais une valeur hex). */
  jetonCouleur: string;
  /** Forme du point sur la carte (daltoniens : la forme porte l'information). */
  forme: FormePoint;
  /** Ordre des sections du hub (croissant). */
  ordreHub: number;
  /** Métiers « de base » de la catégorie : ne comptent pas comme élément distinctif. */
  metiersCommuns: ReadonlyArray<string>;
  /** Sections propres, boutons d'action et FAQ modèle de la catégorie. */
  modele: ModeleCategorie;
}

export const CATEGORIES: Readonly<Record<Categorie, DefinitionCategorie>> = {
  direction: {
    id: "direction",
    libelleSingulier: "Direction",
    libellePluriel: "Direction",
    jetonCouleur: "terracotta",
    forme: "rond",
    ordreHub: 1,
    metiersCommuns: [],
    modele: MODELES["direction"],
  },
  "specialiste-ia": {
    id: "specialiste-ia",
    libelleSingulier: "Spécialiste IA",
    libellePluriel: "Spécialistes IA",
    jetonCouleur: "plum",
    forme: "carre",
    ordreHub: 2,
    metiersCommuns: ["formation-ia", "audit-ia"],
    modele: MODELES["specialiste-ia"],
  },
  developpeur: {
    id: "developpeur",
    libelleSingulier: "Développeur",
    libellePluriel: "Développeurs",
    jetonCouleur: "sage",
    forme: "triangle",
    ordreHub: 3,
    metiersCommuns: ["developpement", "implementation"],
    modele: MODELES["developpeur"],
  },
  apporteur: {
    id: "apporteur",
    libelleSingulier: "Apporteur d'affaires",
    libellePluriel: "Apporteurs d'affaires",
    jetonCouleur: "ochre",
    forme: "losange",
    ordreHub: 4,
    metiersCommuns: ["mise-en-relation"],
    modele: MODELES["apporteur"],
  },
  partenaire: {
    id: "partenaire",
    libelleSingulier: "Partenaire",
    libellePluriel: "Partenaires",
    jetonCouleur: "mocha",
    forme: "hexagone",
    ordreHub: 5,
    metiersCommuns: [],
    modele: MODELES["partenaire"],
  },
};

export function estCategorie(valeur: unknown): valeur is Categorie {
  return typeof valeur === "string" && (CATEGORIES_IDS as ReadonlyArray<string>).includes(valeur);
}

/** Catégories dans l'ordre d'affichage du hub. */
export function categoriesOrdonnees(): ReadonlyArray<DefinitionCategorie> {
  return Object.values(CATEGORIES).sort((a, b) => a.ordreHub - b.ordreHub);
}
