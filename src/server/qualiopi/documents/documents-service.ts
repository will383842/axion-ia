/**
 * Qualiopi — Service central de génération des documents officiels.
 *
 * `generateDocument` : workflow complet :
 *   1. Allocation numéro séquentiel (AXI-<TYPE>-YYYY-NNN, retry P2002)
 *   2. renderPdfToBuffer — si `buildElement` fourni, le numéro alloué est
 *      injecté dans le template avant le rendu (correction bug en-tête) ;
 *      sinon `element` legacy est utilisé (backward-compat).
 *   3. Upload R2 + URL signée 900s (fail-soft si R2 absent)
 *   4. Création `DocumentGenere` en DB (suppressionPrevueAt = +5 ans)
 *   5. Audit logQualiopiActivity (best-effort)
 *
 * Stub-aware (build stub.invalid) : si DATABASE_URL contient "stub.invalid",
 * skip toutes les opérations DB et retourne un objet minimal.
 */

import React from "react";
import { prisma } from "@/lib/prisma";
import type { DocumentType } from "../../../../prisma/generated/client";
import { renderPdfToBuffer, storeAndSignPdf } from "@/server/qualiopi/documents/render";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { DOCUMENT_REGISTER_TYPES } from "@/server/qualiopi/numbering/formats";
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import { evaluerIdentite, exigeIdentiteComplete } from "@/server/qualiopi/documents/conformite";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { pieceSignable } from "@/server/qualiopi/documents/signature/parties-requises";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

/**
 * Mappage DocumentType → série de numérotation.
 *
 * 🔴 V19 — CE QUE CETTE TABLE FAISAIT DE FAUX, et pourquoi il ne faut pas la
 * « simplifier » en revenant en arrière. Elle projetait 12 types sur la série
 * « formation » et 6 sur « session », c'est-à-dire sur les séries des TABLES
 * MÉTIER. Or `documents_generes` a son propre compteur : les deux registres
 * frappaient les mêmes chaînes, chacun sans voir l'autre, et l'unicité de
 * `numero` étant déclarée table par table, Postgres ne pouvait rien y faire.
 * En production (SELECT du 2026-07-26), `AXI-FORM-2026-001` désigne la
 * formation « IA Express » ET un livret d'accueil ; `AXI-SESS-2026-001` une
 * session ET une feuille d'émargement ; 7 numéros portent chacun deux pièces
 * sans rapport.
 *
 * RÈGLE, désormais tenue par le TYPE et non par la vigilance du lecteur : toute
 * valeur de cette table appartient à `DOCUMENT_REGISTER_TYPES`. Remapper
 * `livret_accueil: "formation"` ne compile plus. Ne conservent un préfixe propre
 * que les séries dont le numéro est IMPRIMÉ sur la pièce remise au tiers et
 * vérifié par QR — attestation et certificat de réalisation — et dont
 * `documents_generes` est l'unique propriétaire.
 *
 * Cas `facture` / `devis` / `avoir` : le PDF imprime déjà le numéro de
 * l'ENTITÉ comptable (`factureFormation.numero`, `devis.numero` — cf.
 * facturation-service.ts « #7 »). Le numéro DocumentGenere n'est qu'une cote
 * de classement interne. Le faire ressembler à un numéro de facture est
 * précisément le piège : une pièce classée `AXI-FACT-…` introuvable dans les
 * livres, c'est un refus au contrôle.
 */
