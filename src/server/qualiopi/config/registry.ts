/**
 * Qualiopi — Registre SSOT des paramètres métier (module PUR).
 *
 * Aucun import `next`/prisma/_guards ici : ce fichier est importable par les
 * seeds (scripts Node), l'admin (Server Component) et les tests sans tirer
 * `next/headers`. Les helpers d'accès DB vivent dans `site-settings.ts`.
 *
 * Réutilise `SiteSetting` (cat. `qualiopi`) — PAS de table `config_systeme`.
 * Placeholders légaux à défaut VIDE (renseignés par Will, jamais inventés).
 */

import { z } from "zod";

/** Définition typée d'une clé : schéma Zod + défaut + description. */
export interface ConfigEntry<T> {
  readonly schema: z.ZodType<T>;
  readonly default: T;
  readonly description: string;
}

const str = (def = "") => ({ schema: z.string(), default: def });
const num = (def: number) => ({ schema: z.number(), default: def });
const bool = (def: boolean) => ({ schema: z.boolean(), default: def });

export const QUALIOPI_CONFIG_REGISTRY = {
  // ── Identité organisme (placeholders légaux — à renseigner par Will) ──
  nda_numero: { ...str(), description: "N° de déclaration d'activité (NDA, 11 chiffres)." },
  qualiopi_numero: { ...str(), description: "N° du certificat Qualiopi." },
  qualiopi_organisme: { ...str(), description: "Organisme certificateur Qualiopi (COFRAC)." },
  qualiopi_validite: { ...str(), description: "Date d'expiration Qualiopi (ISO YYYY-MM-DD)." },
  qualiopi_date_obtention: {
    ...str(),
    description: "Date de délivrance du certificat Qualiopi (ISO YYYY-MM-DD).",
  },
  // Catégorie(s) d'actions certifiées figurant sur le certificat — OBLIGATOIRE
  // dans la mention qui accompagne la marque Qualiopi (règles d'usage officielles
  // du Ministère du Travail). Valeurs possibles : « Actions de formation »,
  // « Bilans de compétences », « VAE », « Actions de formation par apprentissage »
  // (séparées par « , » si plusieurs). Défaut = la catégorie visée par Axion-IA.
  qualiopi_categories_certifiees: {
    ...str("Actions de formation"),
    description: "Catégorie(s) d'actions certifiées (mention obligatoire de la marque Qualiopi).",
  },
  // Chemin/URL du fichier LOGO OFFICIEL Qualiopi (≠ logo Axion-IA `logo_url`).
  // Livré par le certificateur dans le kit de communication À LA certification.
  // Tant que vide : le badge public affiche un libellé textuel conforme, jamais
  // un faux logo. Ex. attendu : "/qualiopi/qualiopi-logo.png".
  qualiopi_logo_path: {
    ...str(),
    description: "Chemin du fichier logo officiel Qualiopi (kit certificateur).",
  },
  siret: { ...str(), description: "SIRET Axion-IA SAS." },
  raison_sociale: { ...str("Axion-IA SAS"), description: "Raison sociale (SAS France)." },
  adresse_siege: { ...str(), description: "Adresse du siège social (domiciliation Paris)." },
  adresse_exercice: {
    ...str(),
    description: "Adresse du lieu d'exercice effectif (Saint-Lattier, Isère).",
  },
  dirigeant_nom: {
    ...str("Williams Jullin"),
    description: "Nom du dirigeant / responsable pédagogique.",
  },
  dirigeant_fonction: { ...str("Président"), description: "Fonction du dirigeant." },
  logo_url: { ...str(), description: "URL du logo Axion-IA (en-tête PDF)." },
  site_url: { ...str("https://axion-ia.com"), description: "URL publique du site." },

  // ── Contact général de l'organisme (≠ référent handicap, ≠ DPO) ──
  // Imprimé comme coordonnées de l'OF prestataire sur convention/facture/réclamations.
  email_organisme: {
    ...str(),
    description: "Email de contact général de l'OF (convention, facture, réclamations).",
  },
  telephone_organisme: { ...str(), description: "Téléphone de contact général de l'OF." },
  // Délégué/point de contact protection des données (RGPD art. 13). Fallback = email_organisme.
  dpo_contact_email: {
    ...str(),
    description: "Email du DPO / contact RGPD (exercice des droits).",
  },

  // ── Référent handicap (indicateur 26 ⭐) ──
  referent_handicap_nom: { ...str("Williams Jullin"), description: "Nom du référent handicap." },
  referent_handicap_email: { ...str(), description: "Email du référent handicap." },
  referent_handicap_telephone: { ...str(), description: "Téléphone du référent handicap." },
  referent_handicap_delai_reponse_h: {
    ...num(48),
    description: "Délai de réponse référent handicap (heures).",
  },

  // ── Responsable / référent qualité (pilote le RNQ, prépare les audits) ──
  // Distinct du référent handicap et de l'assistant financement. Recommandation
  // forte de l'auditeur COFRAC : une personne identifiée pilote la démarche
  // qualité et la revue de direction (critère 7, ind. 30-32).
  responsable_qualite_nom: {
    ...str("Williams Jullin"),
    description: "Nom du responsable/référent qualité (pilote le référentiel, prépare les audits).",
  },
  responsable_qualite_email: { ...str(), description: "Email du responsable qualité." },
  responsable_qualite_telephone: { ...str(), description: "Téléphone du responsable qualité." },

  // ── Paramètres financiers (modifiables) ──
  smic_horaire_brut: {
    ...num(12.31),
    description: "SMIC horaire brut (€) — plancher rémunération formateurs.",
  },
  // Référence légale — consommée à l'affichage kit CPF (pas de builder actif v1).
  // Quand un builder de kit CPF calculera le reste à charge, appeler
  // getQualiopiConfig("cpf_reste_a_charge") pour lire cette valeur.
  cpf_reste_a_charge: { ...num(103.2), description: "Reste à charge CPF 2026 (€) — PLF 2026." },
  opco_atlas_intra_horaire: { ...num(40), description: "Plafond Atlas intra (€/h/participant)." },
  opco_atlas_inter_presentiel: {
    ...num(25),
    description: "Plafond Atlas inter présentiel (€/h/participant).",
  },
  opco_atlas_inter_distanciel: {
    ...num(15),
    description: "Plafond Atlas inter distanciel (€/h/participant).",
  },
  opco_atlas_plafond_annuel: {
    ...num(8000),
    description: "Plafond annuel Atlas par entreprise (€ HT).",
  },

  // ── Seuils réclamations ──
  seuil_reclamation_jours: {
    ...num(15),
    description: "Seuil J+15 alerte réclamation sans réponse.",
  },

  // ── Seuil satisfaction (alerte si taux moyen sous ce seuil) ──
  seuil_satisfaction_pct: {
    ...num(90),
    description: "Seuil de satisfaction (%) sous lequel une alerte est levée.",
  },

  // ── BPF (Bilan Pédagogique et Financier — dépôt DREETS) ──
  // Dernière année dont le BPF a été déposé sur maf.fr (l'admin la met à jour
  // après dépôt). Sert de marqueur réel pour les alertes BPF (≠ heuristique). [T17.1]
  bpf_annee_deposee: {
    ...num(0),
    description: "Dernière année dont le BPF a été déposé (DREETS).",
  },

  // ── Seuils pédagogiques / qualité ──
  ratio_pratique_min: {
    ...num(0.6),
    description: "Ratio pratique plancher (bloque publication si <).",
  },
  ratio_pratique_cible: { ...num(0.7), description: "Ratio pratique cible." },
  score_qualite_plancher: {
    ...num(80),
    description: "Score qualité plancher Formation Engine (/100).",
  },
  seuil_reussite_pct: { ...num(70), description: "Seuil de réussite évaluation finale (%)." },
  seuil_presence_pct: {
    ...num(80),
    description: "Seuil de présence pour attestation complète (%).",
  },
  langue_generation: { ...str("fr"), description: "Langue de génération (FR figé v1)." },

  // ── 1-to-1 / AFEST (C1, 2026-06-14) — enforcement GATED (cf. ADR Phase 0 §7) ──
  // Tous à false par défaut : la couche AFEST est livrée sans contrainte ; Will
  // active chaque flag après confirmation du certificateur. Aucune fuite tant
  // que le périmètre n'est pas certifié.
  afest_perimetre_certifie: {
    ...bool(false),
    description:
      "L'AFEST / 1-to-1 est dans le périmètre Qualiopi certifié (active mentions périmètre + finançabilité OPCO sur les documents).",
  },
  afest_tuteur_obligatoire: {
    ...bool(false),
    description:
      "Tuteur entreprise AFEST obligatoire + signataire du protocole (bloque la clôture si absent). À confirmer avec le certificateur.",
  },
  afest_formateur_habilitation_requise: {
    ...bool(false),
    description:
      "Habilitation formateur/accompagnateur AFEST requise (Trainer.afestHabiliteAt) pour animer un parcours AFEST. À confirmer avec le certificateur.",
  },
  afest_seuil_heures_min: {
    ...num(0),
    description:
      "Plancher absolu d'heures réalisées pour une attestation 1-to-1 complète (0 = pas de plancher, seuls les % d'assiduité s'appliquent).",
  },
} as const satisfies Record<string, ConfigEntry<unknown>>;

export type QualiopiConfigKey = keyof typeof QUALIOPI_CONFIG_REGISTRY;
export type QualiopiConfigValue<K extends QualiopiConfigKey> =
  (typeof QUALIOPI_CONFIG_REGISTRY)[K]["default"];

/** Préfixe des clés SiteSetting du module. */
export const QUALIOPI_CONFIG_KEY_PREFIX = "qualiopi." as const;
