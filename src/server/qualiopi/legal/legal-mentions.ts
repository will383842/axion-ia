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

/**
 * Taux des pénalités de retard — fragment PARTAGÉ avec les CGV publiées.
 *
 * Reproduit à l'identique le taux de la clause « Retard de paiement » des CGV
 * (`src/content/legal.ts`, FR et miroir EN). Une facture est un acte UNILATÉRAL :
 * elle ne stipule aucun taux, elle rappelle celui du contrat. Un taux imprimé sur
 * la facture mais absent des CGV est INOPPOSABLE — c'était le constat F52.
 * `legal-mentions.spec.ts` verrouille la concordance dans les deux langues.
 */
export const TAUX_PENALITES_RETARD_FR =
  "au taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente, majoré de 10 points de pourcentage";

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
  /** Facture — exonération TVA formation professionnelle continue (attestation DREETS requise). */
  factureExonerationTva:
    "Exonéré de TVA en application de l'article 261-4-4° du Code Général des Impôts — Prestations de formation professionnelle continue.",
  /** Facture — franchise en base de TVA (art. 293 B CGI, sous les seuils de CA). */
  factureFranchiseTva: "TVA non applicable, article 293 B du Code Général des Impôts.",
  /**
   * Facture/devis — régime assujetti, aucune exonération.
   *
   * Le droit n'impose AUCUNE mention dans ce cas : `mentionTva()` rend donc
   * `null`, et les PDF n'affichent rien. Ce texte n'existe que pour les colonnes
   * NOT NULL qui figent le régime d'une pièce (`Devis.mentionTva`) : y laisser
   * une chaîne vide rendrait indiscernables « assujetti » et « régime non
   * renseigné » des années plus tard.
   */
  factureTvaAssujetti:
    "TVA au taux standard en vigueur — aucune exonération ni franchise applicable.",
  /**
   * Facture B2B — pénalités de retard (art. L.441-10 C. com.). OBLIGATOIRE.
   *
   * Le taux vient de `TAUX_PENALITES_RETARD_FR` : NE PAS le ré-inliner ici en
   * littéral, c'est exactement la divergence que F52 a fermée (la facture
   * annonçait « trois fois le taux d'intérêt légal », qui n'est stipulé dans
   * aucune clause des CGV).
   *
   * « dès le jour suivant la date d'échéance » n'est pas cosmétique : L.441-9
   * et R.441-1 imposent d'indiquer la date d'exigibilité, et les CGV la portent.
   *
   * NE PAS ajouter de renvoi « conformément aux CGV » : ce bloc est imprimé sans
   * condition par `facture.tsx`, y compris quand le destinataire est un
   * stagiaire particulier — un renvoi explicite aggraverait ce défaut au lieu de
   * le corriger.
   */
  facturePenalitesRetard:
    "Tout retard de paiement entraîne de plein droit, sans qu'un rappel soit nécessaire et dès le jour suivant la date d'échéance, l'application de pénalités de retard calculées " +
    TAUX_PENALITES_RETARD_FR +
    " (article L.441-10 du Code de commerce).",
  /** Facture B2B — indemnité forfaitaire de recouvrement de 40 € (art. D.441-5 C. com.). OBLIGATOIRE. */
  factureIndemniteRecouvrement:
    "Une indemnité forfaitaire pour frais de recouvrement de 40 € est due en cas de retard de paiement (articles L.441-10 et D.441-5 du Code de commerce).",
  /** Facture B2B — absence d'escompte (art. L.441-9 C. com.). OBLIGATOIRE. */
  factureEscompte: "Aucun escompte n'est accordé en cas de paiement anticipé.",
  /** Règlement intérieur des stagiaires. */
  reglementInterieur: "Établi conformément aux articles L.6352-3 et suivants du Code du travail.",
  /** Désignation du référent handicap. */
  referentHandicap:
    "Référent handicap désigné conformément à l'article L.6352-3 du Code du travail (indicateur Qualiopi n°26).",
  /** CGV — objet des prestations. */
  cgvObjet:
    "Prestations de formation professionnelle au sens des articles L.6313-1 et suivants du Code du travail.",
  // 2026-08-10 (décision Will) : mention `afestProtocole` supprimée — le module
  // AFEST 1-to-1 (et son template `protocole-afest.tsx`, seul lecteur) a disparu.
  /** Déclaration d'activité (lettre DREETS). */
  declarationActivite:
    "Déclaration d'activité enregistrée auprès du préfet de région du lieu de direction effective (article R.6351-2 du Code du travail). Cet enregistrement ne vaut pas agrément de l'État.",
  /** RGPD — base réglementaire. */
  rgpd: "Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.",
} as const;

export type LegalMentionKey = keyof typeof LEGAL_MENTIONS;

/**
 * Mention OBLIGATOIRE accompagnant la marque/logo Qualiopi (règles d'usage
 * officielles du Ministère du Travail). Le logo ne peut JAMAIS apparaître seul :
 * il doit toujours être suivi de la ou des catégorie(s) d'actions certifiées
 * telles qu'inscrites sur le certificat.
 *
 * ⚠️ RAPPEL D'USAGE : le logo Qualiopi est INTERDIT sur les attestations,
 * certificats de réalisation et tout support lié EXCLUSIVEMENT à une action de
 * formation. Il est réservé à la communication générale (site, présentations,
 * supports institutionnels). Ne JAMAIS embarquer le logo dans un PDF
 * réglementaire — seules les mentions textuelles (NDA, exonération TVA, etc.)
 * y figurent.
 *
 * @param categoriesCertifiees ex. « Actions de formation » (ou liste « A, B »).
 */
export function formatMentionMarqueQualiopi(categoriesCertifiees: string): string {
  const cat = categoriesCertifiees.trim();
  return `La certification qualité a été délivrée au titre de la ou des catégories d'actions suivantes : ${cat}.`;
}

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