const DOC_TYPE_TO_NUMBERING: Record<DocumentType, (typeof DOCUMENT_REGISTER_TYPES)[number]> = {
  convention: "document",
  convention_tripartite: "document",
  contrat: "document",
  convocation: "document",
  emargement: "document",
  releve_connexion: "document",
  positionnement: "document",
  grille_evaluation: "document",
  satisfaction: "document",
  // Numéro imprimé sur la pièce remise au stagiaire et vérifié par QR.
  attestation: "attestation",
  attestation_partielle: "attestation",
  certificat_realisation: "certificat",
  // Cote de classement interne — le PDF porte le numéro comptable de l'entité.
  facture: "document",
  devis: "document",
  avoir: "document",
  kit_opco: "document",
  kit_cpf: "document",
  kit_france_travail: "document",
  lettre_mission: "document",
  reglement_interieur: "document",
  livret_accueil: "document",
  protocole_afest: "document",
  // Inventaire des moyens pédagogiques (A14).
  inventaire_moyens: "document",
  // Contrat de sous-traitance (ind. 27).
  contrat_sous_traitance: "document",
  // Fiche formateur versée au dossier (ind. 21).
  cv_formateur: "document",
};

export interface GenerateDocumentInput {
  type: DocumentType;
  /**
   * Élément React pré-construit (legacy — le numéro séquentiel NE sera PAS
   * injecté dans le rendu, utiliser `buildElement` pour corriger l'en-tête).
   * Obligatoire si `buildElement` est absent.
   */
  element?: React.ReactElement;
  /**
   * Factory qui reçoit le numéro séquentiel alloué juste avant le rendu.
   * Utiliser cette forme pour que l'en-tête du PDF affiche le vrai numéro.
   * Prioritaire sur `element` quand les deux sont fournis.
   */
  buildElement?: (numero: string) => React.ReactElement;
  /**
   * Identité de l'organisme. Si fournie ET que le type de document a une valeur
   * juridique/fiscale (facture, convention, tripartite, contrat), un garde-fou
   * de conformité (`assertOrganismeComplet`) refuse la génération si un champ
   * obligatoire (SIRET, NDA, adresse siège, Qualiopi) est vide — plutôt que de
   * masquer la ligne en silence. Optionnel pour rétro-compatibilité.
   */
  identite?: OrganismeIdentite;
  refs?: {
    formationId?: string;
    sessionId?: string;
    traineeId?: string;
    clientId?: string;
    /** Coaching 1-to-1 AFEST (C1) : rattache le document à son parcours. */
    coachingSessionId?: string;
  };
  /**
   * Métadonnées de PRODUCTION à figer sur la pièce.
   *
   * 🔴 Sert à enregistrer les conditions dans lesquelles le PDF a été calculé,
   * pas son contenu. L'usage qui l'a fait naître : le régime de preuve d'un
   * parcours AFEST. Une feuille d'émargement produite sous `legacy_boolean`
   * continuait d'être servie telle quelle après bascule en `signature_reelle`,
   * parce que la génération est IDEMPOTENTE — la feuille disait alors une chose
   * pendant que la facture, le BPF et le certificat du même parcours en
   * disaient une autre.
   *
   * ⚠️ Ce n'est PAS un fourre-tout. Une donnée qui appartient au contenu de la
   * pièce doit être dans le PDF, où elle est hachée ; ici rien n'est scellé.
   *
   * ⚠️ Le marquage SPÉCIMEN reste prioritaire et n'est jamais écrasé : c'est une
   * information de conformité, pas une condition de calcul.
   */
  metadata?: Record<string, unknown>;
  /**
   * Force le filigrane « COPIE ».
   *
   * Laissé vide, il est DÉDUIT : toute régénération d'un document de même type
   * et de mêmes références en est une. Sans cette déduction, deux originaux non
   * filigranés circulaient avec deux numéros officiels différents pour la même
   * prestation — ce qu'un contrôle relève immédiatement.
   */
  estCopie?: boolean;
  qrToken?: string | null;
  /**
   * Clé R2 du fichier source original (ex. CSV relevé de connexion archivé).
   * Stockée dans `DocumentGenere.fichierOriginalPath` pour traçabilité CDC.
   * Optionnel — absent pour les documents PDF sans source d'import.
   */
  fichierOriginalPath?: string;
}

