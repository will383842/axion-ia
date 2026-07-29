/**
 * Qui doit signer quoi — SOURCE DE VÉRITÉ UNIQUE des dix circuits.
 *
 * ## Pourquoi ce module existe, et pourquoi il existe MAINTENANT
 *
 * `signerDocument` exige `partiesRequises` en entrée et refuse une liste vide :
 * c'est ce qui lui permet de dériver `signee` plutôt que `partielle` sans rien
 * inventer. Il ne connaît volontairement AUCUNE matrice — la matrice appartient
 * aux circuits, qui la possèdent réellement.
 *
 * 🔴 Mais si chaque circuit déclare sa propre liste dans son coin, elles
 * divergeront. Et la divergence est SILENCIEUSE : une pièce déclarée à deux
 * parties d'un côté et à trois de l'autre passerait `signee` à deux signatures
 * sur trois, et le dossier afficherait « convention signée » sur une convention
 * que l'organisme n'a jamais contresignée. Rien ne planterait.
 *
 * ⚠️ RÈGLE : aucun appelant de `signerDocument` ne construit sa liste à la main.
 * Il appelle `partiesRequisesPour(type)`. Un test de propriété le vérifie.
 *
 * ## L'ORDRE est significatif
 *
 * Les tableaux sont ORDONNÉS, et cet ordre est celui dans lequel les parties
 * signent. Sur le canal fournisseur, il devient l'ordre `preserved` de la
 * submission ; sur le canal maison, il donne l'ordre d'affichage et celui des
 * relances. Le trier ou le réordonner « pour faire propre » changerait la
 * séquence contractuelle — l'organisme conclut EN DERNIER, ce n'est pas
 * décoratif : il contresigne ce que les autres ont accepté.
 *
 * Source : plan unifié §II.2 (les dix circuits, vérifiés un par un).
 *
 * Logique pure — aucun import Prisma, aucune horloge.
 */

import type { PartieSignataire } from "./document-signature-hash";

/** Canal par lequel la pièce est signée. Reprend les 4 canaux du plan §II.1. */
export type CanalSignature =
  /** A/B/C — maison : lien public, espace authentifié, ou poste du formateur. */
  | "maison"
  /** D — fournisseur tiers : seul canal qui remet un certificat opposable. */
  | "fournisseur";

export interface CircuitSignature {
  /** Parties signataires, DANS L'ORDRE de signature. */
  readonly parties: readonly PartieSignataire[];
  readonly canal: CanalSignature;
  /** Libellé de la pièce, tel qu'il apparaît dans la mention affichée. */
  readonly libelle: string;
}

/**
 * Les dix circuits.
 *
 * ⚠️ Clés = valeurs de l'enum `DocumentType`. Volontairement typées `string` et
 * non `DocumentType` : ce module reste PUR (aucun import du client Prisma), et
 * `partiesRequisesPour` rend `null` sur un type absent — un type de pièce qui ne
 * se signe pas doit être un refus explicite, pas une liste vide silencieuse.
 */
