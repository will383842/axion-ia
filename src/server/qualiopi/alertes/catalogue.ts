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
  /**
   * Un bénéficiaire a déclaré un besoin d'adaptation depuis son portail.
   *
   * 🔴 Vérification en production du 2026-08-04 : la déclaration n'atteignait
   * la console PAR AUCUN CHEMIN. `declarerHandicapAction` chiffrait le besoin,
   * envoyait un message Telegram, et c'est tout — `alertes_systeme` restait
   * vide, donc RIEN sur /qualiopi/a-traiter, la première page ouverte le matin.
   * Un seul canal, hors de l'outil de travail : un besoin déclaré la veille
   * d'une session pouvait n'être vu par personne. L'écran promet pourtant
   * « nous en tiendrons compte avant la formation », et l'indicateur 26 porte
   * précisément sur l'accueil des publics en situation de handicap.
   *
   * `important` et non `critique` : le dossier n'est pas en faute, il y a un
   * geste à poser avant la session. Réserver `critique` aux manquements rend
   * les alertes critiques crédibles — c'est à celles-là qu'on doit sursauter.
   *
   * ⚠️ `resolutionAuto: false`, et c'est STRUCTUREL : l'évaluateur quotidien
   * n'émet jamais ce code (l'alerte naît du geste du bénéficiaire, pas d'un
   * balayage). Le passer à `true` ferait résoudre l'alerte par le premier
   * `synchroniserAlertes` venu, avant même que quiconque l'ait lue. Elle se
   * résout à la main, quand l'adaptation a été prise en compte.
   */
  besoin_adaptation_declare: {
    niveau: "important",
    titre: "Besoin d'adaptation déclaré par un bénéficiaire",
    resolutionAuto: false,
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
  // ── Vigilance sous-traitance (art. 4 et 8 de la procédure) [2026-08-03] ────
  //
  // 🔴 Le contrat-cadre est le SEUL de ces trois manques qui bloque l'indicateur
  // 27 : sans lui, l'intervenant n'est pas compté comme conforme, quelles que
  // soient ses autres pièces. D'où le niveau critique.
  sous_traitant_contrat_cadre_manquant: {
    niveau: "critique",
    titre: "Sous-traitant sans contrat-cadre signé",
    resolutionAuto: true,
  },
  // ⚠️ ABSENCE de RC pro = « important », pas « critique ». Décision Will du
  // 2026-08-03 : la RC pro n'est PAS exigée à l'entrée, pour ne pas réduire le
  // vivier d'intervenants. Une alerte critique permanente sur un état
  // délibérément accepté apprendrait à ignorer les alertes critiques — et ce
  // sont celles-là qui doivent faire réagir. Cf. PROCEDURE § 4.2.
  sous_traitant_rc_pro_absente: {
    niveau: "important",
    titre: "Sous-traitant sans attestation RC pro",
    resolutionAuto: true,
  },
  // 🔴 EXPIRATION, en revanche, est critique : l'attestation existait, elle a
  // été acceptée, et elle est tombée. C'est une régression de vigilance, pas un
  // état accepté.
  sous_traitant_rc_pro_expiree: {
    niveau: "critique",
    titre: "Attestation RC pro sous-traitant expirée",
    resolutionAuto: true,
  },
  sous_traitant_rc_pro_expire_j60: {
    niveau: "important",
    titre: "Attestation RC pro sous-traitant expire dans 60 jours",
    resolutionAuto: true,
  },
  // Art. 8 : les pièces se revérifient annuellement. Rappel 30 jours avant.
  sous_traitant_verification_annuelle_due: {
    niveau: "important",
    titre: "Vérification annuelle d'un sous-traitant à effectuer",
    resolutionAuto: true,
  },
  // Art. 8 : les incidents pèsent à la reconduction. « important » et non
  // « critique » — l'alerte informe, elle n'interdit pas d'affecter.
  sous_traitant_incidents_repetes: {
    niveau: "important",
    titre: "Intervenant externe : incidents répétés",
    resolutionAuto: true,
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
  /**
   * 🔴 PLUS ÉMIS depuis 2026-08-02 — conservé DÉLIBÉRÉMENT, ne pas supprimer.
   *
   * Le palier J30 est déjà couvert par une `RelanceProposee` actionnable dans le
   * hub facturation. Faire tomber les deux pour le même fait créait deux signaux
   * concurrents, avec deux cycles de vie : l'admin envoyait la relance, la
   * proposition passait `envoyee`, et l'alerte restait ouverte à côté sans plus
   * rien vouloir dire. Division du travail retenue (cf. `evaluateur.ts`) :
   * J1/J15/J30 = relance proposée (action) ; J60 = alerte critique (escalade).
   *
   * Pourquoi garder l'entrée : `synchroniserAlertes` ne résout automatiquement
   * que les codes PRÉSENTS dans ce catalogue avec `resolutionAuto: true`. La
   * retirer figerait à vie les alertes `facture_impayee_j30` déjà en base — y
   * compris sur des factures depuis longtemps réglées.
   */
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
  /**
   * Filet de sécurité du circuit de recouvrement.
   *
   * Une facture émise sans `echeanceAt` n'est relançable par RIEN : le cron de
   * retard compare `echeanceAt < now`, et aucune comparaison SQL n'est vraie
   * pour NULL. La créance vieillit sans jamais apparaître nulle part.
   *
   * Le cron répare désormais ces lignes tout seul (cf. `handleFacturesRetard`),
   * mais cette alerte reste utile : elle couvre la fenêtre entre la création et
   * le passage quotidien, et surtout elle DÉNONCE un chemin de création
   * défaillant — si elle revient, c'est qu'un émetteur a de nouveau oublié la
   * colonne. `resolutionAuto` : elle disparaît d'elle-même dès l'échéance posée.
   */
  facture_sans_echeance: {
    niveau: "important",
    titre: "Facture émise sans date d'échéance",
    resolutionAuto: true,
  },
  /**
   * Relance envoyée, restée sans effet.
   *
   * Demande explicite du propriétaire : « des alertes pour me dire les relances
   * passées ». Envoyer une relance n'est pas un résultat — c'est le résultat qui
   * compte. Une relance partie il y a plus de quinze jours sans le moindre
   * encaissement depuis signale que le palier suivant est dû, ou qu'une décision
   * l'est (échéancier, mise en demeure, recouvrement).
   *
   * `resolutionAuto` : disparaît d'elle-même dès que la facture est soldée.
   */
  relance_sans_effet: {
    niveau: "important",
    titre: "Relance envoyée sans effet depuis +15 jours",
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
  // 🔴 Audit du 2026-08-01 — titre aligné sur celui réellement écrit par le
  // worker (métier, sans jargon « dead letter queue ») : cette entrée n'est que
  // documentaire (le titre effectif est fixé à la création), mais une
  // divergence induirait en erreur quiconque lit ce catalogue comme référence.
  job_ia_echoue: {
    niveau: "important",
    titre: "Génération IA d'une formation en échec",
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