export interface GenerateDocumentResult {
  id: string;
  numero: string;
  pdfUrl: string | null;
  hashSha256: string;
}

/**
 * Ce tirage reprend-il une pièce DÉJÀ émise ?
 *
 * ## Le piège que cette fonction évite
 *
 * Sa première version filtrait sur les seules références FOURNIES. Or six types
 * de documents sont établis PAR STAGIAIRE mais rattachés à la seule session
 * (contrat de formation, convocation, grille d'évaluation, certificat de
 * réalisation, kits CPF et France Travail). Sur une session de huit personnes,
 * le premier contrat était un original et les sept suivants étaient enregistrés
 * « copie ». Un certificat de réalisation marqué copie, c'est une pièce
 * affaiblie devant un financeur.
 *
 * Deux règles corrigent ça.
 *
 * **La correspondance est EXACTE.** Les références absentes sont comparées à
 * `null`, pas ignorées : une pièce rattachée à une session ET à un stagiaire ne
 * peut plus être confondue avec une pièce rattachée à la seule session.
 *
 * **Sans aucune référence, on ne conclut pas.** Quatre types n'en portent
 * aucune (inventaire des moyens, contrat de sous-traitance, fiche formateur,
 * facture 1-to-1) : le compte dégénérait alors en « deuxième document de ce type
 * jamais émis » — et marquait copie le contrat d'un AUTRE sous-traitant, ou la
 * deuxième facture de l'histoire. Mieux vaut ne pas savoir que se tromper : un
 * appelant qui veut le filigrane passe `estCopie: true`.
 */
async function estUneRegenerationDe(input: GenerateDocumentInput): Promise<boolean> {
  // 🔴 #8 — Les FACTURES, AVOIRS et DEVIS sont MULTIPLES par session/client (facture
  // OPCO + reste-à-charge stagiaire, une facture par participant inter-entreprises,
  // un avoir rectificatif, plusieurs devis distincts pour un même client…). Chacun
  // est un ORIGINAL unique, pas une réédition. Les soumettre à l'heuristique « même
  // ref = régénération » estampillait « COPIE » toute pièce distincte après la
  // première — un devis/facture qu'un client rejette. Une vraie réédition passe par
  // `estCopie: true` explicite.
  if (input.type === "facture" || input.type === "avoir" || input.type === "devis") return false;

  const refs = input.refs;
  const identifiants = [
    refs?.formationId,
    refs?.sessionId,
    refs?.traineeId,
    refs?.clientId,
    refs?.coachingSessionId,
  ];
  if (identifiants.every((v) => v == null)) return false;

  const count = await prisma.documentGenere.count({
    where: {
      type: input.type,
      formationId: refs?.formationId ?? null,
      sessionId: refs?.sessionId ?? null,
      traineeId: refs?.traineeId ?? null,
      clientId: refs?.clientId ?? null,
      coachingSessionId: refs?.coachingSessionId ?? null,
    },
  });
  return count > 0;
}

/**
 * Injecte le filigrane « COPIE » dans les données du gabarit.
 *
 * ⚠️ Sans ce passage, `estCopie` était écrit en base et n'atteignait JAMAIS le
 * PDF : `buildElement(numero)` ne reçoit que le numéro. La base disait « copie »
 * et la pièce sortait identique à l'original — soit très exactement ce que le
 * filigrane devait empêcher.
 *
 * Fait ici plutôt que dans les 43 appelants : les 26 gabarits concernés lisent
 * tous `data.estCopie`, et un oubli dans un seul appelant serait invisible.
 */
function avecFiligraneCopie(element: React.ReactElement, estCopie: boolean): React.ReactElement {
  if (!estCopie) return element;
  const props = element.props as { data?: unknown };
  if (typeof props.data !== "object" || props.data === null) return element;
  return React.cloneElement(element, {
    data: { ...(props.data as Record<string, unknown>), estCopie: true },
  } as Partial<unknown>);
}

