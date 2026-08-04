/**
 * Registre de VÉRIFICATION des signatures au grain document — LECTURE SEULE.
 *
 * ## Ce que ce module répond, et que rien ne répondait encore
 *
 * « Cette pièce est-elle signée, par qui, et sa preuve tient-elle ? »
 *
 * Les trois morceaux existaient séparément : `document-signature-hash.ts` sait
 * recalculer une empreinte, `emargement/hash.ts` sait vérifier une chaîne,
 * `parties-requises.ts` sait qui devait signer. Personne ne les confrontait à
 * l'état réel de la base. Un registre dont personne ne lit le sceau n'est pas un
 * registre : c'est un espoir.
 *
 * ## LECTURE SEULE, sans exception
 *
 * Aucun `create`, aucun `update`, aucun `delete`. Une chaîne corrompue est un
 * RÉSULTAT à présenter, pas une panne à masquer — c'est déjà la doctrine de
 * `verifierChaine`, qui ne lève jamais. « Réparer » une anomalie ici reviendrait
 * à effacer la seule trace d'une falsification, avec les meilleures intentions
 * du monde et exactement le même résultat qu'un attaquant.
 *
 * Corollaire moins évident : le module ne rafraîchit PAS non plus le cache
 * `statutSignature` qu'il constate divergent. Écrire dessus ferait disparaître
 * l'indice au moment même où on le découvre.
 *
 * ## Le cœur crypto est RÉUTILISÉ, jamais réécrit
 *
 * `verifierChaine` et `maillonDocumentDepuisLigne` sont appelés tels quels.
 * Dupliquer une vérification d'intégrité est précisément l'endroit où une
 * divergence se cacherait sans que personne la voie — et on ne s'en apercevrait
 * qu'au contrôle, du mauvais côté de la table.
 *
 * ## Trois familles d'anomalies
 *
 * 1. **La chaîne** (`verifierChaine`) : empreinte altérée, maillon retiré,
 *    version irrecalculable.
 * 2. **Le PDF** : `DocumentSignature.documentHashSha256` (scellé au moment de
 *    l'acte) confronté à `DocumentGenere.hashSha256` (celui de la pièce servie
 *    aujourd'hui). C'est le recoupement que personne ne faisait, et il est de
 *    premier ordre : la chaîne peut être parfaitement intacte pendant que le PDF
 *    téléchargé n'est plus celui qui a été signé.
 * 3. **Le circuit et le cache** : une partie qui n'appartient pas au circuit, une
 *    signature sur une pièce qui ne se signe pas, un `statutSignature` qui ne
 *    correspond plus aux lignes.
 *
 * Stub-safe (build GH Actions sans base — cf. AGENTS.md).
 */

import { prisma } from "@/lib/prisma";
import { verifierChaine, type ResultatVerification } from "@/server/qualiopi/emargement/hash";
import {
  maillonDocumentDepuisLigne,
  type LigneDocumentSignature,
  type MethodeSignatureDocument,
  type PartieSignataire,
  type PieceScellee,
  type ProviderSignature,
} from "./document-signature-hash";
import { verrouColonnesDocument } from "./document-reconstruction";
import { circuitPour, TYPES_SIGNABLES } from "./parties-requises";
import {
  DocumentType,
  type DocumentStatutSignature,
  type Prisma,
} from "../../../../../prisma/generated/client";

/* ────────────────────────────── Types du rapport ───────────────────────────── */

/**
 * Statut RECALCULÉ depuis les lignes de signature vivantes.
 *
 * 🔴 À ne pas confondre avec `DocumentGenere.statutSignature`, qui est un CACHE
 * de lecture. La source de vérité, ce sont les lignes — le schéma le dit lui
 * même (« Statut DÉRIVÉ des lignes `DocumentSignature` »). Ce champ-ci est la
 * dérivation refaite à la lecture ; l'autre est ce que la base croit.
 *
 * `indeterminable` : la pièce n'a aucun circuit déclaré dans le SSOT, donc rien
 * ne définit ce que « complète » voudrait dire. Un `en_attente` inventé serait
 * plus faux qu'un aveu d'ignorance.
 */
export type StatutSignatureRecalcule =
  "non_requise" | "en_attente" | "partielle" | "signee" | "indeterminable";

