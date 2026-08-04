/**
 * Qualiopi — Garde-fous de conformité documentaire.
 *
 * Problème résolu : l'identité de l'organisme (SIRET, NDA, adresse du siège…)
 * est lue depuis `SiteSetting` (cat. qualiopi) avec des défauts VIDES. Les
 * templates faisaient `{identite.siret ? <FieldRow/> : null}` → un identifiant
 * obligatoire absent DISPARAISSAIT en silence, produisant un document légal
 * non conforme qui passait quand même les tests.
 *
 * Ce module bloque la génération des documents À VALEUR JURIDIQUE / FISCALE
 * (facture, convention, convention tripartite, contrat) si un champ obligatoire
 * de l'OF est vide. Les documents internes (attestations, kits, suivi) ne sont
 * PAS bloqués : leurs templates signalent visuellement l'absence via
 * `FieldRow required` (« Non renseigné » en rouge) plutôt que de la masquer.
 *
 * Pur (aucun accès DB) — testable unitairement.
 */

import type { DocumentType } from "../../../../prisma/generated/client";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

/** Champs d'identité OF susceptibles d'être exigés. */
type ChampIdentite = "raisonSociale" | "siret" | "nda" | "qualiopi" | "adresseSiege";

/** Libellés humains pour les messages d'erreur. */
const LABELS: Record<ChampIdentite, string> = {
  raisonSociale: "raison sociale",
  siret: "SIRET",
  nda: "numéro de déclaration d'activité (NDA)",
  qualiopi: "numéro de certification Qualiopi",
  adresseSiege: "adresse du siège",
};

/**
 * Champs obligatoires par type de document. Seuls les documents engageant
 * juridiquement ou fiscalement l'OF sont listés (les autres ne sont pas
 * bloquants). Source : art. L441-9 C. com. (facture B2B), art. 242 nonies A
 * CGI, art. L.6353-1/-2 C. trav. (convention/contrat).
 */
