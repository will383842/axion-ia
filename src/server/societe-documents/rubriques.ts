// SSOT du dossier société — rubriques, types de pièces et règles de validité.
//
// C'est ce fichier qui classe : la table `societe_documents` ne porte PAS de
// colonne « rubrique », elle se déduit du type. Un test
// (`rubriques.spec.ts`) exige que CHAQUE membre de l'enum Prisma figure ici
// exactement une fois — sans quoi un type ajouté au schéma deviendrait
// invisible dans la console, sans que rien ne rougisse.
//
// `validiteMois` sert à PROPOSER une date de péremption à partir de la date
// d'émission. C'est une proposition, jamais une contrainte : l'attestation fait
// foi, pas notre arithmétique, et l'écran laisse toujours corriger.

import type { SocieteDocumentType } from "../../../prisma/generated/client";

/** Rubrique = un sous-onglet de « Société & conformité » qui accepte des pièces. */
export type SocieteRubriqueKey =
  "pieces_legales" | "organisme_formation" | "commercial" | "audit_methode" | "rgpd_securite";

export interface SocieteDocTypeDef {
  key: SocieteDocumentType;
  /** Libellé FR affiché dans les listes et le sélecteur. */
  label: string;
  /**
   * Durée de validité usuelle, en mois, quand la pièce en a une. Sert à
   * pré-remplir la date de péremption depuis la date d'émission.
   * `null` = pièce sans échéance (des statuts ne périment pas).
   */
  validiteMois: number | null;
  /** Pourquoi la pièce est demandée — affiché sous le libellé, en une ligne. */
  motif?: string;
  /** Pré-coche « pièce confidentielle » au dépôt (données personnelles). */
  sensibleParDefaut?: boolean;
}

export interface SocieteRubriqueDef {
  key: SocieteRubriqueKey;
  /** Segment d'URL sous `/societe/`. */
  segment: string;
  label: string;
  description: string;
  types: ReadonlyArray<SocieteDocTypeDef>;
}