/**
 * Ce que `verifierChaine` ne peut PAS voir, parce qu'elle ne regarde que la
 * chaîne et jamais le monde autour d'elle.
 *
 * Une chaîne intacte ne prouve que ceci : les lignes n'ont pas bougé depuis leur
 * écriture. Elle ne dit rien du document qu'elles désignent, ni du circuit
 * qu'elles sont censées remplir. Ces cinq anomalies-là couvrent cet angle mort.
 */
export type TypeAnomaliePiece =
  /**
   * 🔴 Le PDF a été RÉGÉNÉRÉ après signature.
   *
   * L'empreinte scellée dans la ligne ne correspond plus à celle de la pièce
   * courante. La signature existe, la chaîne est peut-être intacte, et pourtant
   * elle ne porte plus sur le document que l'on sert. C'est exactement le
   * scénario que `documentHashSha256` a été mis dans le tuple pour rendre
   * visible ; encore fallait-il que quelqu'un regarde.
   */
  | "pdf_regenere_apres_signature"
  /**
   * Les parties n'ont pas signé le MÊME PDF.
   *
   * Deux lignes vivantes portent deux `documentHashSha256` différents : la pièce
   * a été régénérée ENTRE deux signatures. Distinct du cas précédent — ici même
   * en revenant au PDF courant, il n'existe aucune version du document que
   * toutes les parties aient acceptée.
   */
  | "parties_sur_versions_differentes"
  /**
   * Le cache `statutSignature` ne correspond plus aux lignes.
   *
   * ⚠️ REMONTÉ, jamais corrigé. Le cache est écrit dans la même transaction que
   * la preuve ; qu'il diverge signifie soit une écriture directe en base, soit
   * une transaction interrompue. Les deux méritent d'être vues.
   */
  | "statut_cache_divergent"
  /**
   * Une signature existe sur une pièce qu'aucun circuit ne déclare signable.
   *
   * `signerDocument` refuse cette insertion (`parties_requises_absentes`).
   * Trouver la ligne quand même veut dire qu'elle n'est pas passée par le
   * service.
   */
  | "signature_sur_piece_non_signable"
  /**
   * La partie signataire n'appartient pas au circuit de ce type de pièce.
   *
   * Même raisonnement : le service refuse (`partie_non_attendue`). Une signature
   * de « financeur » sur une convention bipartite est soit une écriture directe,
   * soit une modification du SSOT après coup — et dans les deux cas le décompte
   * de complétude est faussé.
   */
  | "partie_hors_circuit";

/**
 * Anomalie de niveau PIÈCE.
 *
 * `signatureId` vaut `null` quand l'anomalie porte sur la pièce entière et non
 * sur une ligne précise. La forme reprend volontairement celle de
 * `AnomalieChaine` : un consommateur doit pouvoir concaténer les deux familles
 * sans écrire deux rendus, sans quoi l'une des deux finira par ne plus être
 * affichée.
 */
export interface AnomaliePiece {
  type: TypeAnomaliePiece;
  signatureId: string | null;
  detail: string;
}

/** Résumé d'un signataire — « par qui ». */
export interface SignataireRegistre {
  signatureId: string;
  partie: PartieSignataire;
  /** Identité FIGÉE au moment de l'acte, pas celle du contact aujourd'hui. */
  signataireNom: string;
  /** Qualité invoquée — l'opposabilité du pouvoir de signer en dépend. */
  signataireQualite: string | null;
  provider: ProviderSignature;
  methode: MethodeSignatureDocument;
  /**
   * 🔴 Les deux horodatages, jamais un seul. Le schéma le dit : « l'écart entre
   * les deux révèle une insertion tardive ». N'en exposer qu'un effacerait la
   * seule trace d'une signature antidatée.
   */
  signeAt: Date;
  createdAt: Date;
  selfHash: string;
  hashVersion: number;
  /** Empreinte du PDF sur lequel CETTE signature porte. */
  documentHashSha256: string;
  /** Faux si le PDF servi aujourd'hui n'est plus celui qui a été signé. */
  porteSurLePdfCourant: boolean;
}

