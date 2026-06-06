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

export const QUALIOPI_CONFIG_REGISTRY = {
  // ── Identité organisme (placeholders légaux — à renseigner par Will) ──
  nda_numero: { ...str(), description: "N° de déclaration d'activité (NDA, 11 chiffres)." },
  qualiopi_numero: { ...str(), description: "N° du certificat Qualiopi." },
  qualiopi_organisme: { ...str(), description: "Organisme certificateur Qualiopi (COFRAC)." },
  qualiopi_validite: { ...str(), description: "Date d'expiration Qualiopi (ISO YYYY-MM-DD)." },
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

  // ── Référent handicap (indicateur 26 ⭐) ──
  referent_handicap_nom: { ...str("Williams Jullin"), description: "Nom du référent handicap." },
  referent_handicap_email: { ...str(), description: "Email du référent handicap." },
  referent_handicap_telephone: { ...str(), description: "Téléphone du référent handicap." },
  referent_handicap_delai_reponse_h: {
    ...num(48),
    description: "Délai de réponse référent handicap (heures).",
  },

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
} as const satisfies Record<string, ConfigEntry<unknown>>;

export type QualiopiConfigKey = keyof typeof QUALIOPI_CONFIG_REGISTRY;
export type QualiopiConfigValue<K extends QualiopiConfigKey> =
  (typeof QUALIOPI_CONFIG_REGISTRY)[K]["default"];

/** Préfixe des clés SiteSetting du module. */
export const QUALIOPI_CONFIG_KEY_PREFIX = "qualiopi." as const;
