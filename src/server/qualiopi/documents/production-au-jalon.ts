/**
 * S5 — PRODUCTION AUTOMATIQUE DES PIÈCES AU JALON. Module PUR.
 *
 * Décision de Will (2026-08-26) : « que le système génère ET envoie en fonction
 * du type de client, automatiquement ». Ce module porte la DÉCISION du worker
 * `qualiopi-documents-worker` : pour un instantané de session donné, quelles
 * pièces produire MAINTENANT. Aucun accès Prisma ici — testable à sec.
 *
 * Les trois filtres, dans l'ordre (plan CHAINE-DOCUMENTAIRE.md, S5) :
 *   1. pertinence `attendue` SEULEMENT (`pertinence-piece.ts`) — jamais une
 *      `possible` en automatique : la lettre de mission déjà ANNULÉE au registre
 *      sur un dossier réel est exactement la pièce qu'un automatisme aveugle
 *      aurait reproduite ;
 *   2. moment : `pieceEstRemise` (`piece-remise.ts`) — PRODUIRE au jalon où la
 *      pièce devient due, jamais avant (défaut du 16/08 sur les questionnaires,
 *      transposé aux documents) — avec le fail-open des dates nulles FERMÉ :
 *      `pieceEstRemise` remet tout quand les dates manquent (choix assumé côté
 *      portail), donc ici tout jalon ≠ `immediat` EXIGE `dateDebut` non nulle ;
 *   3. déduplication contre les pièces vivantes non-copies — l'idempotence de
 *      DÉCISION ; le verrou d'ÉCRITURE vit côté worker (re-check avant create)
 *      et, à terme, dans un index unique partiel en base.
 *
 * ⚠️ Les types à jalon `jamais` (facture, devis, avoir, kits…) ne sont PAS
 * produits par ce lot : chacun a son propre circuit (facturation, parcours
 * vente, kits financeurs) où un HUMAIN engage l'organisme. Ce module couvre
 * les jalons `immediat` / `jour_j` / `apres_realisation` uniquement.
 */

import type { DocumentType } from "../../../../prisma/generated/client";
import {
  jalonPour,
  pieceEstRemise,
  TYPES_AVEC_JALON,
  type JalonRemise,
} from "@/server/qualiopi/portail/piece-remise";
import { pertinencePiece } from "@/server/qualiopi/documents/pertinence-piece";
import { TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE } from "@/server/qualiopi/portail/portail-service";

// ─────────────────────────────────────────────────────────────────────────────
// G5 — LE CANAL DE REMISE : la décision qui ferme M19
// ─────────────────────────────────────────────────────────────────────────────

export type CanalRemise =
  /** Bloc « Pièces » de l'espace stagiaire (`portail-service.ts`). */
  | "portail_stagiaire"
  /** Bloc « Attestations » dédié du même espace. */
  | "bloc_attestations"
  /** Circuit `DocumentSignatureToken` : le lien de signature EST la remise. */
  | "lien_signature"
  /** Module émargement (jetons + feuille) : la présence se signe là. */
  | "module_emargement"
  /** Questionnaires à jeton : le recueil passe par eux, le PDF n'est qu'un support. */
  | "module_questionnaire"
  /** Envoi par un cron e-mail dédié. */
  | "email_cron"
  /** Aucun canal bénéficiaire — licite SEULEMENT pour un jalon `jamais`. */
  | "aucun";

/**
 * 🔴 LA DÉCISION (S5, 2026-08-26) — chaque type à jalon ≠ `jamais` a désormais
 * un canal de remise NOMMÉ. Avant cette table, 9 types étaient déclarés
 * « remis au bénéficiaire » sans qu'AUCUN écran ne les remonte (constat M19),
 * et la spec du portail verrouillait l'écart au lieu de le signaler.
 *
 * Les choix, et leurs raisons :
 *  - pièces d'INFORMATION (programme, RI, livret, organisation, convocation,
 *    autorisation de captation) → `portail_stagiaire` : le bloc « Pièces »
 *    existe et les sert déjà ;
 *  - attestations / certificat → `bloc_attestations` : leur bloc dédié existe ;
 *  - pièces CONTRACTUELLES (convention, tripartite, contrat, protocole AFEST)
 *    → `lien_signature` : c'est par le circuit `DocumentSignatureToken` que le
 *    bénéficiaire relit ce qu'il signe — M19 est ASSUMÉ ainsi, plutôt que de
 *    doubler la pièce au portail à côté de son circuit d'engagement ;
 *  - émargement / relevé de connexion → `module_emargement` : la feuille vit
 *    dans le module d'émargement (jetons, signatures), pas en PDF au portail ;
 *  - grille d'évaluation / satisfaction / positionnement →
 *    `module_questionnaire` : le recueil passe par les questionnaires à jeton,
 *    le PDF n'est qu'un support d'archivage ;
 *  - les 12 types `jamais` → `aucun`, et c'est licite : pièces organisme ↔
 *    financeur, jamais côté bénéficiaire.
 *
 * G5 (spec du worker) rougit si un type à jalon ≠ `jamais` retombe à `aucun`.
 */
