/** Ce que la page « Pilotage SEO & IA » reçoit. `null` = section indisponible (jamais 0). */
import type { ModePilotage } from "../interrupteur";
import type { LigneRequeteEcran } from "./requetes";
import type { SourceEtat } from "./sources";
import type { LigneVue } from "./vue";

export interface LignePageEcran {
  readonly chemin: string;
  readonly typePage: string;
  readonly clics: number;
  readonly impressions: number;
  readonly position: number | null;
}

export interface OpportuniteEcran {
  readonly id: string;
  readonly detecteur: string;
  readonly cible: string;
  readonly typePage: string | null;
  readonly priorite: number;
  readonly motif: string | null;
  readonly signalement: boolean;
}

export interface ImportEcran {
  readonly jour: string;
  readonly statut: string;
  readonly nbLignesPage: number;
  readonly nbLignesRequete: number;
  readonly tentatives: number;
  readonly erreurCode: string | null;
}

export interface ModeleActif {
  readonly etat: "actif";
  readonly mode: ModePilotage;
  readonly source: SourceEtat;
  readonly donneesJusquAu: string | null;
  /** Les 28 jours récents ont tous été importés. */
  readonly fenetreCouranteComplete: boolean;
  /** Les 28 jours d'avant sont complets : sinon aucune évolution n'est calculée. */
  readonly comparaisonPossible: boolean;
  readonly vue: LigneVue[] | null;
  readonly pages: LignePageEcran[] | null;
  readonly requetes: LigneRequeteEcran[] | null;
  readonly opportunites: OpportuniteEcran[] | null;
  readonly imports: ImportEcran[] | null;
}

export type ModelePilotage = { readonly etat: "eteint" } | ModeleActif;