/**
 * Injecte le marquage SPÉCIMEN dans `data` (même mécanique que le filigrane
 * COPIE, et pour la même raison : le faire ici plutôt que dans les 43
 * appelants). `QualiopiPage` lit `estSpecimen` / `specimenMotif` et rend le
 * filigrane plus le bandeau d'explication.
 */
function avecMarquageSpecimen(
  element: React.ReactElement,
  specimen: { manquants: string[]; motif: string } | null,
): React.ReactElement {
  if (!specimen) return element;
  const props = element.props as { data?: unknown };
  if (typeof props.data !== "object" || props.data === null) return element;
  return React.cloneElement(element, {
    data: {
      ...(props.data as Record<string, unknown>),
      estSpecimen: true,
      specimenMotif: specimen.motif,
    },
  } as Partial<unknown>);
}

/**
 * Génère un document officiel Qualiopi (PDF + DB + R2).
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne un objet
 * minimal sans toucher la DB ni R2 (le build SSG ne doit pas muter).
 *
 * Ordre des opérations (correction bug numéro en-tête) :
 *   1. Allocation du numéro séquentiel.
 *   2. Rendu PDF — si `buildElement` fourni, le numéro alloué est passé au
 *      template ; sinon `element` legacy est utilisé (backward-compat).
 *   3. Upload R2 + création DB.
 *   Sur collision P2002 : ré-alloue un nouveau numéro ET re-rend le PDF.
 */
