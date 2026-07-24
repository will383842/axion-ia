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
import { REGIME_TVA_DEFAUT } from "@/server/qualiopi/legal/tva";

/** Définition typée d'une clé : schéma Zod + défaut + description. */
export interface ConfigEntry<T> {
  readonly schema: z.ZodType<T>;
  readonly default: T;
  readonly description: string;
}

// Les clés `num`/`bool` ont pu, au fil des versions du registre, stocker des
// valeurs mal typées (bool `false` ou chaîne `""` sur une clé passée en number),
// et les formulaires HTML postent toujours des chaînes. On normalise donc à la
// LECTURE comme à l'ÉCRITURE via `z.preprocess` : une valeur exploitable est
// convertie, sinon le préprocesseur renvoie `undefined` → le schéma sous-jacent
// échoue → getQualiopiConfig retombe sur le défaut du registre. On n'utilise PAS
// `z.coerce.number()` : il mapperait `false`/`""` sur `0` et masquerait le défaut.
const numSchema = z.preprocess(
  (v) =>
    typeof v === "number" && Number.isFinite(v)
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? ((n) => (Number.isFinite(n) ? n : undefined))(Number(v.trim().replace(",", ".")))
        : undefined,
  z.number(),
);
const boolSchema = z.preprocess(
  (v) =>
    typeof v === "boolean"
      ? v
      : v === "true" || v === 1 || v === "1"
        ? true
        : v === "false" || v === 0 || v === "0"
          ? false
          : undefined,
  z.boolean(),
);