/** Rapport complet d'une pièce. */
export interface RapportPieceSignature {
  documentGenereId: string;
  /** Numéro IMMUABLE — un identifiant technique n'a jamais désigné une pièce. */
  numero: string;
  type: string;
  /** Empreinte du PDF COURANT, celle à laquelle les signatures sont confrontées. */
  hashSha256: string;
  /** Ce que la base CROIT. Cache de lecture, jamais une preuve. */
  statutCache: string;
  /** Ce que les lignes DISENT. */
  statutRecalcule: StatutSignatureRecalcule;
  /** Parties attendues par le SSOT, dans l'ordre de signature. `null` = pièce non signable. */
  partiesRequises: readonly PartieSignataire[] | null;
  /** Parties requises qui n'ont pas encore de signature vivante. */
  partiesManquantes: readonly PartieSignataire[];
  signataires: readonly SignataireRegistre[];
  /** Rapport de `verifierChaine`, tel quel. */
  chaine: ResultatVerification;
  anomaliesPiece: readonly AnomaliePiece[];
  /**
   * Empreinte de TÊTE de chaîne — l'ancrage à citer dans un dossier d'audit.
   * `null` quand la pièce n'a aucune signature vivante.
   */
  empreinteTete: string | null;
  /** Vrai seulement si la chaîne est valide ET qu'aucune anomalie de pièce n'est relevée. */
  preuveIntacte: boolean;
  /**
   * Date d'ANNULATION de la pièce, `null` si elle fait toujours foi.
   *
   * ⚠️ N'affecte PAS `preuveIntacte` : la chaîne de signature d'une pièce
   * annulée reste intacte, et le prétendre rompue serait faux. Ce sont deux
   * questions distinctes — « la preuve tient-elle ? » et « la pièce vaut-elle
   * encore ? » — et le registre doit répondre aux deux séparément.
   */
  annuleeAt: string | null;
  annuleeMotif: string | null;
}

/* ─────────────────────── Types signables réellement en base ────────────────── */

/**
 * Intersection du SSOT des circuits et de l'enum `DocumentType` du schéma.
 *
 * Le filtre SQL a besoin de valeurs d'enum, et `TYPES_SIGNABLES` est
 * volontairement typé `string[]` pour que `parties-requises.ts` reste pur. Le
 * rapprochement se fait donc ici, et il est CONTRÔLÉ plutôt que casté : un
 * `as DocumentType[]` sur une clé mal orthographiée produirait un `IN` qui ne
 * ramène rien, et le registre déclarerait sereinement « aucune pièce à
 * vérifier » — le pire des faux verdicts, celui qui rassure.
 */
const TYPES_SIGNABLES_EN_BASE: readonly DocumentType[] = TYPES_SIGNABLES.filter(
  (t): t is DocumentType => Object.prototype.hasOwnProperty.call(DocumentType, t),
);

/**
 * Clés de circuit qui ne correspondent à AUCUNE valeur de l'enum `DocumentType`.
 *
 * Toujours vide en principe (`parties-requises.spec.ts` fige la liste). Exposé
 * quand même dans le résultat du registre : une dérive SSOT ↔ schéma doit se
 * voir, pas se deviner.
 */
export const TYPES_SIGNABLES_INCONNUS_DU_SCHEMA: readonly string[] = TYPES_SIGNABLES.filter(
  (t) => !Object.prototype.hasOwnProperty.call(DocumentType, t),
);

/* ───────────────────────────── Construction du rapport ─────────────────────── */

/**
 * Pièce telle que ce module a besoin de la lire.
 *
 * `signatures` doit contenir les lignes VIVANTES (`revokedAt: null`) DÉJÀ triées
 * `createdAt` puis `id`. Le tri n'est pas refait ici : il appartient à la requête,
 * et le refaire donnerait l'illusion qu'un appelant peut se permettre de le rater.
 */
export interface PieceAVerifier {
  id: string;
  numero: string;
  type: string;
  hashSha256: string;
  statutSignature: string;
  signatures: readonly LigneDocumentSignature[];
}

/**
 * Construit le rapport d'une pièce. Pure — aucun accès base, aucune horloge.
 *
 * Exportée pour que la vérification soit testable sans mocker Prisma, et pour
 * qu'un appelant qui a déjà chargé ses lignes n'ait pas à les recharger.
 */