const CHAMPS_OBLIGATOIRES: Partial<Record<DocumentType, ChampIdentite[]>> = {
  // Facture : mentions vendeur obligatoires (identité + adresse + SIRET).
  //
  // 🔴 `nda` RETIRÉ le 2026-07-28, sur remarque de Will : « il ne faut pas que
  // ce soit bloquant, on a 3 mois pour déclarer l'activité ». Il a raison, et
  // c'est exactement le raisonnement qui avait déjà fait retirer `qualiopi` de
  // ces listes trois jours plus tôt.
  //
  // Art. L.6351-1 C. trav. : la déclaration d'activité se dépose **dans les
  // trois mois suivant la conclusion de la première convention de formation**.
  // Au moment d'émettre cette première convention — et la facture qui la suit —
  // l'organisme n'a donc légalement PAS ENCORE de NDA : c'est cette convention
  // qui ouvre le délai. Exiger le numéro avant reproduisait l'impasse décrite
  // plus bas pour Qualiopi.
  //
  // Et le NDA n'est pas une mention obligatoire de FACTURE : l'art. L.6352-4
  // l'impose sur « les conventions, contrats et documents de nature
  // contractuelle ou publicitaire ». Les mentions de facture relèvent de
  // l'art. R123-238 C. com. et de l'art. 242 nonies A ann. II CGI — le NDA n'y
  // figure pas.
  //
  // `siret` reste BLOQUANT : lui est bien une mention obligatoire (R123-238),
  // et une facture émise sans lui est irrégulière.
  //
  // Le NDA reste exigé sur convention / tripartite / contrat, où L.6352-4
  // s'applique — mais sans bloquer non plus : `generateDocument` les déclasse
  // en SPÉCIMEN au lieu de refuser.
  facture: ["raisonSociale", "siret", "adresseSiege"],
  // Convention / contrat : identité de l'OF prestataire.
  //
  // 🔴 `qualiopi` a été RETIRÉ de ces trois listes (audit certification
  // 2026-07-25). Motif : le numéro de certification n'est pas une mention
  // obligatoire de la convention ou du contrat de formation — les art.
  // L.6353-1/-2 C. trav. en régissent le CONTENU (nature, durée, effectif,
  // prix, modalités), pas la certification du prestataire. Qualiopi conditionne
  // l'accès aux FONDS MUTUALISÉS (OPCO, CPF, France Travail), ce que l'OPCO
  // vérifie de son côté.
  //
  // L'exiger ici créait une impasse : l'arrêté du 6 juin 2019 impose d'avoir
  // mis en œuvre une action de formation pour déclencher l'audit initial ;
  // délivrer cette action suppose une convention ; la convention était refusée
  // faute d'un numéro qui n'existe qu'APRÈS la certification. Un organisme
  // nouvellement créé ne pouvait donc jamais démarrer.
  //
  // Le numéro reste imprimé sur les documents dès qu'il est renseigné
  // (cf. `QualiopiPage`, en-tête et pied de page).
  // 🔴 `nda` RETIRÉ de ces trois listes le 2026-07-29, sur remarque de Will :
  // « il faut que ça fonctionne même sans, ils ne seront pas présents quand le
  // certificateur Qualiopi va venir auditer ».
  //
  // C'est le MÊME raisonnement qui avait fait retirer le NDA de la facture la
  // veille — et il vaut ici PLUS fortement encore. L'art. L.6351-1 fait courir
  // le délai de déclaration « dans les trois mois suivant la conclusion de la
  // PREMIÈRE convention de formation ». C'est donc cette convention-là qui
  // OUVRE le délai : au moment de l'émettre, l'organisme n'a légalement pas de
  // numéro. L'exiger revenait à demander le résultat avant la cause, exactement
  // l'impasse circulaire décrite plus haut pour Qualiopi.
  //
  // ⚠️ L'art. L.6352-4 impose bien le NDA sur « les conventions, contrats et
  // documents de nature contractuelle ou publicitaire ». Cette obligation n'est
  // PAS niée : elle devient exigible une fois le numéro obtenu, et le pied de
  // page l'imprime dès qu'il est renseigné. Ce qui change, c'est que son absence
  // ne déclasse plus la pièce en SPÉCIMEN.
  //
  // 🔴 Et l'absence n'est PAS passée sous silence : `QualiopiPage` mentionne
  // désormais explicitement que la déclaration n'est pas enregistrée, en citant
  // l'article. Un auditeur préfère une pièce qui nomme sa propre lacune à une
  // pièce muette — et infiniment à un filigrane SPÉCIMEN qui la rend sans
  // valeur au moment même où on la lui présente.
  //
  // `siret` reste BLOQUANT : une personne morale qui contracte sans numéro
  // d'immatriculation ne contracte pas.
  convention: ["raisonSociale", "siret", "adresseSiege"],
  convention_tripartite: ["raisonSociale", "siret", "adresseSiege"],
  contrat: ["raisonSociale", "siret", "adresseSiege"],
};