// `.trim()` : normalise les bords à la LECTURE (safeParse nettoie une valeur déjà
// stockée avec une espace parasite, ex. « ␣contact@axion-ia.com » → casse un mailto)
// comme à l'ÉCRITURE (setQualiopiConfig valide via ce schéma → ne re-stocke jamais
// d'espace de bord). Le texte multi-ligne interne est préservé (trim = bords seuls).
const str = (def = "") => ({ schema: z.string().trim(), default: def });
const num = (def: number) => ({ schema: numSchema, default: def });
const bool = (def: boolean) => ({ schema: boolSchema, default: def });

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
  // Défaut VIDE (badge en libellé textuel conforme tant qu'aucun logo n'est
  // renseigné — jamais de faux logo). À la Phase B, Will renseigne ici, en admin,
  // le chemin du fichier déposé dans `public/qualiopi/` (un asset est fourni :
  // `/qualiopi/axion-ia-qualiopi.png`, lockup co-brandé Qualiopi + mention
  // « ACTIONS DE FORMATION »). ⚠️ CONFORMITÉ : les règles d'usage de la marque
  // (Ministère du Travail) + le README de `public/qualiopi/` déconseillent la
  // RECOMPOSITION du logo → à remplacer idéalement par la MARQUE SEULE du kit
  // certificateur (simple swap de fichier, aucun changement de code).
  qualiopi_logo_path: {
    ...str(),
    description: "Chemin du fichier logo officiel Qualiopi (kit certificateur).",
  },
  siret: { ...str(), description: "SIRET Axion-IA SAS." },
  raison_sociale: { ...str("Axion-IA SAS"), description: "Raison sociale (SAS France)." },
  adresse_siege: {
    ...str(),
    description:
      "Adresse du siège social (domiciliation — 11 Avenue Paul Verlaine, 38100 Grenoble ; RCS Grenoble).",
  },
  adresse_exercice: {
    ...str(),
    description: "Adresse du lieu d'exercice effectif (Grenoble, Isère — Auvergne-Rhône-Alpes).",
  },
  // ── Régime de TVA (ÉVOLUTIF — cf. legal/tva.ts) ──────────────────────────
  // Qualiopi n'a AUCUN effet sur la TVA. Défaut « assujetti » (20 %), le seul
  // sûr tant qu'aucune attestation DREETS (261-4-4°) ni franchise (293 B) n'est
  // acquise. À changer ici quand le statut fiscal évolue ; les factures déjà
  // émises gardent leur régime d'origine.
  regime_tva: {
    schema: z.enum(["assujetti", "exoneration_261", "franchise_293b"]),
    default: REGIME_TVA_DEFAUT,
    description:
      "Régime de TVA des NOUVELLES factures. Par défaut « assujetti » (TVA 20 %) — le seul sûr tant que l'attestation d'exonération n'est pas obtenue. Ne passez à « exonéré formation (261-4-4°) » QU'APRÈS accord de votre comptable (attestation DREETS, formulaire 3511-SD). Attention : Qualiopi ne donne PAS l'exonération. Les factures déjà émises gardent leur régime.",
  },
  taux_tva_standard_percent: {
    ...num(20),
    description: "Taux de TVA standard appliqué aux lignes taxables en régime assujetti (%).",
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
  // Référentiel OPCO versionné (Lot 5) — durée de validité d'un relevé de barème
  // au-delà de laquelle l'alerte `bareme_opco_perime` est levée (relevé à
  // rafraîchir sur le portail OPCO). Les barèmes changent ~annuellement.
  bareme_opco_validite_mois: {
    ...num(12),
    description: "Validité d'un relevé de barème OPCO (mois) avant alerte de péremption.",
  },

  // ── Facturation / encaissements (Hub facturation unifié) ──
  // Le RIB (IBAN/BIC/titulaire) vit dans `legal_overrides` (SSOT identité,
  // cf. src/lib/legal-identity.ts) — PAS ici, pour rester partagé avec les
  // factures booking. Ici : uniquement les délais métier.
  delai_paiement_jours: {
    ...num(30),
    description: "Délai de paiement par défaut des factures clients (jours).",
  },
  delai_paiement_financeur_jours: {
    ...num(45),
    description:
      "Délai de paiement des financeurs publics/OPCO (jours) — seuil de retard distinct des entreprises.",
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

  // ── Périmètre indicateurs conformité ──────────────────────────────────────
  off29_applicable: {
    ...bool(false),
    description:
      "Indicateur 29 (insertion professionnelle) applicable — false pour un OF d'actions de formation non certifiantes ; à confirmer avec le certificateur.",
  },
  // Attestation explicite (posée délibérément par Will) que la procédure de traitement
  // des réclamations est PUBLIÉE / portée à la connaissance du public. Condition de
  // couverture de l'indicateur 31 (le seul nom du responsable qualité — qui a un défaut
  // de configuration — ne prouve pas un process opérationnel diffusé). Défaut false.
  procedure_reclamations_publiee: {
    ...bool(false),
    description:
      "Procédure de traitement des réclamations publiée / communiquée au public (condition de couverture off.31).",
  },

  // ── Cadences de pilotage (LOT 4) ───────────────────────────────────────────
  // Revue trimestrielle NON bloquante (décision B4) : quand activée, une alerte
  // info `revue_trimestrielle_a_faire` est levée si aucune revue de direction
  // n'a été tenue/mise à jour depuis le début du trimestre précédent.
  revue_trimestrielle_activee: {
    ...bool(true),
    description:
      "Active l'alerte de cadence trimestrielle de la revue de direction (info, non bloquante).",
  },

  // ── Gouvernance qualité (LOT 4) ───────────────────────────────────────────
  // Texte libre affiché en configuration : qui porte quel rôle qualité, avec
  // quelle mission et quelle cadence de revue. Défaut VIDE (renseigné par Will).
  gouvernance_roles: {
    ...str(),
    description:
      "Rôles qualité : référent handicap, responsable qualité, référent pédagogique — mission et cadence de revue par rôle.",
  },
} as const satisfies Record<string, ConfigEntry<unknown>>;

export type QualiopiConfigKey = keyof typeof QUALIOPI_CONFIG_REGISTRY;
export type QualiopiConfigValue<K extends QualiopiConfigKey> =
  (typeof QUALIOPI_CONFIG_REGISTRY)[K]["default"];

/** Préfixe des clés SiteSetting du module. */
export const QUALIOPI_CONFIG_KEY_PREFIX = "qualiopi." as const;