export function construireRapportPiece(piece: PieceAVerifier): RapportPieceSignature {
  const scellee: PieceScellee = {
    // ⚠️ Le numéro et le type viennent de la PIÈCE, pas de la ligne : ils sont
    // hachés mais portés par `DocumentGenere`. Conséquence voulue — une pièce
    // renumérotée après signature rendra `empreinte_invalide`, et c'est le
    // VERDICT JUSTE. Ne jamais chercher à retrouver l'ancien numéro : il n'est
    // stocké nulle part, précisément pour que la pièce et sa preuve ne puissent
    // pas diverger en silence.
    documentNumero: piece.numero,
    documentType: piece.type,
  };

  // ── 1. La chaîne, par le cœur crypto commun ──
  const chaine = verifierChaine(
    piece.signatures.map((ligne) => maillonDocumentDepuisLigne(ligne, scellee)),
  );

  const anomaliesPiece: AnomaliePiece[] = [];

  // ── 2. Le recoupement PDF : scellé vs courant ──
  //
  // 🔴 Le point aveugle historique. `verifierChaine` recalcule le tuple à partir
  // de `ligne.documentHashSha256` : si le PDF est régénéré, la ligne ne bouge
  // pas, l'empreinte reste valide, et la chaîne rend « OK » sur une signature qui
  // ne porte plus sur le document servi. Seule la confrontation à
  // `DocumentGenere.hashSha256` le révèle.
  const signataires: SignataireRegistre[] = piece.signatures.map((s) => {
    const porteSurLePdfCourant = s.documentHashSha256 === piece.hashSha256;
    if (!porteSurLePdfCourant) {
      anomaliesPiece.push({
        type: "pdf_regenere_apres_signature",
        signatureId: s.id,
        detail: `signature scellée sur le PDF ${s.documentHashSha256.slice(0, 12)}…, la pièce servie porte ${piece.hashSha256.slice(0, 12)}… — le document a été régénéré après signature`,
      });
    }
    return {
      signatureId: s.id,
      partie: s.partie,
      signataireNom: s.signataireNom,
      signataireQualite: s.signataireQualite,
      provider: s.provider,
      methode: s.methode,
      signeAt: s.signeAt,
      // `createdAt` n'appartient pas au tuple haché et n'est donc pas sur
      // `LigneDocumentSignature`. Il est réinjecté par l'appelant côté base ;
      // en son absence on retombe sur `signeAt` plutôt que d'inventer une date.
      createdAt: s.signeAt,
      selfHash: s.selfHash,
      hashVersion: s.hashVersion,
      documentHashSha256: s.documentHashSha256,
      porteSurLePdfCourant,
    };
  });

  // Les parties ont-elles au moins signé la MÊME version ? Distinct du test
  // ci-dessus : revenir au PDF courant ne réparerait rien, il n'existe aucune
  // version que toutes aient acceptée.
  const versionsSignees = new Set(piece.signatures.map((s) => s.documentHashSha256));
  if (versionsSignees.size > 1) {
    anomaliesPiece.push({
      type: "parties_sur_versions_differentes",
      signatureId: null,
      detail: `${versionsSignees.size} empreintes de PDF distinctes parmi ${piece.signatures.length} signature${piece.signatures.length > 1 ? "s" : ""} — les parties n'ont pas signé le même document`,
    });
  }

  // ── 3. Le circuit ──
  const circuit = circuitPour(piece.type);
  const partiesRequises = circuit?.parties ?? null;
  const posees = new Set(piece.signatures.map((s) => s.partie));

  if (partiesRequises === null) {
    for (const s of piece.signatures) {
      anomaliesPiece.push({
        type: "signature_sur_piece_non_signable",
        signatureId: s.id,
        detail: `le type « ${piece.type} » n'a aucun circuit déclaré, or une signature « ${s.partie} » y figure — cette ligne n'est pas passée par signerDocument`,
      });
    }
  } else {
    for (const s of piece.signatures) {
      if (!partiesRequises.includes(s.partie)) {
        anomaliesPiece.push({
          type: "partie_hors_circuit",
          signatureId: s.id,
          detail: `partie « ${s.partie} » absente du circuit de « ${piece.type} » (attendu : ${partiesRequises.join(", ")}) — le décompte de complétude est faussé`,
        });
      }
    }
  }

  const partiesManquantes = (partiesRequises ?? []).filter((p) => !posees.has(p));

  // ── 4. Le statut recalculé, et la divergence du cache ──
  const statutRecalcule: StatutSignatureRecalcule =
    partiesRequises === null
      ? // Pièce sans circuit : « non_requise » si rien n'y figure, sinon on ne
        // sait pas ce que « complète » signifierait. L'anomalie ci-dessus dit déjà
        // le problème ; inventer un statut le masquerait.
        piece.signatures.length === 0
        ? "non_requise"
        : "indeterminable"
      : piece.signatures.length === 0
        ? "en_attente"
        : partiesManquantes.length === 0
          ? "signee"
          : "partielle";

  ajouterDivergenceCache(anomaliesPiece, piece, statutRecalcule);

  const derniere = piece.signatures[piece.signatures.length - 1];

  return {
    documentGenereId: piece.id,
    numero: piece.numero,
    type: piece.type,
    hashSha256: piece.hashSha256,
    statutCache: piece.statutSignature,
    statutRecalcule,
    partiesRequises,
    partiesManquantes,
    signataires,
    chaine,
    anomaliesPiece,
    empreinteTete: derniere?.selfHash ?? null,
    preuveIntacte: chaine.valide && anomaliesPiece.length === 0,
    // Le vérificateur de preuve ne connaît pas le sort de gestion de la pièce :
    // `reposerSort` le pose après coup, au seul point qui tient encore la ligne
    // Prisma. Par défaut, une pièce fait foi.
    annuleeAt: null,
    annuleeMotif: null,
  };
}