export const SOCIETE_RUBRIQUES: ReadonlyArray<SocieteRubriqueDef> = [
  {
    key: "pieces_legales",
    segment: "pieces-legales",
    label: "Pièces légales",
    description:
      "Les justificatifs que réclame un service achats pour référencer un fournisseur, souvent via une plateforme type e-Attestations ou Provigis. Ce sont les pièces qui périment : leur date de fin est ce qui compte.",
    types: [
      {
        key: "kbis",
        label: "Extrait Kbis",
        validiteMois: 3,
        motif: "Accepté moins de 3 mois après son édition. Gratuit sur MonIdenum.",
      },
      {
        key: "attestation_vigilance_urssaf",
        label: "Attestation de vigilance URSSAF",
        validiteMois: 6,
        motif:
          "Art. L.8222-1 — exigible dès 5 000 € HT de contrat. Sans elle, le donneur d'ordre est solidairement responsable.",
      },
      {
        key: "attestation_regularite_fiscale",
        label: "Attestation de régularité fiscale",
        validiteMois: 12,
        motif: "Espace professionnel impots.gouv. Demandée presque systématiquement.",
      },
      {
        key: "assurance_rc_pro",
        label: "Attestation de RC professionnelle",
        validiteMois: 12,
        motif:
          "Doit couvrir explicitement conseil, formation et intégration logicielle. Les CGV publiées s'engagent à la produire sur demande.",
      },
      { key: "rib", label: "RIB", validiteMois: null },
      {
        key: "statuts",
        label: "Statuts de la société",
        validiteMois: null,
        motif: "Envoyer la version publique à données occultées, jamais l'intégrale.",
      },
      {
        key: "pv_pouvoirs",
        label: "PV et pouvoirs du signataire",
        validiteMois: null,
        motif: "Vérifie que le président peut engager la société.",
      },
      {
        key: "piece_identite_dirigeant",
        label: "Pièce d'identité du dirigeant",
        validiteMois: null,
        motif:
          "Passeport ou CNI du représentant légal. Donnée personnelle : déposée confidentielle, jamais visible hors administration.",
        sensibleParDefaut: true,
      },
      {
        key: "liste_salaries_etrangers",
        label: "Liste des salariés étrangers, ou attestation « néant »",
        validiteMois: 6,
        motif: "Art. D.8254-2 — pièce jumelle de l'attestation de vigilance.",
      },
      {
        key: "attestation_honneur",
        label: "Attestation sur l'honneur (obligations sociales et fiscales)",
        validiteMois: 6,
        motif: "Souvent sur le formulaire du client ; sinon, notre modèle.",
      },
      { key: "autre_piece_legale", label: "Autre pièce légale", validiteMois: null },
    ],
  },
  {
    key: "organisme_formation",
    segment: "organisme-formation",
    label: "Organisme de formation",
    description:
      "Ce qu'un client entreprise reçoit au titre de la formation professionnelle. La plupart de ces pièces sont produites par l'application elle-même — ne déposer ici que les exemplaires de référence, ou les pièces externes (récépissé, certificat).",
    types: [
      {
        key: "recepisse_declaration_activite",
        label: "Récépissé de déclaration d'activité (DREETS)",
        validiteMois: null,
        motif: "Le numéro qu'attendent onze gabarits de documents.",
      },
      {
        key: "certificat_qualiopi",
        label: "Certificat Qualiopi",
        validiteMois: 36,
        motif:
          "Renseigner aussi numéro, certificateur, date et catégories dans les réglages Qualiopi — sinon la catégorie affichée publiquement vient d'un défaut codé en dur.",
      },
      { key: "reglement_interieur", label: "Règlement intérieur", validiteMois: null },
      { key: "livret_accueil", label: "Livret d'accueil stagiaire", validiteMois: null },
      {
        key: "programme_type",
        label: "Programme de formation (exemplaire type)",
        validiteMois: null,
      },
      {
        key: "liste_formateurs",
        label: "Liste des formateurs et qualifications",
        validiteMois: null,
      },
      {
        key: "cv_formateur",
        label: "CV du formateur",
        validiteMois: null,
        sensibleParDefaut: true,
      },
      {
        key: "autre_organisme_formation",
        label: "Autre pièce organisme de formation",
        validiteMois: null,
      },
    ],
  },
  {
    key: "commercial",
    segment: "commercial",
    label: "Commercial",
    description:
      "Ce qui part avec la proposition : présentation, prix, cadre contractuel. Les fiches d'offre tiennent en une page — périmètre, durée, méthode, livrable, prix ferme.",
    types: [
      { key: "plaquette_presentation", label: "Présentation de la société", validiteMois: null },
      { key: "grille_tarifaire", label: "Grille tarifaire", validiteMois: null },
      {
        key: "cgv",
        label: "Conditions générales de vente",
        validiteMois: null,
        motif: "Version horodatée du texte publié, à joindre au dossier.",
      },
      {
        key: "fiche_offre",
        label: "Fiche d'offre (diagnostic · audit · formation)",
        validiteMois: null,
      },
      {
        key: "nda",
        label: "Accord de confidentialité (NDA) Axion-IA",
        validiteMois: null,
        motif: "Le nôtre, pour les clients qui n'imposent pas le leur.",
      },
      { key: "modele_proposition", label: "Modèle de proposition commerciale", validiteMois: null },
      { key: "autre_commercial", label: "Autre pièce commerciale", validiteMois: null },
    ],
  },
  {
    key: "audit_methode",
    segment: "audit-methode",
    label: "Audit & méthode",
    description:
      "Les documents de mission d'audit. Les emplacements correspondants existent déjà dans le module Documents ; ceux déposés ici sont les exemplaires de référence qu'on montre à un prospect.",
    types: [
      { key: "methodologie_audit", label: "Méthodologie d'audit", validiteMois: null },
      { key: "questionnaire_pre_audit", label: "Questionnaire de pré-audit", validiteMois: null },
      { key: "modele_lettre_mission", label: "Modèle de lettre de mission", validiteMois: null },
      {
        key: "modele_rapport_audit",
        label: "Modèle de rapport d'audit",
        validiteMois: null,
        motif: "Un aperçu anonymisé rassure davantage qu'une méthode.",
      },
      { key: "autre_audit_methode", label: "Autre document d'audit", validiteMois: null },
    ],
  },
  {
    key: "rgpd_securite",
    segment: "rgpd-securite",
    label: "RGPD & sécurité",
    description:
      "Ce qu'un grand groupe demande à un prestataire qui touchera ses données. La matière existe déjà côté transparence publique ; ces pièces-ci sont sa mise en forme contractuelle.",
    types: [
      {
        key: "registre_traitements",
        label: "Registre des traitements (art. 30)",
        validiteMois: 12,
        motif: "Doit inclure notre rôle de sous-traitant sur les données auditées.",
      },
      {
        key: "modele_dpa",
        label: "Accord de sous-traitance (art. 28) — modèle",
        validiteMois: null,
        motif: "Celui où Axion-IA est le sous-traitant, pas le responsable.",
      },
      {
        key: "note_securite",
        label: "Note de sécurité",
        validiteMois: 12,
        motif: "Hébergement, localisation, chiffrement, sauvegardes, accès.",
      },
      { key: "politique_usage_ia", label: "Politique d'usage des outils d'IA", validiteMois: 12 },
      {
        key: "questionnaire_securite",
        label: "Réponse type au questionnaire sécurité",
        validiteMois: null,
      },
      { key: "autre_rgpd_securite", label: "Autre pièce RGPD ou sécurité", validiteMois: null },
    ],
  },
];