/** Un champ est « renseigné » s'il est une chaîne non vide après trim. */
function estRenseigne(valeur: string | null | undefined): boolean {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

// ────────────────────────────────────────────────────────────────────
// Symétrie ACHETEUR — art. L.441-9 C. com.
// ────────────────────────────────────────────────────────────────────

/**
 * 🔴 LE CONTRÔLE N'EXISTAIT QUE D'UN CÔTÉ.
 *
 * Tout ce qui précède protège l'organisme contre SA propre identité incomplète.
 * Rien ne contrôlait l'ACHETEUR — alors que l'art. L.441-9 C. com. impose « le
 * nom des parties ainsi que **leur** adresse » : les deux, pas seulement le
 * vendeur.
 *
 * Le gabarit de facture rend l'adresse acheteur en `required`, donc une adresse
 * absente s'imprime « Non renseigné » en rouge (`facture.tsx:280`). C'est mieux
 * que la disparition silencieuse d'avant, mais ça reste une facture non
 * conforme — simplement une qui l'avoue. Ici on l'empêche de naître.
 *
 * ⚠️ ET CE CONTRÔLE NE VAUT QUE POUR LE DESTINATAIRE « entreprise ».
 *
 * `resoudreDestinataireFacture` renvoie délibérément `adresse: null` pour
 * `opco`, `france_travail` et `stagiaire` : leur identité relève d'un
 * référentiel externe et n'est « jamais inventée ». Appliquer la garde à ces
 * destinataires bloquerait toute facturation OPCO et France Travail — ce sont
 * précisément les circuits de financement. D'où le paramètre explicite plutôt
 * qu'un contrôle aveugle sur la présence du champ.
 */
export interface AcheteurFacture {
  readonly nom: string | null | undefined;
  readonly adresse: string | null | undefined;
  readonly adresseRue?: string | null;
  readonly adresseCodePostal?: string | null;
  readonly adresseVille?: string | null;
  readonly adressePaysCode?: string | null;
}

/** Libellés humains des champs acheteur. */
const LABELS_ACHETEUR = {
  nom: "nom ou raison sociale du client",
  adresse: "adresse du client",
} as const;

/**
 * Champs acheteur MANQUANTS pour une facture. Vide = conforme. Ne lève jamais.
 *
 * Destinée à alimenter un état d'aptitude côté écran (« cette fiche client ne
 * permet pas encore de facturer ») autant que la garde bloquante ci-dessous —
 * un seul calcul, donc l'écran et le refus ne peuvent pas diverger.
 */
export function champsAcheteurManquants(acheteur: AcheteurFacture): string[] {
  const manquants: string[] = [];
  if (!estRenseigne(acheteur.nom)) manquants.push(LABELS_ACHETEUR.nom);
  // Adresse libre OU structurée : l'une des deux suffit à satisfaire L.441-9.
  const aUneAdresse =
    estRenseigne(acheteur.adresse) ||
    (estRenseigne(acheteur.adresseRue) && estRenseigne(acheteur.adresseVille));
  if (!aUneAdresse) manquants.push(LABELS_ACHETEUR.adresse);
  return manquants;
}

/**
 * `true` si l'adresse acheteur est STRUCTURÉE (rue + code postal + ville).
 *
 * NON BLOQUANT à dessein, et ce choix est daté. La facturation électronique
 * (réception 1ᵉʳ septembre 2026, émission 1ᵉʳ septembre 2027) rendra le bloc
 * `BG-8` d'EN 16931 obligatoire : une adresse en texte libre passera ce
 * contrôle-ci et sera **rejetée par la plateforme**. Mais l'exiger aujourd'hui
 * bloquerait toute facturation — au 2026-08-04, aucun client de production ne
 * porte l'adresse structurée. On signale, on ne bloque pas encore.
 */
export function adresseAcheteurStructuree(acheteur: AcheteurFacture): boolean {
  return (
    estRenseigne(acheteur.adresseRue) &&
    estRenseigne(acheteur.adresseCodePostal) &&
    estRenseigne(acheteur.adresseVille)
  );
}

/** Erreur de conformité : identité de l'acheteur incomplète pour une facture. */
export class AcheteurIncompletError extends Error {
  constructor(public readonly manquants: string[]) {
    super(
      `[conformité] Émission de la facture refusée : identité du client incomplète ` +
        `(champ(s) manquant(s) : ${manquants.join(", ")}). ` +
        `L'art. L.441-9 C. com. impose le nom des parties ET leur adresse. ` +
        `Compléter la fiche client avant d'émettre.`,
    );
    this.name = "AcheteurIncompletError";
  }
}

/**
 * Lève `AcheteurIncompletError` si l'acheteur est incomplet. No-op pour les
 * destinataires dont l'identité ne vient pas de la fiche client (OPCO, France
 * Travail, bénéficiaire) — cf. l'avertissement en tête de section.
 *
 * À appeler AVANT toute création de `FactureFormation`, et hors d'un
 * `try/catch` fail-soft : sinon un enregistrement non conforme serait créé
 * pendant que l'erreur serait avalée.
 */
export function assertAcheteurComplet(acheteur: AcheteurFacture, destinataire: string): void {
  if (destinataire !== "entreprise") return;
  const manquants = champsAcheteurManquants(acheteur);
  if (manquants.length > 0) throw new AcheteurIncompletError(manquants);
}

/**
 * Retourne la liste des champs obligatoires MANQUANTS pour ce type de document
 * (libellés humains). Vide = conforme. Ne lève jamais.
 */
export function champsIdentiteManquants(identite: OrganismeIdentite, type: DocumentType): string[] {
  const requis = CHAMPS_OBLIGATOIRES[type];
  if (!requis) return [];
  return requis.filter((champ) => !estRenseigne(identite[champ])).map((champ) => LABELS[champ]);
}

/** `true` si le type de document est soumis au garde-fou bloquant. */
export function exigeIdentiteComplete(type: DocumentType): boolean {
  return Boolean(CHAMPS_OBLIGATOIRES[type]);
}

/**
 * Erreur de conformité : identité OF incomplète pour un document à valeur
 * juridique/fiscale. Portée par `assertOrganismeComplet`.
 */
export class OrganismeIncompletError extends Error {
  constructor(
    public readonly type: DocumentType,
    public readonly manquants: string[],
  ) {
    super(
      `[conformité] Génération du document « ${type} » refusée : ` +
        `identité de l'organisme incomplète (champ(s) manquant(s) : ${manquants.join(", ")}). ` +
        `Renseigner ces valeurs dans les paramètres Qualiopi avant d'émettre un document légal.`,
    );
    this.name = "OrganismeIncompletError";
  }
}

/**
 * Lève `OrganismeIncompletError` si l'identité de l'OF est incomplète pour un
 * document à valeur juridique/fiscale (facture, convention, tripartite,
 * contrat). No-op pour les autres types. À appeler AVANT le rendu PDF.
 *
 * ⚠️ La chaîne de génération principale (`generateDocument`) n'appelle PLUS
 * cette fonction : elle utilise `evaluerIdentite` et déclasse le document en
 * SPÉCIMEN plutôt que de refuser. Conservée pour les appelants qui veulent un
 * refus dur (facturation 1-to-1) et pour les tests.
 */
export function assertOrganismeComplet(identite: OrganismeIdentite, type: DocumentType): void {
  const manquants = champsIdentiteManquants(identite, type);
  if (manquants.length > 0) {
    throw new OrganismeIncompletError(type, manquants);
  }
}

/**
 * Verdict de conformité d'identité, sans exception.
 *
 * Remplace le couple « bloquer ou laisser passer en silence » par un troisième
 * état : le document est produit, mais **déclassé en SPÉCIMEN** et marqué comme
 * tel (filigrane + bandeau listant les champs manquants + `metadata.specimen`
 * en base). Deux propriétés en découlent :
 *
 *   1. plus rien ne bloque — toute la chaîne reste exerçable, y compris avant
 *      l'obtention du SIRET, du NDA ou de la certification ;
 *   2. aucun document incomplet ne peut être confondu avec une pièce valable,
 *      ce qui était le risque que ce module existe pour écarter.
 *
 * `conforme: true` ⇒ document officiel normal.
 */
export function evaluerIdentite(
  identite: OrganismeIdentite,
  type: DocumentType,
): { conforme: boolean; manquants: string[]; motif: string | null } {
  const manquants = champsIdentiteManquants(identite, type);
  if (manquants.length === 0) return { conforme: true, manquants: [], motif: null };
  return {
    conforme: false,
    manquants,
    motif:
      `Identité de l'organisme incomplète — ${manquants.join(", ")}. ` +
      `Document émis en SPÉCIMEN, sans valeur juridique. ` +
      `Renseignez ces valeurs dans Qualiopi › Configuration pour émettre un document officiel.`,
  };
}