/**
 * Confronte le cache `statutSignature` aux lignes — sans jamais l'écrire.
 *
 * ⚠️ Les règles ci-dessous sont étroites À DESSEIN. Un registre qui crie sur
 * chaque pièce cesse d'être lu, et c'est la façon la plus efficace de rendre une
 * vraie anomalie invisible.
 *
 * Deux non-comparabilités assumées :
 *
 *  - `refusee` et `expiree` sont des états de WORKFLOW qu'aucune ligne de
 *    signature n'exprime. Les comparer produirait une divergence sur chaque
 *    pièce légitimement refusée.
 *  - Une pièce SANS signature vivante peut légitimement porter `non_requise`
 *    (défaut du schéma, posé à la génération) ou `en_attente` (posé par la mise
 *    en attente, cf. `presence.ts`, et par la révocation de la dernière
 *    signature). La mise en attente est un acte de workflow, pas un fait de
 *    preuve : exiger `en_attente` sur toute pièce signable jamais présentée
 *    ferait remonter la moitié du catalogue.
 *
 * Ce qui reste, et qui est franchement anormal :
 *
 *  - le cache annonce `signee`/`partielle` alors qu'AUCUNE signature vivante ne
 *    subsiste ;
 *  - il y a des signatures vivantes et le cache ne dit pas ce qu'elles disent.
 */
function ajouterDivergenceCache(
  anomalies: AnomaliePiece[],
  piece: PieceAVerifier,
  statutRecalcule: StatutSignatureRecalcule,
): void {
  const cache = piece.statutSignature;
  if (cache === "refusee" || cache === "expiree") return;

  if (piece.signatures.length === 0) {
    if (cache === "signee" || cache === "partielle") {
      anomalies.push({
        type: "statut_cache_divergent",
        signatureId: null,
        detail: `le cache annonce « ${cache} » alors qu'aucune signature vivante ne subsiste sur cette pièce`,
      });
    }
    return;
  }

  // `indeterminable` : l'anomalie « signature sur pièce non signable » couvre
  // déjà le cas, en ajouter une seconde ne dirait rien de plus.
  if (statutRecalcule === "indeterminable") return;

  if (cache !== statutRecalcule) {
    anomalies.push({
      type: "statut_cache_divergent",
      signatureId: null,
      detail: `le cache annonce « ${cache} », les ${piece.signatures.length} signature${piece.signatures.length > 1 ? "s" : ""} vivante${piece.signatures.length > 1 ? "s" : ""} disent « ${statutRecalcule} »`,
    });
  }
}

/* ──────────────────────────────── Accès base ───────────────────────────────── */

/**
 * Sélection commune : la pièce, plus ses signatures VIVANTES dans l'ordre.
 *
 * ⚠️ Aucun `select` imbriqué sur `signatures` : la ligne COMPLÈTE est nécessaire
 * pour traverser `verrouColonnesDocument`, qui est le seul point où le miroir
 * écrit à la main est confronté au type Prisma. Un `select` partiel obligerait à
 * un cast, et le verrou deviendrait décoratif.
 */