const CIRCUITS: Readonly<Record<string, CircuitSignature>> = {
  // ── Canal B — signataires INTERNES, aucune dépendance externe ──
  //
  // ⚠️ Dans un organisme d'une personne, le formateur et le responsable
  // pédagogique sont le MÊME humain (`registry.ts` décrit `dirigeant_nom` comme
  // « Nom du dirigeant / responsable pédagogique »). Les deux signatures
  // attestent deux QUALITÉS, pas deux personnes indépendantes : le visa n'ajoute
  // aucun contrôle croisé, et la mention doit le dire plutôt que de le laisser
  // croire.
  releve_connexion: {
    parties: ["formateur", "responsable_pedagogique"],
    canal: "maison",
    libelle: "relevé de connexion",
  },
  // Le formateur est DÉJÀ authentifié par magic link, et la preuve maison y est
  // MEILLEURE qu'un aller-retour fournisseur : identité connue, chaîne de
  // hachage, snapshot figé. Passer par un tiers dégraderait la preuve tout en
  // ajoutant une dépendance.
  lettre_mission: {
    parties: ["formateur", "axionia"],
    canal: "maison",
    libelle: "lettre de mission",
  },

  // ── Canal A — maison, par lien public à jeton ──
  //
  // 🔴 Bascule du 2026-07-30, décidée avec Will. Le devis était déclaré
  // `fournisseur` au motif qu'« un TIERS contractant attend un certificat
  // opposable ». Ce motif reste vrai en principe ; il est devenu inapplicable en
  // fait, et le circuit qu'il justifiait produisait un défaut pire que celui
  // qu'il évitait.
  //
  // **Le fait.** `POST /api/templates/pdf` — l'endpoint sur lequel reposait la
  // voie « template éphémère » du plan (§III.3) — n'existe pas sur l'instance
  // DocuSeal de production. Vérifié contre le conteneur RÉEL, pas contre la
  // documentation : `config/routes.rb` (docuseal/docuseal:latest, v2.5.3)
  // déclare `resources :templates, only: %i[update show index destroy]`, et
  // l'appel réel répond 404 là où `GET /api/templates/2` répond 200 avec le même
  // jeton. Ces endpoints sont des fonctionnalités Pro.
  //
  // **Le défaut.** Faute de pouvoir créer un template par pièce, le circuit
  // faisait signer un template PERMANENT à trois champs — `devis_number`,
  // `amount_ht`, `valid_until` — pendant que le client lisait, en pièce jointe,
  // un PDF détaillé portant les lignes, les quantités, les prix unitaires, la
  // TVA et les totaux. Le client lisait donc un document et en signait un autre.
  // Un bon pour accord qui ne désigne pas son objet est juridiquement fragile.
  //
  // Le plan interdisait explicitement le repli par template permanent dupliqué
  // (« deux sources de vérité qui divergeront ») : c'est pourtant ce que le
  // circuit faisait déjà, faute de mieux.
  //
  // **Le canal A répare la cause** : la signature porte sur le PDF RÉEL, celui
  // dont l'empreinte est scellée dans `document_hash_sha256`. Une seule source
  // de vérité, donc aucune divergence possible.
  //
  // ⚠️ Contrepartie ASSUMÉE : la preuve est produite par l'organisme, non
  // attestée par un tiers indépendant. En signature simple, la présomption de
  // l'art. 1367 C. civ. n'est de toute façon acquise qu'à la signature
  // QUALIFIÉE, hors périmètre (ADR 0014) — ce qui protège est la qualité du
  // faisceau, que la chaîne de hachage produit. Le jour où un grand compte
  // exigera un certificat opposable, ce circuit repassera `fournisseur` : c'est
  // une ligne à changer ici, et le socle porte déjà les deux canaux.
  devis: { parties: ["client", "axionia"], canal: "maison", libelle: "devis" },

  // ── Canal D — un TIERS contractant attend un certificat opposable ──
  convention: {
    parties: ["client", "axionia"],
    canal: "fournisseur",
    libelle: "convention de formation",
  },
  convention_tripartite: {
    parties: ["client", "financeur", "axionia"],
    canal: "fournisseur",
    libelle: "convention tripartite",
  },
  // Contrat de formation avec un PARTICULIER (art. L.6353-3 à L.6353-7).
  // 🔴 C'est la date de signature de CETTE pièce qui doit faire courir le délai
  // de rétractation de dix jours (L.6353-5), et non l'`acceptedAt` du devis sur
  // lequel le garde-fou court aujourd'hui faute de mieux.
  contrat: {
    parties: ["beneficiaire", "axionia"],
    canal: "fournisseur",
    libelle: "contrat de formation",
  },
  // Tiers contractant, pas un formateur de l'équipe : il attend un exemplaire
  // certifié (indicateur 27 — clause de vérification RNQ).
  contrat_sous_traitance: {
    parties: ["sous_traitant", "axionia"],
    canal: "fournisseur",
    libelle: "contrat de sous-traitance",
  },
  // 🔴 NE PAS confondre avec l'émargement AFEST par séance : le protocole est la
  // pièce contractuelle TRIPARTITE signée UNE FOIS, avant le parcours (cadrage
  // D.6313-3-1). Les confondre a été l'erreur des deux plans précédents.
  //
  // ⚠️ Le bénéficiaire est une personne physique SALARIÉE. Son adresse
  // personnelle ne doit pas être exposée à l'entreprise dans le flux fournisseur.
  protocole_afest: {
    parties: ["axionia", "client", "beneficiaire"],
    canal: "fournisseur",
    libelle: "protocole individuel de formation en situation de travail",
  },
};

/**
 * Circuit d'une pièce, ou `null` si elle ne se signe pas.
 *
 * `null` n'est pas un oubli : sur les 26 types de `DocumentType`, la plupart
 * (convocation, attestation, certificat, facture, BPF…) sont des pièces ÉMISES,
 * pas des engagements négociés. Leur faire porter une signature d'engagement
 * n'aurait aucun sens — et le dire par `null` vaut mieux que par une liste vide,
 * que `signerDocument` refuserait avec un message incompréhensible.
 */
export function circuitPour(documentType: string): CircuitSignature | null {
  return Object.prototype.hasOwnProperty.call(CIRCUITS, documentType)
    ? (CIRCUITS[documentType] as CircuitSignature)
    : null;
}

/** Parties requises d'une pièce, DANS L'ORDRE, ou `null` si elle ne se signe pas. */
export function partiesRequisesPour(documentType: string): readonly PartieSignataire[] | null {
  return circuitPour(documentType)?.parties ?? null;
}

/** Vrai si cette pièce attend une signature. Utilisé pour poser `en_attente`. */
export function pieceSignable(documentType: string): boolean {
  return circuitPour(documentType) !== null;
}

/** Types de pièces signables, pour les tests de propriété et le mode auditeur. */
export const TYPES_SIGNABLES: readonly string[] = Object.keys(CIRCUITS);
