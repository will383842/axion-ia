/**
 * Assistant de devis — types de l'état (fiche E01). PUR, client-safe.
 *
 * Règles (DECISIONS-D1-D2-ARCHITECTE) : aucune ligne facultative en v1, aucun montant d'IA,
 * aucun taux de TVA dans l'état (il vient des props), aucun calcul d'argent ici : les champs
 * d'argent sont des CHAÎNES saisies, les montants des étapes 3 et 4 viennent du serveur.
 */
import type { ActiviteFacturation } from "@/server/partners/commission";
import type { OffreDevisV1 } from "@/server/qualiopi/devis/offre-devis";

import type { Engagement, MoisPeriode, PhaseSaisie, Preavis } from "../devis-formules/saisie";

export type { Engagement, MoisPeriode, Preavis };

export const ETAPES = [1, "1b", 2, 3, 4] as const;
export type Etape = (typeof ETAPES)[number];

export type Proposition = "prix_unique" | "A" | "B" | "AB";
export type TypeLigne = "automatisation" | "formation" | "audit" | "site_web" | "libre";

/** Ligne de l'étape 1. Pas de « facultative » en v1 : toutes les lignes sont dans le prix. */
export interface LigneAssistant {
  id: string;
  type: TypeLigne;
  libelle: string;
  quantite: string;
  prixEur: string;
  delaiSemaines: string;
  /** Ids d'AUTRES lignes : information de planning, sans effet sur le prix ni sur `dependDe`. */
  necessite: string[];
  champsLibres: Array<{ nom: string; valeur: string }>;
  offreCode: string;
  /** `tier_id` des offres anciennes uniquement ; absent pour le catalogue V2. */
  offreTierId?: string;
  designationDepuisOffre: boolean;
}

export interface PhaseAssistant extends PhaseSaisie {
  id: string;
  livrable: string;
  delaiSemaines: string;
}

/** Choix d'IA : un CHOIX, jamais un montant (le forfait IA n'a pas de place sur le devis v1). */
export interface ChoixIA {
  achat: { mode: "compte_client" | "incluse"; moisInclus: string };
  abonnement: { mode: "incluse" | "non_incluse"; niveau: "essentiel" | "pro" | "etendu" };
}

export interface EtatAssistant {
  modele: ActiviteFacturation | null;
  clientId: string;
  /** Lu sur la fiche client, jamais saisi. */
  clientType: "entreprise" | "particulier" | null;
  intitule: string;
  /** Date ISO. */
  validite: string;
  origine: { projetId?: string; rencontreId?: string };
  motsDuClient: string;
  resultatVise: string;
  valeurClient: string;
  lignes: LigneAssistant[];
  proposition: Proposition;
  /** Interrupteur `qualiopi.devis_formules.actif`, reçu en props. */
  formulesActives: boolean;
  /**
   * `touche` : la phrase a déjà été initialisée ou modifiée. Une phrase VIDÉE par l'utilisateur
   * n'est alors jamais remplacée par le texte de la bibliothèque (ni en cours de saisie, ni à la
   * réouverture du brouillon). Absent d'un ancien brouillon = jamais touchée.
   */
  garantie: { afficher: boolean; jours: string; phrase: string; touche?: boolean | undefined };
  delais: { texte: string; fourchette: string; touche?: boolean | undefined };
  achat: {
    phases: PhaseAssistant[];
    hebergement: "client" | "axion";
    hebergementMensuelEur: string;
    maintenance: {
      regle: "obligatoire" | "facultative";
      mensuelEur: string;
      periodes: MoisPeriode[];
      dureeMinimale: string;
      /** Mois de maintenance offerts (entier >= 0, saisi en texte). */
      moisOfferts: string;
    };
  };
  abonnement: {
    /** Montant saisi (A + B). Gardé même en B seule, où il n'est plus utilisé. */
    miseEnServiceSaisie: string;
    miseEnServiceLibelle: string;
    phases: PhaseAssistant[];
    mensuelCatalogueEur: string;
    terme: "a_echoir" | "echu";
    periodes: Array<{ mois: MoisPeriode; remisePct: string }>;
    engagementMois: Engagement;
    reconduction: "mensuelle" | "annuelle" | "aucune";
    preavisMois: Preavis;
    indemniteTauxPct: string;
  };
  ia: ChoixIA;
  avantages: { A: string[]; B: string[] };
  servicesTiers: OffreDevisV1["servicesTiers"];
  plafondAConfirmer: OffreDevisV1["plafondAConfirmer"];
  /**
   * Saisies brutes de l'étape 2 (E14), alignées sur `servicesTiers`. Optionnelles : un brouillon
   * ancien n'en porte pas, l'écran repart alors des centimes. Elles servent à refuser une saisie
   * illisible que les centimes ne peuvent pas représenter.
   */
  servicesSaisies?: string[];
  /** Plafond : `null` = case décochée ; texte (même vide) = case cochée. */
  plafondSaisie?: string | null;
  /** Automatisations d'un devis rouvert : recopiées TELLES QUELLES, jamais réécrites. */
  automatisationsHeritees: OffreDevisV1["automatisations"];
  financement: {
    mode: "" | "direct" | "opco" | "cpf" | "france_travail";
    modaliteOpco: "" | "intra" | "inter_presentiel" | "inter_distanciel";
    nbParticipants: string;
    dureeHeures: string;
    enveloppeRestante: string;
    dateDebutSession: string;
  };
}

/** Contrat avec le serveur (C2, C3). */
export interface EtatSerialise {
  v: 1;
  etape: Etape;
  etat: EtatAssistant;
}

export type ResultatLecture =
  { ok: true; etape: Etape; etat: EtatAssistant } | { ok: false; erreur: string };