const SELECTION_PIECE = {
  id: true,
  numero: true,
  type: true,
  hashSha256: true,
  statutSignature: true,
  createdAt: true,
  // 🔴 Une pièce ANNULÉE n'est PAS retirée de ce registre — et c'est voulu.
  // La signature a réellement eu lieu ; l'effacer masquerait qu'on a signé puis
  // annulé, c'est-à-dire très exactement ce qu'un auditeur veut pouvoir voir.
  // Elle doit en revanche être DITE : sans ces deux colonnes, `AXI-DOC-2026-007`
  // continuerait de se présenter comme une pièce signée valable, preuve intacte
  // à l'appui, alors qu'on l'a précisément déclarée sans valeur.
  annuleeAt: true,
  annuleeMotif: true,
  signatures: {
    // La chaîne ne voit que les maillons VIVANTS : une signature révoquée est
    // retirée du chaînage par le service, qui rechaîne la suite. L'inclure ici
    // ferait rendre `rupture_chainage` sur une chaîne saine.
    where: { revokedAt: null },
    // 🔴 `createdAt` puis `id`, JAMAIS `signeAt`. Ce dernier est figé avant
    // l'écriture de l'image sur R2 et peut de surcroît venir d'un tiers, qui ne
    // garantit aucune monotonie : deux parties signant depuis deux postes
    // peuvent commiter dans l'ordre INVERSE de leurs `signeAt`. Trier dessus
    // ferait voir une tête de chaîne à `prevHash` non nul puis une rupture —
    // « registre corrompu », à tort et définitivement, sur une chaîne intacte.
    // `signerDocument` chaîne dans cet ordre exact ; tout vérificateur doit s'y
    // conformer.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  // `satisfies` plutôt que `as const` : la forme est VÉRIFIÉE contre le select
  // Prisma (une colonne renommée casse ici, à la compilation) tout en gardant
  // l'inférence littérale dont dépend le type du résultat. Un `as` ferait
  // l'inverse des deux.
} satisfies Prisma.DocumentGenereSelect;

/** Ligne Prisma complète, telle que `verrouColonnesDocument` l'exige. */
type LignePrismaSignature = Parameters<typeof verrouColonnesDocument>[0];

/**
 * Pièce telle que Prisma la rend avec `SELECTION_PIECE`.
 *
 * Écrit STRUCTURELLEMENT et non par un cast du résultat : c'est ce qui fait que
 * passer directement le retour de `findUnique` ne compile que si les colonnes
 * existent encore. Un `as unknown as` rendrait la garantie décorative et l'on
 * découvrirait à l'audit, pas au build, que la chaîne n'est plus vérifiable.
 */
interface PiecePrisma {
  id: string;
  numero: string;
  type: DocumentType;
  hashSha256: string;
  statutSignature: DocumentStatutSignature;
  createdAt: Date;
  annuleeAt: Date | null;
  annuleeMotif: string | null;
  signatures: LignePrismaSignature[];
}

/**
 * Convertit une pièce Prisma en entrée du rapport, EN TRAVERSANT le verrou.
 *
 * `verrouColonnesDocument` ne compile que si chaque colonne scellée existe
 * toujours sur le modèle. C'est le seul point de passage autorisé.
 */
function versPieceAVerifier(piece: PiecePrisma): PieceAVerifier {
  return {
    id: piece.id,
    numero: piece.numero,
    type: piece.type,
    hashSha256: piece.hashSha256,
    statutSignature: piece.statutSignature,
    signatures: piece.signatures.map((s) => verrouColonnesDocument(s)),
  };
}

/**
 * Réinjecte le `createdAt` réel des lignes dans le rapport.
 *
 * `createdAt` n'entre pas dans le tuple haché — il n'est donc pas sur
 * `LigneDocumentSignature`, et `construireRapportPiece`, qui est pur, retombe sur
 * `signeAt`. Or c'est précisément l'ÉCART entre les deux qui révèle une insertion
 * tardive : les confondre effacerait la seule trace d'une signature antidatée. On
 * le repose ici, où on l'a lu.
 */
/**
 * Reporte le SORT de la pièce sur son rapport.
 *
 * Posé ici, au même point que `reposerCreatedAt`, parce que c'est le seul
 * endroit qui tient encore la ligne Prisma complète. `PieceAVerifier` reste
 * concentré sur la chaîne cryptographique : l'annulation est une décision de
 * gestion, elle n'a rien à faire dans le vérificateur de preuve.
 */
function reposerSort(rapport: RapportPieceSignature, piece: PiecePrisma): RapportPieceSignature {
  return {
    ...rapport,
    annuleeAt: piece.annuleeAt === null ? null : piece.annuleeAt.toISOString(),
    annuleeMotif: piece.annuleeMotif,
  };
}

function reposerCreatedAt(
  rapport: RapportPieceSignature,
  lignes: readonly LignePrismaSignature[],
): RapportPieceSignature {
  const parId = new Map(lignes.map((l) => [l.id, l.createdAt]));
  return {
    ...rapport,
    signataires: rapport.signataires.map((s) => ({
      ...s,
      createdAt: parId.get(s.signatureId) ?? s.createdAt,
    })),
  };
}

/** Vrai pendant le build GH Actions, où aucune base n'est joignable (ADR 0026). */
function baseIndisponible(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/**
 * Vérifie la chaîne de signatures d'UNE pièce.
 *
 * Rend le rapport de `verifierChaine` tel quel, ou `null` si la pièce n'existe
 * pas (ou si la base n'est pas joignable au build). `null` n'est pas « valide » :
 * l'appelant doit le distinguer d'une chaîne vide, qui est un
 * `{ valide: true, nbVerifies: 0 }` légitime.
 *
 * Ne lève jamais sur une chaîne corrompue — c'est un résultat, pas une panne.
 */
export async function verifierChaineDocument(
  documentGenereId: string,
): Promise<ResultatVerification | null> {
  if (baseIndisponible()) return null;

  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: SELECTION_PIECE,
  });
  if (piece === null) return null;

  return construireRapportPiece(versPieceAVerifier(piece)).chaine;
}