export async function generateDocument(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentResult> {
  // Stub-aware early-exit (build GitHub Actions) — AVANT toute validation pour
  // ne jamais casser le build SSG (le contrat stub.invalid prime).
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      id: "stub-id",
      numero: "AXI-STUB-0000-000",
      pdfUrl: null,
      hashSha256: "0".repeat(64),
    };
  }

  // Garde-fou conformité (runtime only) : refuse un document à valeur
  // juridique/fiscale si l'identité de l'OF est incomplète (SIRET/NDA/adresse/
  // Qualiopi vides) plutôt que de masquer la ligne en silence. Systématique
  // pour ces types : si l'appelant ne fournit pas `identite`, on la relit depuis
  // la config (le `??` évite la lecture DB quand elle est déjà passée).
  // Audit certification 2026-07-25 : on ne REFUSE plus, on DÉCLASSE. Un refus
  // rendait toute la chaîne inexerçable avant l'obtention du SIRET/NDA — et
  // remontait à l'utilisateur sous forme d'écran de plantage générique, sans
  // jamais lui dire ce qui manquait. Le document est désormais produit, marqué
  // SPÉCIMEN (filigrane + bandeau + `metadata.specimen`), donc impossible à
  // confondre avec une pièce valable.
  let specimen: { manquants: string[]; motif: string } | null = null;
  if (exigeIdentiteComplete(input.type)) {
    const identite = input.identite ?? (await getOrganismeIdentite());
    const verdict = evaluerIdentite(identite, input.type);
    if (!verdict.conforme && verdict.motif) {
      specimen = { manquants: verdict.manquants, motif: verdict.motif };
    }
  }

  // 1. Allocation numéro séquentiel + rendu PDF (retry sur P2002 contrainte unique).
  const year = new Date().getFullYear();
  // Pas de `?? "formation"` : `DOC_TYPE_TO_NUMBERING` est un Record EXHAUSTIF
  // sur `DocumentType`, le repli était du code mort. Pire, il aurait absorbé en
  // silence l'oubli d'un futur type — en le renvoyant sur la série des
  // formations, c'est-à-dire exactement la collision que V19 corrige. Sans lui,
  // l'oubli devient une erreur de type au build.
  const numberingType = DOC_TYPE_TO_NUMBERING[input.type];

  let created: { id: string; numero: string; pdfUrl: string | null; hashSha256: string } | null =
    null;
  let attempt = 0;
  const MAX_ATTEMPTS = 5;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;

    // 1a. Prochain numéro de la série DOCUMENTAIRE — borne haute, pas cardinalité.
    //
    // 🔴 V20. `count(*) + 1` est DÉTERMINISTE : deux tours de cette boucle
    // rendaient le MÊME numéro, donc la reprise sur P2002 rejouait cinq fois la
    // même collision avant d'échouer durement. Un simple trou dans la série (une
    // pièce purgée, une création annulée) verrouillait la génération pour de bon.
    // `nextNumero` lit MAX(séquence) : il progresse dès qu'une insertion
    // concurrente a abouti — la reprise CONVERGE — et un numéro déjà émis n'est
    // jamais réattribué (CGI, art. 242 nonies A ann. II).
    //
    // 🔴 V19. La série lue est celle de `documents_generes` et d'elle seule. La
    // table est écrite ici, à la main, parce qu'une série est le couple
    // (PRÉFIXE, TABLE) : la déduire du type était précisément l'erreur qui
    // faisait frapper `AXI-FORM-2026-001` par deux registres différents.
    const numero = await nextNumero(numberingType, year, (prefixe) =>
      prisma.documentGenere.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    );

    // 🔴 Une régénération n'est JAMAIS un original. Chaque tirage alloue un
    // nouveau numéro séquentiel : sans filigrane, deux pièces d'apparence
    // officielle circuleraient pour la même prestation, avec des numéros
    // différents. C'est exactement ce qu'un contrôleur remarque.
    const estUneRegeneration = input.estCopie ?? (await estUneRegenerationDe(input));

    // 1b. Rendu PDF — le numéro alloué est injecté via buildElement si fourni.
    let elementToRender: React.ReactElement;
    if (input.buildElement !== undefined) {
      elementToRender = input.buildElement(numero);
    } else if (input.element !== undefined) {
      elementToRender = input.element;
    } else {
      throw new Error(
        "[generateDocument] L'un des champs `element` ou `buildElement` est obligatoire.",
      );
    }
    elementToRender = avecFiligraneCopie(elementToRender, estUneRegeneration);
    elementToRender = avecMarquageSpecimen(elementToRender, specimen);
    const { buffer, hashSha256, sizeBytes } = await renderPdfToBuffer(elementToRender);

    // 2. Upload R2 (fail-soft).
    const key = `documents/${year}/${input.type}/${numero}.pdf`;
    const pdfUrl = await storeAndSignPdf(buffer, key);

    // 3. Création DB.
    const now = new Date();
    const suppressionPrevueAt = new Date(now);
    suppressionPrevueAt.setFullYear(suppressionPrevueAt.getFullYear() + DOCUMENT_RETENTION_YEARS);

    try {
      const doc = await prisma.documentGenere.create({
        data: {
          type: input.type,
          numero,
          pdfUrl,
          hashSha256,
          sizeBytes,
          estCopie: estUneRegeneration,
          suppressionPrevueAt,
          // 🔴 Une pièce SIGNABLE naît EN ATTENTE de signature.
          //
          // Laissée à `non_requise`, elle dirait qu'elle suit son cours sans
          // être signée, et le registre du mode auditeur ne la ferait jamais
          // remonter — alors que « cette pièce est-elle signée ? » est
          // exactement la question qu'un contrôle pose.
          //
          // ⚠️ La réponse vient du SSOT `parties-requises.ts`, jamais d'une
          // liste locale et jamais d'un circuit appelant. La première version
          // faisait poser `en_attente` par chaque circuit après coup : c'était
          // N endroits à ne pas oublier, et un `UPDATE` de plus après un
          // `create`. Le SSOT sait, donc c'est ici que ça se décide — une fois.
          //
          // ⚠️ Un SPÉCIMEN reste signable au sens du statut : il EXIGE une
          // signature, il ne peut simplement pas la recevoir tant qu'il est
          // déclassé (`signerDocument` le refuse explicitement). Le marquer
          // `non_requise` masquerait une pièce qu'il faut précisément corriger.
          ...(pieceSignable(input.type) ? { statutSignature: "en_attente" as const } : {}),
          // Traçabilité du déclassement : un document SPÉCIMEN doit rester
          // identifiable comme tel en base, pas seulement à l'impression.
          //
          // ⚠️ Les deux sources sont FUSIONNÉES, et le SPÉCIMEN est écrit en
          // DERNIER : un appelant ne doit pas pouvoir effacer, même par
          // inadvertance, le marquage qui dit que la pièce n'a pas de valeur
          // juridique.
          ...(specimen !== null || input.metadata !== undefined
            ? {
                metadata: {
                  ...(input.metadata ?? {}),
                  ...(specimen ? { specimen: true, champsManquants: specimen.manquants } : {}),
                },
              }
            : {}),
          ...(input.qrToken != null ? { qrToken: input.qrToken, qrTokenCreatedAt: now } : {}),
          ...(input.refs?.formationId != null ? { formationId: input.refs.formationId } : {}),
          ...(input.refs?.sessionId != null ? { sessionId: input.refs.sessionId } : {}),
          ...(input.refs?.traineeId != null ? { traineeId: input.refs.traineeId } : {}),
          ...(input.refs?.clientId != null ? { clientId: input.refs.clientId } : {}),
          ...(input.refs?.coachingSessionId != null
            ? { coachingSessionId: input.refs.coachingSessionId }
            : {}),
          ...(input.fichierOriginalPath != null
            ? { fichierOriginalPath: input.fichierOriginalPath }
            : {}),
        },
        select: { id: true, numero: true, pdfUrl: true, hashSha256: true },
      });

      created = doc;
      break;
    } catch (err: unknown) {
      // P2002 = contrainte unique violée (course condition sur le numéro).
      const isPrismaUniqueError =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";

      if (isPrismaUniqueError && attempt < MAX_ATTEMPTS) {
        // Retry : ré-alloue un nouveau numéro + re-rend le PDF au prochain tour.
        continue;
      }
      throw err;
    }
  }

  if (!created) {
    throw new Error(
      `[generateDocument] Impossible d'allouer un numéro unique après ${MAX_ATTEMPTS} tentatives (type=${input.type}, year=${year})`,
    );
  }

  // 5. Audit (best-effort — logQualiopiActivity est fail-silent).
  // Note : logQualiopiActivity requiert un AdminSession. Ici on appelle
  // la version best-effort directement via prisma pour éviter la dépendance
  // sur next/headers dans ce module pur. On log via un pseudo-système.
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action: `qualiopi.document.generate`,
        targetType: "DocumentGenere",
        targetId: created.id,
        changes: {
          type: input.type,
          numero: created.numero,
          hashSha256: created.hashSha256,
        } as never,
        ipAddress: null,
        userAgent: null,
      },
    });
  } catch {
    // Best-effort : un log raté n'invalide pas la génération.
  }

  return {
    id: created.id,
    numero: created.numero,
    pdfUrl: created.pdfUrl,
    hashSha256: created.hashSha256,
  };
}

// 🔴 `getNumberingPrefixSegment` a été SUPPRIMÉE (V19).
//
// Elle réécrivait à la main le segment de préfixe de chaque type — une SECONDE
// source de vérité en face de `NUMBERING_PREFIX`, avec un repli `?? "FORM"` qui
// renvoyait tout type inconnu sur la série des formations. C'est cette double
// écriture qui a rendu la dérive possible et invisible : ajouter une entrée d'un
// côté sans l'autre ne cassait rien, et n'était détecté par aucun test.
//
// La seule source est désormais `seriesPrefix()` (numbering/formats.ts), appelée
// par `nextNumero`. Ne pas réintroduire de table de correspondance locale.
