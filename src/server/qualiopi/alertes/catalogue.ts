/**
 * Qualiopi — Catalogue des alertes système (module PUR).
 *
 * Source de vérité : SPEC_PART2 §6.5. Aucun import Prisma ni Next.js —
 * importable par seeds, tests et workers sans effet de bord.
 *
 * `resolutionAuto: true` → synchroniserAlertes() résoudra automatiquement
 * l'alerte si la condition disparaît.
 */

import type { AlerteNiveau } from "../../../../prisma/generated/client";

export interface AlerteCatalogueEntry {
  readonly niveau: AlerteNiveau;
  readonly titre: string;
  readonly resolutionAuto: boolean;
}

/**
 * Catalogue complet des ~28 codes d'alertes (SPEC_PART2 §6.5).
 *
 * Règle de nommage : snake_case, cohérent avec le schéma DB (code VarChar(80)).
 */
export const ALERTE_CATALOGUE: Record<string, AlerteCatalogueEntry> = {
  // ── Handicap ──────────────────────────────────────────────────────────────
  referent_handicap_absent: {
    niveau: "critique",
    titre: "Référent handicap absent",
    resolutionAuto: true,
  },

  // ── Pilotage qualité ────────────────────────────────────────────────────────
  responsable_qualite_absent: {
    niveau: "important",
    titre: "Responsable qualité non désigné",
    resolutionAuto: true,
  },

  // ── Réclamations ──────────────────────────────────────────────────────────
  reclamation_sans_reponse_j15: {
    niveau: "critique",
    titre: "Réclamation sans réponse depuis +15 jours",
    resolutionAuto: true,
  },

  // ── Émargement / présence ──────────────────────────────────────────────────
  emargement_manquant: {
    niveau: "critique",
    titre: "Émargement manquant (session réalisée)",
    resolutionAuto: true,
  },
  /**
   * Angle mort structurel comblé : `emargement_manquant` ne se déclenche que sur
   * une session `realisee`, or la clôture automatique REFUSE justement de passer
   * une session en `realisee` sans trace de présence. Une session totalement non
   * émargée restait donc bloquée en `en_cours` indéfiniment, invisible du BPF,
   * des attestations et des indicateurs — sans qu'aucune alerte ne se lève.
   */
  session_bloquee_en_cours: {
    niveau: "critique",
    titre: "Session non clôturée faute d'émargement",
    resolutionAuto: true,
  },

  // ── Formateur ──────────────────────────────────────────────────────────────
  session_sans_formateur: {
    niveau: "important",
    titre: "Session à J-7 sans formateur principal",
    resolutionAuto: true,
  },

  // ── Satisfaction ──────────────────────────────────────────────────────────
  satisfaction_manquante: {
    niveau: "important",
    titre: "Questionnaire de satisfaction non rempli",
    resolutionAuto: false,
  },
  satisfaction_sous_seuil: {
    niveau: "important",
    titre: "Taux de satisfaction sous le seuil",
    resolutionAuto: false,
  },

  // ── Évaluation des acquis ──────────────────────────────────────────────────
  evaluation_acquis_manquante: {
    niveau: "critique",
    titre: "Évaluation finale des acquis manquante",
    resolutionAuto: false,
  },

  // ── Attestations ──────────────────────────────────────────────────────────
  attestation_non_envoyee: {
    niveau: "important",
    titre: "Attestation non envoyée au stagiaire",
    resolutionAuto: false,
  },

  // ── Qualiopi expiration ────────────────────────────────────────────────────
  qualiopi_expire_j90: {
    niveau: "important",
    titre: "Certification Qualiopi expire dans 90 jours",
    resolutionAuto: true,
  },
  qualiopi_expire_j30: {
    niveau: "critique",
    titre: "Certification Qualiopi expire dans 30 jours",
    resolutionAuto: true,
  },
  qualiopi_expire: {
    niveau: "critique",
    titre: "Certification Qualiopi expirée",
    resolutionAuto: false,
  },

  // ── BPF ──────────────────────────────────────────────────────────────────
  bpf_a_deposer_j60: {
    niveau: "info",
    titre: "Bilan Pédagogique et Financier à déposer (J-60)",
    resolutionAuto: true,
  },
  bpf_a_deposer_j30: {
    niveau: "important",
    titre: "Bilan Pédagogique et Financier à déposer (J-30)",
    resolutionAuto: true,
  },
  bpf_a_deposer_j7: {
    niveau: "critique",
    titre: "Bilan Pédagogique et Financier à déposer (J-7)",
    resolutionAuto: true,
  },
  bpf_en_retard: {
    niveau: "critique",
    titre: "Bilan Pédagogique et Financier en retard",
    resolutionAuto: true,
  },

  // ── Veille ────────────────────────────────────────────────────────────────
  veille_inactive_j45: {
    niveau: "important",
    titre: "Aucune entrée de veille depuis 45 jours",
    resolutionAuto: true,
  },

  // ── Emails en attente de validation ───────────────────────────────────────
  //
  // 🔴 Vérification E2E 2026-07-26. La corbeille de validation retient les
  // emails commerciaux (devis, facture, relance d'impayé) jusqu'à approbation.
  // Rien ne signalait qu'un email y dormait : un devis pouvait être « marqué
  // envoyé » côté admin sans jamais partir. `compterEnAttente()` existait sans
  // aucun appelant — c'est ici qu'il sert.
  emails_en_attente_validation: {
    niveau: "important",
    titre: "Des emails attendent votre validation",
    resolutionAuto: true,
  },

  // ── Formateurs ────────────────────────────────────────────────────────────
  cv_formateur_perime: {
    niveau: "important",
    titre: "CV formateur non mis à jour depuis 12 mois",
    resolutionAuto: true,
  },

  // ── Sous-traitants ────────────────────────────────────────────────────────
  sous_traitant_qualiopi_expire_j60: {
    niveau: "important",
    titre: "Qualiopi sous-traitant expire dans 60 jours",
    resolutionAuto: true,
  },
  sous_traitant_qualiopi_expire: {
    niveau: "critique",
    titre: "Qualiopi sous-traitant expiré (sessions futures en cours)",
    resolutionAuto: false,
  },

  // ── OPCO / financement ────────────────────────────────────────────────────
  opco_sans_accord: {
    niveau: "important",
    titre: "Session dans 7 jours sans accord OPCO",
    resolutionAuto: true,
  },
  opco_formation_demarree_sans_accord: {
    niveau: "critique",
    titre: "Formation démarrée sans accord OPCO",
    resolutionAuto: false,
  },
  convention_tripartite_manquante: {
    niveau: "critique",
    titre: "Convention tripartite manquante (subrogation OPCO)",
    resolutionAuto: true,
  },
  // Référentiel OPCO versionné (Lot 5) : le barème en vigueur d'un OPCO a un
  // relevé portail périmé (> config `bareme_opco_validite_mois`, défaut 12 mois).
  bareme_opco_perime: {
    niveau: "important",
    titre: "Barème OPCO à rafraîchir (relevé trop ancien)",
    resolutionAuto: true,
  },
  // [T17.1 — S7] Convention de formation (L.6353-1) non établie avant démarrage (off.9).
  convention_formation_manquante: {
    niveau: "critique",
    titre: "Convention de formation manquante avant démarrage",
    resolutionAuto: true,
  },

  // ── Facturation ───────────────────────────────────────────────────────────
  facture_impayee_j30: {
    niveau: "important",
    titre: "Facture impayée depuis +30 jours",
    resolutionAuto: true,
  },
  facture_impayee_j60: {
    niveau: "critique",
    titre: "Facture impayée depuis +60 jours",
    resolutionAuto: true,
  },

  // ── Dossiers de financement (suivi OPCO / France Travail) ────────────────
  // 🔴 2026-07-31 — `echeanceFinanceurAt` existait au schéma (« les OPCO paient
  // à 30-60 j ») et RIEN ne le lisait : un financeur en retard ne déclenchait
  // rien, un dossier envoyé sans réponse restait invisible. Le suivi reposait
  // sur la mémoire de l'admin — exactement ce que le tableau d'alertes existe
  // pour remplacer.
  dossier_financement_sans_reponse: {
    niveau: "important",
    titre: "Dossier de financement envoyé sans réponse depuis +30 jours",
    resolutionAuto: true,
  },
  financeur_paiement_en_retard: {
    niveau: "critique",
    titre: "Paiement du financeur en retard (échéance dépassée)",
    resolutionAuto: true,
  },

  // ── IA / système ──────────────────────────────────────────────────────────
  // Émise par le worker engine (qualiopi-formation-engine-worker) sur échec
  // définitif de génération IA (tentatives BullMQ épuisées).
  job_ia_echoue: {
    niveau: "important",
    titre: "Job IA en échec (dead letter queue)",
    resolutionAuto: false,
  },

  // ── RGPD ──────────────────────────────────────────────────────────────────
  suppression_rgpd_j30: {
    niveau: "info",
    titre: "Demande de suppression RGPD non traitée depuis 30 jours",
    resolutionAuto: false,
  },

  // ── Pilotage — cadence trimestrielle (LOT 4) ──────────────────────────────
  // Non bloquante (décision B4) : gatée par la clé de config
  // `revue_trimestrielle_activee` (défaut true).
  revue_trimestrielle_a_faire: {
    niveau: "info",
    titre: "Revue trimestrielle à réaliser",
    resolutionAuto: true,
  },
} as const;

/**
 * Convertit un niveau de spec (CRITIQUE/IMPORTANT/INFO) vers l'enum Prisma.
 * Insensible à la casse.
 */
export function niveauFromSpec(s: string): AlerteNiveau {
  switch (s.toUpperCase()) {
    case "CRITIQUE":
      return "critique";
    case "IMPORTANT":
      return "important";
    default:
      return "info";
  }
}