/**
 * Rapport COMPLET d'une pièce — chaîne, signataires, recoupement PDF, cache.
 *
 * `verifierChaineDocument` en est la version étroite : quand on veut seulement
 * savoir si la chaîne tient. Ici on veut aussi savoir sur QUOI elle porte.
 */
export async function rapportSignatureDocument(
  documentGenereId: string,
): Promise<RapportPieceSignature | null> {
  if (baseIndisponible()) return null;

  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: SELECTION_PIECE,
  });
  if (piece === null) return null;

  return reposerSort(
    reposerCreatedAt(construireRapportPiece(versPieceAVerifier(piece)), piece.signatures),
    piece,
  );
}

/* ─────────────────────────────── Le registre ───────────────────────────────── */

export interface FiltreRegistre {
  /** Restreint sur le statut CACHE — c'est le seul filtrable en SQL. */
  statuts?: readonly DocumentStatutSignature[];
  /** Restreint à une session (dossier d'audit d'une session). */
  sessionId?: string;
  /** Restreint à certains types de pièce. Ignore les types inconnus du schéma. */
  types?: readonly string[];
  /** Ne rend que les pièces dont la preuve n'est PAS intacte. Filtre a posteriori. */
  seulementAnomalies?: boolean;
  /** Plafond de lignes remontées. Défaut 500, maximum 2 000. */
  limite?: number;
}

export interface RegistreSignatures {
  pieces: readonly RapportPieceSignature[];
  /** Décompte sur le statut RECALCULÉ — celui qui dit la vérité. */
  parStatutRecalcule: Readonly<Record<StatutSignatureRecalcule, number>>;
  /** Décompte sur le CACHE. Exposé à côté : l'écart entre les deux se lit d'un coup d'œil. */
  parStatutCache: Readonly<Record<string, number>>;
  nbPieces: number;
  nbPreuvesIntactes: number;
  nbChainesAnormales: number;
  /** Pièces dont au moins une signature ne porte plus sur le PDF courant. */
  nbPdfRegeneres: number;
  nbStatutsCacheDivergents: number;
  /** Dérive SSOT ↔ schéma. Non vide = un circuit désigne un type qui n'existe pas. */
  typesSignablesInconnusDuSchema: readonly string[];
  /**
   * Vrai si la limite a été atteinte : le registre est PARTIEL et ne doit pas
   * être présenté comme un inventaire complet. Un registre silencieusement
   * tronqué est pire qu'un registre absent — il a l'air exhaustif.
   */
  tronque: boolean;
}

const LIMITE_DEFAUT = 500;
const LIMITE_MAX = 2_000;

/**
 * Liste les pièces par statut de signature, avec leurs anomalies.
 *
 * Le périmètre par défaut : toute pièce dont le TYPE est signable selon le SSOT,
 * PLUS toute pièce portant au moins une signature vivante. Le second terme n'est
 * pas redondant — c'est lui qui fait remonter une signature posée sur une pièce
 * qu'aucun circuit ne déclare signable, cas qui, par construction, échapperait à
 * un filtre bâti sur le seul SSOT.
 *
 * LECTURE SEULE. Rien n'est réparé, ni le cache divergent, ni la chaîne rompue.
 */
