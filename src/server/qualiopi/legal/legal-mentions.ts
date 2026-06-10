/**
 * Qualiopi — Mentions légales EXACTES (module unique, centralisé, testé).
 *
 * Réutilisé par TOUS les PDF réglementaires + l'UI + les tests. Chaque mention
 * est couverte par `legal-mentions.spec.ts` (« la mention X est présente dans
 * le document Y »). Source : skill `reference/01` §5 + modèles Word A/B
 * (04_DOSSIER_OF_DOCUMENTS). Bases juridiques verbatim — NE PAS paraphraser.
 *
 * ⚠️ Les identifiants concrets (NDA, n° Qualiopi, SIRET, adresses) NE sont PAS
 * ici : ce sont des placeholders `SiteSetting` (cat. `qualiopi`) à renseigner
 * par Will (cf. `config/site-settings.ts`). Ce module ne porte que les mentions
 * juridiques fixes (articles de loi) et les helpers de formatage réglementaire.
 */

/** Mentions légales fixes par type de document officiel (verbatim). */
export const LEGAL_MENTIONS = {
  /** Convention de formation professionnelle (personnes morales). */
  convention: "Établie conformément aux articles L.6353-1 et L.6353-2 du Code du travail.",
  /** Contrat de formation professionnelle (particuliers — rétractation). */
  contratParticulier: "Établi conformément aux articles L.6353-3 à L.6353-7 du Code du travail.",
  /** Attestation de fin de formation. */
  attestation: "Délivrée conformément aux articles L.6353-1 et D.6353-1 du Code du travail.",
  /** Certificat de réalisation (durées EN CENTIÈMES obligatoires). */
  certificatRealisation:
    "Établi conformément à l'article R.6313-3 du Code du travail et à l'arrêté du 21 décembre 2018.",
  /** Facture — exonération TVA formation professionnelle continue. */
  factureExonerationTva:
    "Exonéré de TVA en application de l'article 261-4-4° du Code Général des Impôts — Prestations de formation professionnelle continue.",
  /** Règlement intérieur des stagiaires. */
  reglementInterieur: "Établi conformément aux articles L.6352-3 et suivants du Code du travail.",
  /** Désignation du référent handicap. */
  referentHandicap:
    "Référent handicap désigné conformément à l'article L.6352-3 du Code du travail (indicateur Qualiopi n°26).",
  /** CGV — objet des prestations. */
  cgvObjet:
    "Prestations de formation professionnelle au sens des articles L.6313-1 et suivants du Code du travail.",
  /** Déclaration d'activité (lettre DREETS). */
  declarationActivite:
    "Déclaration d'activité enregistrée auprès du préfet de région du lieu de direction effective (article R.6351-2 du Code du travail). Cet enregistrement ne vaut pas agrément de l'État.",
  /** RGPD — base réglementaire. */
  rgpd: "Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.",
} as const;

export type LegalMentionKey = keyof typeof LEGAL_MENTIONS;

/** Partenaire/relais externe vers qui orienter un stagiaire en situation de handicap. */
export interface HandicapPartenaire {
  nom: string;
  role: string;
  url: string;
}

/**
 * Relais nationaux vers qui orienter un stagiaire en situation de handicap
 * (indicateur Qualiopi n°26). Affiché dans le livret d'accueil et sur la page
 * publique d'accessibilité. Liste d'organismes nationaux stables — le référent
 * handicap concret (nom/contact) reste paramétré dans SiteSetting (cat. qualiopi).
 */
export const HANDICAP_PARTENAIRES: readonly HandicapPartenaire[] = [
  {
    nom: "Agefiph",
    role: "Aides au financement de l'adaptation des situations de formation et d'emploi.",
    url: "https://www.agefiph.fr",
  },
  {
    nom: "Cap emploi",
    role: "Accompagnement à l'insertion et au maintien dans l'emploi des personnes handicapées.",
    url: "https://www.capemploi.fr",
  },
  {
    nom: "MDPH",
    role: "Reconnaissance de la qualité de travailleur handicapé (RQTH) et orientation.",
    url: "https://www.monparcourshandicap.gouv.fr",
  },
  {
    nom: "Ressource Handicap Formation (RHF)",
    role: "Appui aux organismes de formation pour l'accueil et l'adaptation des parcours.",
    url: "https://www.agefiph.fr/aides-handicap/ressource-handicap-formation-rhf",
  },
  {
    nom: "FIPHFP",
    role: "Fonds pour l'insertion des personnes handicapées dans la fonction publique.",
    url: "https://www.fiphfp.fr",
  },
] as const;

/**
 * Formate une durée en heures décimales vers le format réglementaire
 * « EN CENTIÈMES » exigé sur le certificat de réalisation (OPCO Atlas) :
 * 7 → "7,00", 1.5 → "1,50", 7.25 → "7,25". Virgule décimale française,
 * toujours 2 décimales. NE retourne JAMAIS le format horaire "7h00".
 *
 * @throws si `heures` n'est pas un nombre fini >= 0.
 */
export function formatHeuresCentiemes(heures: number): string {
  if (!Number.isFinite(heures) || heures < 0) {
    throw new Error(`formatHeuresCentiemes: durée invalide (${heures})`);
  }
  return heures.toFixed(2).replace(".", ",");
}

/** Préfixes de numérotation séquentielle officielle (cf. numbering/formats.ts). */
export const DOCUMENT_RETENTION_YEARS = 5 as const;