export const CANAL_DE_REMISE: Record<DocumentType, CanalRemise> = {
  // Pièces d'information — bloc « Pièces » de l'espace stagiaire.
  programme: "portail_stagiaire",
  reglement_interieur: "portail_stagiaire",
  livret_accueil: "portail_stagiaire",
  organisation_action: "portail_stagiaire",
  convocation: "portail_stagiaire",
  autorisation_captation: "portail_stagiaire",

  // Pièces de fin de parcours — bloc « Attestations » dédié.
  attestation: "bloc_attestations",
  attestation_partielle: "bloc_attestations",
  certificat_realisation: "bloc_attestations",

  // Pièces contractuelles — le lien de signature est le canal de relecture.
  convention: "lien_signature",
  convention_tripartite: "lien_signature",
  contrat: "lien_signature",
  protocole_afest: "lien_signature",

  // La présence se signe dans le module émargement, pas au portail.
  emargement: "module_emargement",
  releve_connexion: "module_emargement",

  // Le recueil passe par les questionnaires à jeton.
  grille_evaluation: "module_questionnaire",
  satisfaction: "module_questionnaire",
  positionnement: "module_questionnaire",

  // Jalon `jamais` : pièces organisme ↔ financeur / intervenant — pas de canal
  // bénéficiaire, et c'est la doctrine (`piece-remise.ts`).
  facture: "aucun",
  avoir: "aucun",
  devis: "aucun",
  kit_opco: "aucun",
  kit_cpf: "aucun",
  kit_france_travail: "aucun",
  lettre_mission: "aucun",
  contrat_sous_traitance: "aucun",
  inventaire_moyens: "aucun",
  procedure_sous_traitance: "aucun",
  cv_formateur: "aucun",
  liste_formateurs: "aucun",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types de l'instantané
// ─────────────────────────────────────────────────────────────────────────────

export type Financement = "direct" | "opco" | "cpf" | "france_travail" | "mixte";
export type TypeClient = "entreprise" | "particulier";

export interface InstantaneSession {
  readonly id: string;
  /** `planifiee` · `en_cours` · `realisee` · `annulee` · `reportee`. */
  readonly statut: string;
  readonly dateDebut: Date | null;
  readonly dateFin: Date | null;
  readonly financementType: Financement | null;
  readonly clientType: TypeClient | null;
  readonly formateurEstLeDirigeant?: boolean;
}

export interface InstantaneInscription {
  readonly id: string;
  readonly traineeId: string | null;
  /** Overrides inter-entreprises (R-INTER) — sinon le contexte session vaut. */
  readonly financementType?: Financement | null;
  readonly clientType?: TypeClient | null;
}

export interface PieceExistante {
  readonly type: string;
  readonly traineeId: string | null;
  readonly annuleeAt: Date | null;
  readonly estCopie: boolean;
}

export interface InstantaneProduction {
  readonly session: InstantaneSession;
  /** Inscriptions ACTIVES uniquement — l'appelant filtre (abandon/exclu dehors). */
  readonly enrollments: ReadonlyArray<InstantaneInscription>;
  readonly piecesExistantes: ReadonlyArray<PieceExistante>;
}

export interface ProductionAFaire {
  readonly type: DocumentType;
  /** Porteur d'une pièce nominative — `null` pour une pièce de session. */
  readonly traineeId: string | null;
  /** Inscription porteuse (pièces nominatives) — `null` pour une pièce de session. */
  readonly enrollmentId: string | null;
  readonly jalon: JalonRemise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tables de décision annexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * G4 — pièces NOMINATIVES à la production : établies pour UNE personne, elles
 * exigent un porteur (`traineeId`). L'ensemble part de la liste du portail
 * (convocation, autorisation de captation) et y ajoute les pièces établies par
 * stagiaire hors espace « Pièces » : le contrat, la grille d'évaluation, les
 * attestations/certificats et les kits individuels.
 */
export const TYPES_PIECES_NOMINATIVES_PRODUCTION: ReadonlyArray<string> = [
  ...TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE,
  "contrat",
  "grille_evaluation",
  "certificat_realisation",
  "attestation",
  "attestation_partielle",
  "kit_cpf",
  "kit_france_travail",
];

/**
 * Types à jalon ≠ `jamais` que CE lot ne produit PAS, chacun pour une raison
 * nommée — jamais par oubli.
 *
 * 🔴 2026-09-05 — CE COMMENTAIRE DÉCRIVAIT UN CÂBLAGE QUI N'EXISTE PAS.
 *
 * Il rangeait `certificat_realisation` avec les attestations en affirmant que
 * « leur circuit automatique EXISTE (`attestation-service` + cron
 * `attestations-auto`) ». C'est vrai des deux attestations. C'est FAUX du
 * certificat : `attestation-service.ts` ne produit que `attestation` et
 * `attestation_partielle`, et aucun cron ne mentionne le certificat. Un
 * commentaire qui justifie une exclusion par un circuit inexistant est pire
 * que pas de commentaire — il ferme la question au lecteur suivant, qui n'ira
 * pas vérifier, et il ferait passer une pièce jamais émise pour une pièce
 * automatique. Chaque exclusion dit désormais ce qui est vrai d'ELLE.
 *
 *  - `attestation` / `attestation_partielle` : circuit automatique RÉEL — cron
 *    `formation-crons.attestations-auto` → `genererAttestationPourEnrollment`.
 *    Il porte des gardes que ce lot n'a pas : taux de présence mesuré, trace
 *    d'assiduité vérifiable, évaluation finale, et le claim atomique
 *    `attestationGenereeAt`. Les produire ici les contournerait — le défaut
 *    AXI-ATT-2026-003 (attestation qui se contredit elle-même) reviendrait.
 *
 *  - `certificat_realisation` : **AUCUN circuit automatique. Clic admin
 *    uniquement** (`genererCertificatRealisationAction`). Et c'est délibéré,
 *    pour deux raisons :
 *      1. sa garde vit DANS l'action — taux mesuré + `EmargementSignature` non
 *         révoquée ou créneau importé. La rebrancher ici en ferait une seconde
 *         copie, et ce dépôt a payé neuf fois en une nuit le motif « deux
 *         gardes jumelles qui divergent le jour où l'on corrige l'une » ;
 *      2. le certificat est la pièce du FINANCEUR, réclamée au règlement d'un
 *         dossier — pas une conséquence d'un jalon de calendrier. L'émettre
 *         d'office pour chaque inscrit de chaque session close consommerait un
 *         numéro dans une série continue (CGI art. 242 nonies A ann. II) pour
 *         des dossiers que personne ne financera jamais.
 *    ⇒ Si un jour ce circuit doit devenir automatique, la garde doit d'abord
 *    descendre de l'action vers un service partagé. Pas l'inverse.
 *
 *  - `releve_connexion` : la pièce naît d'un IMPORT de données externes (CSV
 *    plateforme distancielle). Sans source, il n'y a rien à produire — un PDF
 *    vide serait une fausse preuve.
 */
export const TYPES_HORS_LOT_DOCUMENTS_AUTO: ReadonlySet<string> = new Set([
  "attestation",
  "attestation_partielle",
  "certificat_realisation",
  "releve_connexion",
]);

/** Statuts de session pour lesquels plus rien ne se produit. */
const STATUTS_SANS_PRODUCTION = new Set(["annulee", "reportee"]);

// ─────────────────────────────────────────────────────────────────────────────
// La décision
// ─────────────────────────────────────────────────────────────────────────────

function estNominative(type: string): boolean {
  return TYPES_PIECES_NOMINATIVES_PRODUCTION.includes(type);
}

/** Une pièce vivante (non annulée) et non-copie existe-t-elle pour ce porteur ? */
function pieceVivanteExiste(
  pieces: ReadonlyArray<PieceExistante>,
  type: string,
  traineeId: string | null,
): boolean {
  return pieces.some(
    (p) => p.type === type && p.traineeId === traineeId && p.annuleeAt === null && !p.estCopie,
  );
}

/**
 * Bilan d'un passage : ce qu'il y a à produire, et ce qui a été écarté —
 * COMPTÉ, pour que le journal du worker dise ce qu'il n'a pas fait (patron
 * des logs de `formation-crons` : un chiffre qui ne compte que ses succès ne
 * mesure rien).
 */
export interface BilanProduction {
  readonly productions: ProductionAFaire[];
  /** Écartées parce que la pertinence n'est pas « attendue » (G2). */
  readonly ecarteesParPertinence: number;
  /** Écartées parce que le jalon n'est pas atteint — dates nulles comprises (G1). */
  readonly ecarteesParJalon: number;
  /** Écartées parce qu'une pièce vivante non-copie existe déjà (G3). */
  readonly dejaPresentes: number;
  /** Nominatives omises faute de porteur (G4). */
  readonly sansPorteur: number;
}

/**
 * Les productions à faire MAINTENANT pour cet état de session.
 *
 * Déterministe et sans effet : deux appels sur le même état rendent la même
 * liste (G3). L'ordre de sortie suit `TYPES_AVEC_JALON` puis l'ordre des
 * inscriptions — stable, donc comparable entre deux passages.
 */
export function productionsAuJalon(
  instantane: InstantaneProduction,
  maintenant: Date,
): ProductionAFaire[] {
  return bilanProductionsAuJalon(instantane, maintenant).productions;
}

/** Même décision que `productionsAuJalon`, avec les écarts comptés. */
export function bilanProductionsAuJalon(
  instantane: InstantaneProduction,
  maintenant: Date,
): BilanProduction {
  const { session, enrollments, piecesExistantes } = instantane;

  let ecarteesParPertinence = 0;
  let ecarteesParJalon = 0;
  let dejaPresentes = 0;
  let sansPorteur = 0;
  const productions: ProductionAFaire[] = [];

  // Une session annulée ou reportée ne demande plus aucune pièce — la
  // production s'arrête, le registre garde ce qui existe (G1).
  if (STATUTS_SANS_PRODUCTION.has(session.statut)) {
    return { productions, ecarteesParPertinence, ecarteesParJalon, dejaPresentes, sansPorteur };
  }

  for (const type of TYPES_AVEC_JALON) {
    const jalon = jalonPour(type);

    // Les `jamais` ont leurs propres circuits (facturation, vente, kits) : un
    // humain y engage l'organisme — hors du périmètre de ce lot.
    if (jalon === "jamais") continue;

    // Hors lot pour une raison NOMMÉE (cf. la table) — jamais par oubli.
    if (TYPES_HORS_LOT_DOCUMENTS_AUTO.has(type)) continue;

    // 🔴 G1 — LE FAIL-OPEN DES DATES NULLES, FERMÉ. `pieceEstRemise` répond
    // « remis » quand les dates manquent (piece-remise.ts:169-176) : ce choix
    // protège l'AFFICHAGE d'une pièce qui existe, il ne doit jamais DÉCLENCHER
    // une production. Sans cette garde, une session non datée recevrait sa
    // feuille d'émargement et sa grille d'évaluation le jour de sa création.
    if (jalon !== "immediat" && session.dateDebut === null) {
      ecarteesParJalon++;
      continue;
    }

    // Le MOMENT : la même règle que le portail — une seule autorité (G1).
    const remise = pieceEstRemise(
      {
        type,
        sessionDateDebut: session.dateDebut,
        sessionDateFin: session.dateFin,
        sessionStatut: session.statut,
      },
      maintenant,
    );
    if (!remise) {
      ecarteesParJalon++;
      continue;
    }

    if (estNominative(type)) {
      // Pièce PAR personne : une production par inscription active, dans le
      // contexte de l'INSCRIPTION quand elle porte un override (R-INTER) —
      // sur une session entreprise, l'inscrit particulier autofinancé signe un
      // contrat, pas une convention (G2).
      for (const enrollment of enrollments) {
        const pertinence = pertinencePiece(type, {
          financement: enrollment.financementType ?? session.financementType,
          typeClient: enrollment.clientType ?? session.clientType,
          statut: session.statut,
          ...(session.formateurEstLeDirigeant !== undefined
            ? { formateurEstLeDirigeant: session.formateurEstLeDirigeant }
            : {}),
        });
        if (pertinence !== "attendue") {
          ecarteesParPertinence++;
          continue;
        }

        // G4 — une nominative sans porteur nommerait quelqu'un sans dire qui :
        // invisible de son destinataire, lisible de personne. Omise.
        if (enrollment.traineeId === null) {
          sansPorteur++;
          continue;
        }

        if (pieceVivanteExiste(piecesExistantes, type, enrollment.traineeId)) {
          dejaPresentes++;
          continue;
        }

        productions.push({
          type: type as DocumentType,
          traineeId: enrollment.traineeId,
          enrollmentId: enrollment.id,
          jalon,
        });
      }
    } else {
      // Pièce de SESSION : une seule, au contexte de la session (G2).
      const pertinence = pertinencePiece(type, {
        financement: session.financementType,
        typeClient: session.clientType,
        statut: session.statut,
        ...(session.formateurEstLeDirigeant !== undefined
          ? { formateurEstLeDirigeant: session.formateurEstLeDirigeant }
          : {}),
      });
      if (pertinence !== "attendue") {
        ecarteesParPertinence++;
        continue;
      }

      if (pieceVivanteExiste(piecesExistantes, type, null)) {
        dejaPresentes++;
        continue;
      }

      productions.push({ type: type as DocumentType, traineeId: null, enrollmentId: null, jalon });
    }
  }

  return { productions, ecarteesParPertinence, ecarteesParJalon, dejaPresentes, sansPorteur };
}