export async function listerRegistreSignatures(
  filtre: FiltreRegistre = {},
): Promise<RegistreSignatures> {
  const vide = registreVide();
  if (baseIndisponible()) return vide;

  const limite = Math.min(Math.max(filtre.limite ?? LIMITE_DEFAUT, 1), LIMITE_MAX);

  const typesDemandes =
    filtre.types === undefined
      ? TYPES_SIGNABLES_EN_BASE
      : TYPES_SIGNABLES_EN_BASE.filter((t) => filtre.types?.includes(t));

  const where: Prisma.DocumentGenereWhereInput =
    filtre.types === undefined
      ? {
          // Deux branches, et la seconde n'est pas redondante : c'est elle qui
          // fait remonter une signature posée sur une pièce qu'aucun circuit ne
          // déclare signable — cas qui, par construction, échapperait à un
          // filtre bâti sur le seul SSOT.
          OR: [{ type: { in: [...typesDemandes] } }, { signatures: { some: { revokedAt: null } } }],
        }
      : // Un filtre de type EXPLICITE borne aussi la branche « porte une
        // signature » : sinon demander « les conventions » ramènerait des
        // factures signées par erreur, et le rapport ne répondrait plus à la
        // question posée.
        { type: { in: [...typesDemandes] } };

  if (filtre.sessionId !== undefined) where.sessionId = filtre.sessionId;
  if (filtre.statuts !== undefined) where.statutSignature = { in: [...filtre.statuts] };

  const lignes = await prisma.documentGenere.findMany({
    where,
    // Les plus récentes d'abord : c'est là que se trouve ce qui n'a pas encore
    // été contrôlé. `id` en second pour un ordre total et stable.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limite,
    select: SELECTION_PIECE,
  });

  const pieces = lignes.map((p) =>
    reposerSort(reposerCreatedAt(construireRapportPiece(versPieceAVerifier(p)), p.signatures), p),
  );

  const retenues =
    filtre.seulementAnomalies === true ? pieces.filter((p) => !p.preuveIntacte) : pieces;

  const parStatutRecalcule: Record<StatutSignatureRecalcule, number> = {
    non_requise: 0,
    en_attente: 0,
    partielle: 0,
    signee: 0,
    indeterminable: 0,
  };
  const parStatutCache: Record<string, number> = {};
  let nbPreuvesIntactes = 0;
  let nbChainesAnormales = 0;
  let nbPdfRegeneres = 0;
  let nbStatutsCacheDivergents = 0;

  for (const p of retenues) {
    parStatutRecalcule[p.statutRecalcule] += 1;
    parStatutCache[p.statutCache] = (parStatutCache[p.statutCache] ?? 0) + 1;
    if (p.preuveIntacte) nbPreuvesIntactes += 1;
    if (!p.chaine.valide) nbChainesAnormales += 1;
    if (p.anomaliesPiece.some((a) => a.type === "pdf_regenere_apres_signature"))
      nbPdfRegeneres += 1;
    if (p.anomaliesPiece.some((a) => a.type === "statut_cache_divergent")) {
      nbStatutsCacheDivergents += 1;
    }
  }

  return {
    pieces: retenues,
    parStatutRecalcule,
    parStatutCache,
    nbPieces: retenues.length,
    nbPreuvesIntactes,
    nbChainesAnormales,
    nbPdfRegeneres,
    nbStatutsCacheDivergents,
    typesSignablesInconnusDuSchema: TYPES_SIGNABLES_INCONNUS_DU_SCHEMA,
    // Comparé au nombre LU, pas au nombre retenu : `seulementAnomalies` réduit
    // le résultat sans que le balayage ait été plus profond.
    tronque: lignes.length >= limite,
  };
}

function registreVide(): RegistreSignatures {
  return {
    pieces: [],
    parStatutRecalcule: {
      non_requise: 0,
      en_attente: 0,
      partielle: 0,
      signee: 0,
      indeterminable: 0,
    },
    parStatutCache: {},
    nbPieces: 0,
    nbPreuvesIntactes: 0,
    nbChainesAnormales: 0,
    nbPdfRegeneres: 0,
    nbStatutsCacheDivergents: 0,
    typesSignablesInconnusDuSchema: TYPES_SIGNABLES_INCONNUS_DU_SCHEMA,
    tronque: false,
  };
}
