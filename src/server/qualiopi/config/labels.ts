/**
 * Qualiopi — Libellés humains des paramètres de configuration (module PUR).
 *
 * Audit UX 2026-08-01 : la page /qualiopi/config affichait la CLÉ technique
 * brute (`bpf_annee_deposee`, `siret`, `qualiopi_validite`…) comme SEUL
 * libellé visible pour 57 des 58 réglages — illisible pour un dirigeant non
 * technicien. Seule `regime_tva` avait déjà un libellé humain (posé dans le
 * composant), preuve que le mécanisme existait sans être généralisé.
 *
 * Ce fichier centralise le dictionnaire clé → libellé (et, pour les clés à
 * choix fermé, libellé par option). Aucun import `next`/prisma ici : module
 * pur, importable par la page (Server Component) et par les tests.
 *
 * Contrat : la clé technique brute reste TOUJOURS affichée quelque part dans
 * l'UI (petit texte discret, utile au support), mais jamais seule — le
 * libellé humain est le texte visible principal.
 */

import type { QualiopiConfigKey } from "@/server/qualiopi/config/registry";

/** Libellés lisibles, regroupés par section (même découpage que registry.ts). */
export const QUALIOPI_CONFIG_LABELS: Record<QualiopiConfigKey, string> = {
  // ── Identité organisme ──
  nda_numero: "Numéro de déclaration d'activité (NDA)",
  siret: "SIRET de l'organisme",
  raison_sociale: "Raison sociale",
  adresse_siege: "Adresse du siège social",
  adresse_exercice: "Adresse du lieu d'exercice",
  dirigeant_nom: "Nom du dirigeant",
  dirigeant_fonction: "Fonction du dirigeant",
  logo_url: "URL du logo (en-tête des documents)",
  site_url: "URL du site internet",

  // ── Médiation de la consommation ──
  mediateur_consommation_nom: "Nom du médiateur de la consommation",
  mediateur_consommation_url: "Coordonnées de saisine du médiateur",

  // ── Certification Qualiopi ──
  qualiopi_numero: "Numéro du certificat Qualiopi",
  qualiopi_organisme: "Organisme certificateur (COFRAC)",
  qualiopi_validite: "Date de fin de validité du certificat Qualiopi",
  qualiopi_date_obtention: "Date d'obtention du certificat Qualiopi",
  qualiopi_categories_certifiees: "Catégories d'actions certifiées",
  qualiopi_logo_path: "Fichier du logo officiel Qualiopi",

  // ── TVA ──
  regime_tva: "Régime de TVA (facturation)",
  taux_tva_standard_percent: "Taux de TVA standard (%)",

  // ── Contact général / RGPD ──
  email_organisme: "Email de contact général",
  telephone_organisme: "Téléphone de contact général",
  dpo_contact_email: "Email du délégué à la protection des données (DPO)",

  // ── Référent handicap ──
  referent_handicap_nom: "Nom du référent handicap",
  referent_handicap_email: "Email du référent handicap",
  referent_handicap_telephone: "Téléphone du référent handicap",
  referent_handicap_delai_reponse_h: "Délai de réponse du référent handicap (heures)",

  // ── Responsable qualité ──
  responsable_qualite_nom: "Nom du responsable qualité",
  responsable_qualite_email: "Email du responsable qualité",
  responsable_qualite_telephone: "Téléphone du responsable qualité",

  // ── Paramètres financiers ──
  smic_horaire_brut: "SMIC horaire brut (€)",
  cpf_reste_a_charge: "Reste à charge CPF (€)",
  opco_atlas_intra_horaire: "Plafond OPCO Atlas — intra (€/h/participant)",
  opco_atlas_inter_presentiel: "Plafond OPCO Atlas — inter présentiel (€/h/participant)",
  opco_atlas_inter_distanciel: "Plafond OPCO Atlas — inter distanciel (€/h/participant)",
  opco_atlas_plafond_annuel: "Plafond annuel OPCO Atlas par entreprise (€ HT)",
  bareme_opco_validite_mois: "Durée de validité d'un barème OPCO (mois)",

  // ── Facturation / encaissements ──
  delai_paiement_jours: "Délai de paiement client par défaut (jours)",
  delai_paiement_financeur_jours: "Délai de paiement des financeurs/OPCO (jours)",
  taux_acompte_defaut_pct: "Taux d'acompte par défaut (%)",
  nb_echeances_solde_defaut: "Nombre d'échéances du solde par défaut",
  mode_facturation_defaut: "Mode de facturation par défaut",

  // ── Réclamations / satisfaction ──
  seuil_reclamation_jours: "Seuil d'alerte réclamation sans réponse (jours)",
  seuil_satisfaction_pct: "Seuil d'alerte satisfaction (%)",

  // ── BPF ──
  bpf_annee_deposee: "Année du Bilan Pédagogique et Financier déjà déposé",

  // ── Seuils pédagogiques / qualité ──
  ratio_pratique_min: "Ratio pratique plancher (bloquant)",
  ratio_pratique_cible: "Ratio pratique cible",
  score_qualite_plancher: "Score qualité plancher (/100)",
  seuil_reussite_pct: "Seuil de réussite à l'évaluation finale (%)",
  seuil_presence_pct: "Seuil de présence pour attestation complète (%)",
  langue_generation: "Langue de génération des documents",

  // (1-to-1 / AFEST : les 4 clés `afest_*` ont été supprimées du registre le
  //  2026-08-10 — le 1-to-1 est du conseil, hors Qualiopi.)

  // ── Périmètre indicateurs conformité ──
  off29_applicable: "Indicateur 29 (insertion professionnelle) applicable",
  procedure_reclamations_publiee: "Procédure de réclamations publiée au public",

  // ── Cadences de pilotage ──
  revue_trimestrielle_activee: "Alerte de cadence trimestrielle activée",

  // ── Gouvernance qualité ──
  gouvernance_roles: "Rôles de gouvernance qualité",
};

/** Libellés lisibles des options, pour les clés à choix fermé (rendues en <select>). */
export const QUALIOPI_CONFIG_OPTION_LABELS: Partial<
  Record<QualiopiConfigKey, Record<string, string>>
> = {
  regime_tva: {
    // Options « exonéré 261-4-4° » et « franchise 293 B » retirées le
    // 2026-08-10 (décision Will : la TVA est toujours facturée, aucune
    // exonération — même formation). Le schéma du registre ne les accepte
    // plus ; les réafficher ici sans réélargir le schéma ne ferait rien.
    assujetti: "Assujetti — TVA 20 % (seul régime autorisé)",
  },
};

/**
 * Convertit une clé `snake_case` en approximation lisible (« Bpf Annee
 * Deposee »), pour le SEUL cas où une clé future serait ajoutée au registre
 * sans entrée dans `QUALIOPI_CONFIG_LABELS` ci-dessus. Filet de sécurité —
 * l'objectif reste 58/58 clés traduites explicitement, jamais ce repli.
 */
function humanizeKeyFallback(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Résout le libellé humain d'une clé de config. Renvoie aussi `isFallback`
 * pour permettre à l'UI de signaler discrètement (support/dev) qu'une clé
 * du registre n'a pas encore été ajoutée au dictionnaire ci-dessus.
 */
export function resolveQualiopiConfigLabel(key: QualiopiConfigKey): {
  label: string;
  isFallback: boolean;
} {
  const label = QUALIOPI_CONFIG_LABELS[key];
  return label
    ? { label, isFallback: false }
    : { label: humanizeKeyFallback(key), isFallback: true };
}
