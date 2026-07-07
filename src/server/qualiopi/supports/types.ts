/**
 * Qualiopi — Types partagés pour les supports de formation pédagogiques (T13).
 *
 * SupportContenu : structure de données produite par le builder pur.
 * FormationInput : données de formation nécessaires pour construire un support.
 *
 * NE PAS "use client" — usage serveur exclusif.
 */

import type { SupportType } from "../../../../prisma/generated/client";
import type { ContenuDetaille } from "@/server/qualiopi/engine/content-schema";

// Ré-export pour les consommateurs qui n'importent que ce module.
export type { SupportType } from "../../../../prisma/generated/client";

// ============================================================
// Structure de contenu d'un support
// ============================================================

/** Bloc de contenu atomique dans une section. */
export interface BlocContenu {
  type: "paragraphe" | "liste" | "objectif" | "exercice" | "note";
  texte?: string;
  items?: string[];
}

/** Section d'un support (titre + liste de blocs). */
export interface SectionContenu {
  titre: string;
  blocs: Array<BlocContenu>;
}

/**
 * Contenu structuré d'un support de formation pédagogique.
 * Produit par `construireSupport` (pur, sans I/O).
 */
export interface SupportContenu {
  sections: Array<SectionContenu>;
  meta?: Record<string, string>;
}

// ============================================================
// Input de formation pour le builder
// ============================================================

/** Séquence pédagogique dans un module. */
export interface SequencePedagogique {
  titre: string;
  dureeMin?: number;
  description?: string;
}

/** Module du programme détaillé. */
export interface ModuleProgramme {
  moduleId: string;
  titre: string;
  dureeMin?: number;
  sequences?: Array<SequencePedagogique>;
}

/**
 * Données de formation nécessaires au builder de supports.
 * Mappées depuis le modèle `Formation` Prisma (champs JSON + scalaires).
 */
export interface FormationInput {
  titre: string;
  objectifsPedagogiques: string[];
  programmeDetaille: Array<ModuleProgramme>;
  methodesPedagogiques?: string[];
  moyensTechniques?: string[];
  ressourcesPedagogiques?: string[];
  dureeHeures: number;
  /** Modalité de la formation (présentiel par défaut). Pilote les adaptations. */
  modalite?: string;
  /**
   * Contenu pédagogique détaillé structuré (concepts, exemples, exercices+corrigés,
   * quiz). Présent une fois la formation passée par l'étape « contenu » du moteur.
   * Quand présent → les builders produisent des supports RICHES ; sinon fallback squelette.
   */
  contenuDetaille?: ContenuDetaille;
}

// ============================================================
// Input de rendu support
// ============================================================

/** Données passées au composant SupportPdf et à renderSupportToStored. */
export interface SupportRenderInput {
  type: SupportType;
  titre: string;
  contenu: SupportContenu;
  version: number;
  identite: {
    raisonSociale: string;
    nda: string;
    qualiopi: string;
    siret: string;
    adresseSiege: string;
    adresseExercice: string;
    email: string;
    telephone: string;
    site: string;
  };
}