/** Tous les types, à plat, dans l'ordre des rubriques. */
export const SOCIETE_DOC_TYPES: ReadonlyArray<SocieteDocTypeDef> = SOCIETE_RUBRIQUES.flatMap(
  (r) => r.types,
);

const TYPE_INDEX: ReadonlyMap<string, SocieteDocTypeDef> = new Map(
  SOCIETE_DOC_TYPES.map((t) => [t.key as string, t]),
);

const RUBRIQUE_PAR_TYPE: ReadonlyMap<string, SocieteRubriqueDef> = new Map(
  SOCIETE_RUBRIQUES.flatMap((r) => r.types.map((t) => [t.key as string, r] as const)),
);

/** Définition d'un type de pièce, ou `undefined` si le type est inconnu. */
export function getSocieteDocType(key: SocieteDocumentType): SocieteDocTypeDef | undefined {
  return TYPE_INDEX.get(key);
}

/** Libellé d'un type — repli sur la clé brute plutôt qu'une chaîne vide. */
export function labelSocieteDocType(key: SocieteDocumentType): string {
  return TYPE_INDEX.get(key)?.label ?? key;
}

/** Rubrique qui contient ce type. */
export function getRubriqueForType(key: SocieteDocumentType): SocieteRubriqueDef | undefined {
  return RUBRIQUE_PAR_TYPE.get(key);
}

/** Résout un segment d'URL en rubrique. */
export function getRubriqueBySegment(segment: string): SocieteRubriqueDef | undefined {
  return SOCIETE_RUBRIQUES.find((r) => r.segment === segment);
}

/** Les types acceptés par une rubrique (alimente le sélecteur du formulaire). */
export function typesDeRubrique(key: SocieteRubriqueKey): ReadonlyArray<SocieteDocTypeDef> {
  return SOCIETE_RUBRIQUES.find((r) => r.key === key)?.types ?? [];
}

/**
 * Date de péremption proposée à partir d'une date d'émission.
 *
 * Renvoie `null` si le type n'a pas d'échéance, ce qui laisse le champ vide
 * plutôt que d'inventer une date. Le calcul se fait en UTC pour ne pas décaler
 * d'un jour selon le fuseau du navigateur qui affichera le résultat.
 */
export function proposerDateExpiration(type: SocieteDocumentType, dateEmission: Date): Date | null {
  const mois = TYPE_INDEX.get(type)?.validiteMois;
  if (mois == null) return null;
  const d = new Date(
    Date.UTC(
      dateEmission.getUTCFullYear(),
      dateEmission.getUTCMonth(),
      dateEmission.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const jourVoulu = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + mois);
  // Un 31 janvier + 1 mois donnerait le 3 mars : on ramène à la fin du mois
  // visé, comme le fait n'importe quel calendrier administratif.
  if (d.getUTCDate() !== jourVoulu) d.setUTCDate(0);
  return d;
}
