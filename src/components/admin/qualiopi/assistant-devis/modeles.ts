/**
 * Assistant de devis — modèles prêts à l'emploi (fiche E02). PUR, client-safe.
 *
 * Aucun montant : tout prix vaut "" (les prix sont saisis, ou résolus par le serveur).
 * Aucun taux de TVA. Les pourcentages de phases sont des parts du total, pas des sommes.
 */
import type { ActiviteFacturation } from "@/server/partners/commission";

import type { PhaseAssistant, TypeLigne } from "./types";

export interface ModeleActivite {
  activite: ActiviteFacturation;
  libelle: string;
  detail: string;
  lignes: Array<{
    type: TypeLigne;
    libelle: string;
    quantite: string;
    prixEur: "";
    delaiSemaines: string;
  }>;
}

const ligne = (type: TypeLigne, libelle: string, delaiSemaines = "") => ({
  type,
  libelle,
  quantite: "1",
  prixEur: "" as const,
  delaiSemaines,
});

export const MODELES_ACTIVITE: readonly ModeleActivite[] = [
  {
    activite: "formation",
    libelle: "Formation",
    detail: "Session, durée, participants, financement OPCO.",
    lignes: [ligne("formation", "")],
  },
  {
    activite: "un_a_un",
    libelle: "Coaching individuel",
    detail: "Séances en tête-à-tête, forfait d'heures.",
    lignes: [ligne("libre", "")],
  },
  {
    activite: "audit",
    libelle: "Audit",
    detail: "Diagnostic de vos usages et plan d'action.",
    lignes: [ligne("audit", "")],
  },
  {
    activite: "implementation",
    libelle: "Mise en place d'une IA",
    detail: "Deux formules possibles : chez vous ou chez nous.",
    lignes: [ligne("automatisation", "")],
  },
  {
    activite: "site_web",
    libelle: "Site web",
    detail: "Création ou refonte, hébergement en option.",
    lignes: [ligne("site_web", "")],
  },
];

export interface ModelePhase {
  libelle: string;
  livrable: string;
  delaiSemaines: number;
  pourcentage: number;
  declencheur: "signature" | "avancement" | "livraison";
}
export interface ModelePhases {
  nom: string;
  phases: readonly ModelePhase[];
}

const ph = (
  libelle: string,
  livrable: string,
  delaiSemaines: number,
  pourcentage: number,
  declencheur: ModelePhase["declencheur"],
): ModelePhase => ({ libelle, livrable, delaiSemaines, pourcentage, declencheur });

export const MODELES_PHASES = {
  complet: {
    nom: "Complet (6 phases)",
    phases: [
      ph(
        "Recherche et architecture globale",
        "Cahier de conception validé par vous",
        2,
        20,
        "signature",
      ),
      ph("Réalisation 1", "Première version utilisable, présentée", 2, 20, "avancement"),
      ph("Réalisation 2", "Fonctions complémentaires et tests", 2, 20, "avancement"),
      ph(
        "Livrable de l'interface (si prévu)",
        "Écrans visibles par vos équipes",
        1,
        15,
        "avancement",
      ),
      ph("Livraison du produit", "Mise en service chez vous", 1, 15, "livraison"),
      ph("Formation à l'utilisation", "Séance avec votre équipe et mémo", 1, 10, "livraison"),
    ],
  },
  court: {
    nom: "Court (3 phases)",
    phases: [
      ph("Recherche et conception", "Cahier de conception validé", 1, 30, "signature"),
      ph("Réalisation et tests", "Version complète testée", 2, 40, "avancement"),
      ph("Livraison et formation", "Mise en service et séance", 1, 30, "livraison"),
    ],
  },
  composer: {
    nom: "Composer moi-même",
    phases: [ph("Phase 1", "À décrire", 1, 100, "signature")],
  },
} as const satisfies Record<string, ModelePhases>;

export const MODELES_ECHEANCIER = {
  cent: {
    nom: "100 % à la signature",
    phases: [ph("Paiement unique", "", 0, 100, "signature")],
  },
  moitie: {
    nom: "50 % / 50 %",
    phases: [ph("Acompte", "", 0, 50, "signature"), ph("Solde", "", 0, 50, "livraison")],
  },
  trente_trente_solde: {
    nom: "30 % / 30 % / solde",
    phases: [
      ph("Acompte", "", 0, 30, "signature"),
      ph("Étape intermédiaire", "", 0, 30, "avancement"),
      ph("Solde", "", 0, 40, "livraison"),
    ],
  },
  composer: {
    nom: "Composer moi-même",
    phases: [ph("Paiement 1", "", 0, 100, "signature")],
  },
} as const satisfies Record<string, ModelePhases>;

/** Phases de l'état à partir d'un modèle ; `genererId` fournit des ids uniques. */
export function phasesDepuisModele(
  modele: ModelePhases,
  genererId: () => string,
): PhaseAssistant[] {
  return modele.phases.map((p) => ({
    id: genererId(),
    libelle: p.libelle,
    pourcentage: String(p.pourcentage),
    declencheur: p.declencheur,
    livrable: p.livrable,
    delaiSemaines: p.delaiSemaines > 0 ? String(p.delaiSemaines) : "",
  }));
}
