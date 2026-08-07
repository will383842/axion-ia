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
  /**
   * Nature de la séquence (`objectif`, `demonstration`, `pratique`,
   * `verification`, `synthese`, `cadre`, `pause`).
   *
   * C'est l'information dont un formateur a le plus besoin en salle : elle dit
   * s'il parle, s'il montre, ou s'il fait produire. Elle est écrite en base
   * depuis l'import du catalogue ; elle n'était simplement pas typée ici, donc
   * invisible pour les gabarits.
   */
  type?: string;
}

/** Module du programme détaillé. */
export interface ModuleProgramme {
  moduleId: string;
  titre: string;
  dureeMin?: number;
  sequences?: Array<SequencePedagogique>;
  /**
   * Les cinq blocs du Standard, présents quand la formation a du contenu
   * rédigé. Typés `unknown` à dessein : ce module ne valide pas le contenu
   * pédagogique — c'est `modulePedagogiqueSchema` qui en a la charge. Les
   * déclarer ici sert à les LIRE, pas à les juger.
   */
  objectif?: unknown;
  demonstration?: unknown;
  pratique?: unknown;
  verification?: unknown;
  synthese?: unknown;
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
  /** Projet fil rouge (mise en situation traversante) issu de la structure. */
  filRouge?: string;
  /** Livrables/actions concrètes attendus à J0 / J+7 / J+30 (structure). */
  livrables?: { j0: string[]; j1: string[]; j30: string[] };
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
