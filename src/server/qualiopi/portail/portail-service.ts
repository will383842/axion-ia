/**
 * Qualiopi — Service portail stagiaire (T14 — AGENT A).
 *
 * creerAcces         : génère un accès portail (token 64 hex, 90 j par défaut).
 * verifierToken      : vérification timing-safe → met à jour lastUsedAt.
 * revoquerAcces      : révoque un accès (revoked=true).
 * getEspaceStagiaire : retourne toutes les données visibles par le stagiaire.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", les mutations lèvent
 * et les lectures retournent des valeurs sécurisées (safe au build SSG).
 *
 * Règles non négociables :
 * - Token via randomBytes 32 (64 hex) — même primitives que makeQrToken.
 * - Le jeton est stocké HACHÉ (SHA-256 hex) : la base ne détient aucun secret
 *   rejouable. Le clair ne vit que dans le lien envoyé et le cookie (`D4-4-A`).
 * - Handicap décrit via decryptPii — JAMAIS en clair dans les retours.
 * - exactOptionalPropertyTypes respecté.
 */

import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { signedDocumentPdfUrl, TTL_LECTURE_NOMINATIVE_S } from "@/lib/r2-storage";
import { enqueueEmail } from "@/server/queue/queues";
import { normaliserObjectifsPedagogiques } from "@/server/qualiopi/formations/objectifs";
import { retenirPiecesParSessionEtType } from "./pieces-par-formation";
import { pieceEstRemise } from "./piece-remise";

/**
 * Les pièces COLLECTIVES : elles décrivent l'ACTION, pas une personne. Tout
 * inscrit de la session a le droit de les lire, et elles ne portent en base
 * aucun `traineeId`.
 */
export const TYPES_PIECES_COLLECTIVES_ESPACE_STAGIAIRE = [
  "programme",
  "reglement_interieur",
  "livret_accueil",
  "organisation_action",
] as const;

/**
 * 🔴 Les pièces NOMINATIVES : elles portent le NOM et l'EMPLOYEUR d'une seule
 * personne, et `documents_generes.trainee_id` dit laquelle — la convocation et
 * l'autorisation de captation sont établies par stagiaire, à dessein (« un
 * consentement est individuel »).
 *
 * La distinction n'est pas cosmétique : la lecture de l'espace part de la
 * SESSION, et la session ne connaît pas de destinataire. Sans elle, le filtre de
 * type laissait entrer les pièces de tous les inscrits ; la déduplication
 * (session, type) en gardait alors UNE, la plus récente, et la servait à tout le
 * monde. En inter-entreprises les participants sont des concurrents (même
 * doctrine que `emargement/portail-queries.ts`), et la `pdfUrl` est re-signée
 * 24 h à chaque lecture : la pièce d'autrui était réellement téléchargeable.
 */
export const TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE = [
  "convocation",
  "autorisation_captation",
] as const;

/**
 * Les types de pièces que l'ESPACE STAGIAIRE remonte (Lot 1ter).
 *
 * ⚠️ Vue plus étroite que `TYPES_REMIS_AU_BENEFICIAIRE`, qui est l'autorité :
 * attestations, certificats et grilles en sont exclus parce qu'ils ont leur
 * PROPRE bloc dans cet espace — les remonter ici les afficherait deux fois.
 * `piece-remise.spec.ts` garantit que cette liste reste un sous-ensemble : plus
 * stricte, jamais plus large.
 *
 * ⚠️ La liste dit QUELS types peuvent apparaître ; elle ne dit RIEN de qui les
 * voit. La requête, elle, doit trancher les deux — cf. le `where` ci-dessous.
 */
export const TYPES_PIECES_ESPACE_STAGIAIRE = [
  ...TYPES_PIECES_COLLECTIVES_ESPACE_STAGIAIRE,
  ...TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE,
] as const;
import type {
  EnrollmentStatut,
  DocumentType,
  QuestionnaireType,
} from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface CreerAccesResult {
  id: string;
  token: string;
  expiresAt: Date;
}

/** Résumé d'une formation (session) visible dans l'espace stagiaire. */
export interface FormationResume {
  titre: string;
  dateDebut: Date;
  dateFin: Date;
  statut: EnrollmentStatut;
}

/** Résumé d'une attestation/certificat visible dans l'espace stagiaire. */
export interface AttestationResume {
  type: DocumentType;
  numero: string;
  pdfUrl: string | null;
  qrToken: string | null;
}

/** Résumé d'un questionnaire visible dans l'espace stagiaire. */
export interface QuestionnaireResume {
  type: QuestionnaireType;
  token: string;
  reponduAt: Date | null;
  /** Titre de la session rattachée — affiché en tête du questionnaire. */
  sessionTitre: string;
  /**
   * Dates et statut de la session — nécessaires pour décider À QUEL MOMENT le
   * questionnaire est proposé (cf. `questionnaire-moment.ts`). Sans elles, le
   * portail proposait « votre retour à chaud » la veille de la formation.
   */
  sessionDateDebut: Date | null;
  sessionDateFin: Date | null;
  sessionStatut: string | null;
  /**
   * Objectifs pédagogiques de la formation. Le questionnaire de POSITIONNEMENT
   * demande au bénéficiaire de s'auto-évaluer sur chacun : c'est ce qui en fait
   * une évaluation des acquis à l'entrée (off.8) et non un simple déclaratif,
   * et ce qui rend la progression mesurable face à l'évaluation finale.
   */
  objectifs: string[];
}

/** Espace stagiaire complet retourné par getEspaceStagiaire. */
/** Pièce d'information mise à disposition du stagiaire sur son espace. */
export interface PieceRemise {
  type: string;
  numero: string;
  /** URL re-signée à CHAQUE lecture — jamais la valeur stockée (expire en 900 s). */
  pdfUrl: string | null;
  remiseLe: Date;
  /**
   * Formation à laquelle la pièce se rattache.
   *
   * 🔴 Ajouté le 16/08/2026. Sans lui, l'espace listait les pièces à plat, et
   * la déduplication se faisait par TYPE toutes sessions confondues : à deux
   * formations, la convocation de l'une masquait celle de l'autre. Une pièce
   * sans son dossier n'est pas classable — ni par le stagiaire, ni par nous.
   */
  sessionId: string | null;
  sessionTitre: string;
}

export interface EspaceStagiaire {
  trainee: {
    prenom: string;
    nom: string;
  };
  formations: FormationResume[];
  attestations: AttestationResume[];
  questionnaires: QuestionnaireResume[];
  /**
   * Pièces d'information remises au stagiaire : programme, règlement intérieur,
   * livret d'accueil, convocation.
   *
   * 🔴 Audit pré-visite 2026-08-03. La convocation annonce noir sur blanc :
   * « Les documents suivants vous sont transmis avec cette convocation :
   * programme, règlement intérieur, livret d'accueil, questionnaire de
   * positionnement ». Or l'e-mail n'envoie aucune pièce jointe — il envoie un
   * lien vers ce portail — et le portail n'exposait que les attestations et les
   * questionnaires. **Le programme et le livret d'accueil n'étaient délivrés
   * nulle part.**
   *
   * L'organisme annonçait donc transmettre des pièces qu'il ne transmettait pas.
   * C'est l'indicateur 9 (information sur les conditions de déroulement), et
   * c'est ce qu'un auditeur vérifie en demandant au stagiaire ce qu'il a reçu.
   */
  pieces: PieceRemise[];
  /** Situation handicap (champ clair après décryptage, null si non renseigné). */
  situationHandicap: {
    declaree: boolean;
    details: string | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Parcours à blanc 2026-07-27. Cette normalisation locale essayait
 * `objectif | libelle | label | titre` — mais PAS `description`, la clé
 * qu'écrit l'import du catalogue. Le `filter` renvoyait donc une liste vide :
 * le portail stagiaire n'affichait aucun objectif pédagogique pour les
 * 22 formations du catalogue, sans erreur ni trace.
 *
 * Remplacée par la normalisation partagée, qui couvre les deux familles de
 * formes. Voir `@/server/qualiopi/formations/objectifs`.
 */
const normaliserObjectifs = normaliserObjectifsPedagogiques;

/** Génère un token portail : 32 bytes → 64 chars hex. */
function genererTokenPortail(): string {
  return randomBytes(32).toString("hex");
}

/**
 * SHA-256 hex du jeton — ce qui est stocké, jamais le clair.
 *
 * 🔴 2026-08-19 (`D4-4-A`). Ce module comparait auparavant le clair reçu au
 * clair stocké avec `timingSafeEqual`. Cette comparaison était DÉCORATIVE : la
 * ligne venait d'être retrouvée par `findUnique({ where: { token } })`, donc
 * par égalité exacte du jeton — elle ne pouvait que réussir. Une précaution
 * contre les attaques temporelles posée APRÈS une recherche par égalité ne
 * protège de rien, et sa présence donnait à lire une table de jetons en clair
 * comme si elle était défendue.
 *
 * La vraie défense est ici : la base ne détient plus de secret utilisable.
 */
function hacherToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// creerAcces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un accès portail pour un stagiaire.
 *
 * - Génère un token aléatoire (64 hex) valable `joursValidite` jours (défaut 90).
 * - N'invalide PAS les accès précédents (plusieurs accès actifs possibles, la
 *   révocation est explicite via `revoquerAcces`).
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function creerAcces(traineeId: string, joursValidite = 90): Promise<CreerAccesResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerAcces: stub DB — non disponible au build");
  }

  const token = genererTokenPortail();
  const expiresAt = new Date(Date.now() + joursValidite * 24 * 60 * 60 * 1000);

  const acces = await prisma.portailAcces.create({
    data: {
      traineeId,
      tokenHash: hacherToken(token),
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });

  // ⚠️ Le CLAIR est rendu ici, et nulle part ailleurs : c'est la seule et
  // dernière occasion de le connaître. Rendre le hachage ferait partir des
  // liens qui rendraient 404 à l'ouverture, sans que rien ne l'indique côté
  // organisme — la panne serait entièrement chez le stagiaire.
  return { id: acces.id, token, expiresAt: acces.expiresAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// demanderAccesParEmail (self-service — re-demande d'un lien d'accès)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-demande self-service d'un lien d'accès portail par email (token expiré/perdu).
 *
 * - Anti-énumération : SILENCIEUX si aucun stagiaire ne correspond (l'appelant
 *   retourne toujours le même message générique).
 * - Si un stagiaire correspond : crée un nouvel accès (90 j) et lui envoie le
 *   lien par email (`qualiopi-portail-acces`).
 * - Le rate-limiting est fait EN AMONT dans l'action (par IP), pas ici.
 *
 * Stub-aware : ne fait rien si DATABASE_URL contient "stub.invalid".
 */
export async function demanderAccesParEmail(email: string): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const trainee = await prisma.trainee.findFirst({
    where: { email: normalized, deletedAt: null },
    select: { id: true, prenom: true, nom: true },
  });
  if (!trainee) return; // silencieux — anti-énumération

  const { token } = await creerAcces(trainee.id);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const lienPortail = `${baseUrl}/fr/portail/acces/${token}`;

  await enqueueEmail("qualiopi-portail-acces", normalized, "fr", {
    stagiairePrenomNom: `${trainee.prenom} ${trainee.nom}`.trim(),
    lienPortail,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// verifierToken
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie un token portail (timing-safe) et retourne le traineeId si valide.
 *
 * - Retourne null si token inconnu, révoqué ou expiré.
 * - Met à jour `lastUsedAt` sur vérification réussie.
 *
 * Stub-aware : retourne null si DATABASE_URL contient "stub.invalid".
 */
export async function verifierToken(token: string): Promise<{ traineeId: string } | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return null;
  }

  // La recherche se fait par le HASH : la base ne contient plus le secret, et
  // un porteur de dump n'y trouve rien de rejouable.
  const acces = await prisma.portailAcces.findUnique({
    where: { tokenHash: hacherToken(token) },
    select: { id: true, traineeId: true, expiresAt: true, revoked: true },
  });

  if (acces === null) return null;
  if (acces.revoked) return null;
  if (acces.expiresAt < new Date()) return null;

  // Mise à jour lastUsedAt (fire-and-forget : ne bloque pas la réponse)
  void prisma.portailAcces.update({
    where: { id: acces.id },
    data: { lastUsedAt: new Date() },
  });

  return { traineeId: acces.traineeId };
}

// ─────────────────────────────────────────────────────────────────────────────
// revoquerAcces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Révoque un accès portail par son id.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function revoquerAcces(id: string): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("revoquerAcces: stub DB — non disponible au build");
  }

  await prisma.portailAcces.update({
    where: { id },
    data: { revoked: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getEspaceStagiaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne l'espace stagiaire complet pour affichage dans le portail.
 *
 * - Inclut : identité, formations, attestations, questionnaires, situation handicap.
 * - Le détail handicap est déchiffré via `decryptPii` (jamais en clair en DB).
 * - Retourne un espace vide si DATABASE_URL contient "stub.invalid".
 *
 * Lève si le stagiaire est introuvable (considéré supprimé/inexistant).
 */
export async function getEspaceStagiaire(traineeId: string): Promise<EspaceStagiaire> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return {
      trainee: { prenom: "", nom: "" },
      formations: [],
      attestations: [],
      questionnaires: [],
      pieces: [],
      situationHandicap: { declaree: false, details: null },
    };
  }

  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    select: {
      prenom: true,
      nom: true,
      situationHandicap: true,
      handicapDetailsChiffre: true,
      enrollments: {
        select: {
          statut: true,
          attestationDocument: {
            select: {
              type: true,
              numero: true,
              pdfUrl: true,
              qrToken: true,
              createdAt: true,
            },
          },
          questionnaires: {
            select: {
              type: true,
              token: true,
              reponduAt: true,
            },
          },
          session: {
            select: {
              id: true,
              titreSession: true,
              dateDebut: true,
              dateFin: true,
              statut: true,
              formation: { select: { objectifsPedagogiques: true } },
              // Pièces d'information de la session — ni facture, ni kit
              // financeur, ni pièce de preuve interne.
              //
              // ⚠️ Cette liste est une VUE, plus étroite que l'autorité : elle
              // exclut délibérément les attestations et certificats, qui ont
              // leur propre bloc dans cet espace — les remonter ici les
              // afficherait deux fois. Un test garantit qu'elle reste un
              // SOUS-ENSEMBLE de `TYPES_REMIS_AU_BENEFICIAIRE` : elle peut être
              // plus stricte, jamais plus large.
              //
              // 🔴 `organisation_action` et `autorisation_captation` s'y
              // ajoutent (Lot 1ter) : la première sert l'indicateur 9
              // (information du bénéficiaire — « QUAND, OÙ et COMMENT »), la
              // seconde est un consentement que le stagiaire doit pouvoir lire
              // avant de le donner.
              //
              // 🔴 Le filtre porte sur le TYPE **et sur le DESTINATAIRE**. La
              // lecture part de la session, qui ne connaît aucun bénéficiaire :
              // filtrée par le seul type, elle remontait les pièces nominatives
              // de TOUS les inscrits, et la déduplication (session, type) en
              // servait une seule — la plus récente — à chacun d'eux.
              //
              // ⚠️ Les pièces nominatives exigent l'ÉGALITÉ stricte, jamais
              // `traineeId: null` en repli. Les convocations produites avant le
              // 21/07/2026 (`genererConvocationAction` ne renseignait pas encore
              // `refs.traineeId`) nomment quelqu'un sans dire qui : rien dans la
              // ligne ne permet de les rattacher. Elles cessent donc d'être
              // visibles — de leur destinataire compris.
              //
              // C'est un choix ASSUMÉ, et il faut le lire comme tel : un
              // stagiaire dont la convocation n'est pas rattachée ne verra plus
              // rien à cette ligne, au lieu de voir celle d'un autre. Ne pas
              // montrer se rattrape en régénérant la pièce ; avoir montré le nom
              // et l'employeur d'un concurrent ne se rattrape pas.
              documents: {
                where: {
                  OR: [
                    { type: { in: [...TYPES_PIECES_COLLECTIVES_ESPACE_STAGIAIRE] } },
                    { type: { in: [...TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE] }, traineeId },
                  ],
                },
                select: {
                  id: true,
                  type: true,
                  numero: true,
                  pdfUrl: true,
                  qrToken: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (trainee === null) {
    throw new Error(`getEspaceStagiaire: stagiaire introuvable (id=${traineeId})`);
  }

  const formations: FormationResume[] = trainee.enrollments.map((e) => ({
    titre: e.session.titreSession,
    dateDebut: e.session.dateDebut,
    dateFin: e.session.dateFin,
    statut: e.statut,
  }));

  const attestations: AttestationResume[] = await Promise.all(
    trainee.enrollments
      .flatMap((e) => (e.attestationDocument ? [e.attestationDocument] : []))
      .map(async (doc) => {
        // 🔴 URL signée FRAÎCHE à la lecture : la `pdfUrl` stockée a été signée
        // à la génération, elle est donc morte 900 s plus tard.
        //
        // ⚠️ 2026-08-19 (`D4-4-C`) — cette signature durait 24 h, au motif
        // d'« éviter les liens expirés ». Le motif confondait deux choses : le
        // lien STOCKÉ est périmé parce qu'il est vieux, celui-ci est signé à
        // l'instant du rendu et n'a qu'à survivre au clic. Vingt-quatre heures
        // de droit de lecture ANONYME sur une pièce nominative, pour un lien
        // cliqué dans la minute.
        let pdfUrl: string | null = doc.pdfUrl ?? null;
        try {
          pdfUrl = (await signedDocumentPdfUrl(doc, TTL_LECTURE_NOMINATIVE_S)) ?? pdfUrl;
        } catch {
          // Fail-soft : on garde pdfUrl DB (peut être expirée mais vaut mieux
          // qu'une erreur bloquante).
        }
        return {
          type: doc.type,
          numero: doc.numero,
          pdfUrl,
          qrToken: doc.qrToken ?? null,
        };
      }),
  );

  // On repart de l'inscription (et non des seuls questionnaires) pour rattacher a
  // chacun le titre de sa session et les objectifs de sa formation — necessaires au
  // questionnaire de POSITIONNEMENT (off.8).
  const questionnaires: QuestionnaireResume[] = trainee.enrollments.flatMap((e) => {
    const objectifs = normaliserObjectifs(e.session?.formation?.objectifsPedagogiques);
    return e.questionnaires.map((q) => ({
      type: q.type,
      token: q.token,
      reponduAt: q.reponduAt ?? null,
      sessionTitre: e.session?.titreSession ?? "",
      sessionDateDebut: e.session?.dateDebut ?? null,
      sessionDateFin: e.session?.dateFin ?? null,
      sessionStatut: e.session?.statut ?? null,
      objectifs,
    }));
  });

  // Une seule pièce par TYPE, la plus récente : les régénérations créent des
  // doublons (le dossier INVEST SUN en portait deux de chaque), et présenter au
  // stagiaire deux règlements intérieurs de dates différentes est pire que n'en
  // présenter aucun.
  // 🔴 Clé = SESSION + TYPE, et non le type seul (correctif du 16/08/2026).
  //
  // La déduplication portait sur le type toutes sessions confondues, avec le
  // premier arrivé gagnant. Le raisonnement d'origine — « présenter deux
  // règlements intérieurs de dates différentes est pire que n'en présenter
  // aucun » — est juste POUR UN STAGIAIRE À UNE SESSION, et devient faux à
  // deux : la convocation d'une formation masquait celle de l'autre, sans que
  // l'ordre soit garanti. Cas réel : une stagiaire inscrite à deux sessions.
  //
  // On garde la déduplication là où elle protège (deux règlements intérieurs
  // d'une MÊME session), et on la retire là où elle efface (deux formations).
  // La plus récente l'emporte, comme l'annonçait déjà le commentaire d'origine.
  const piecesRetenues = retenirPiecesParSessionEtType(
    trainee.enrollments.map((e) => ({
      sessionId: e.session?.id ?? null,
      sessionTitre: e.session?.titreSession ?? "",
      documents: e.session?.documents ?? [],
    })),
  );

  // Lot 1ter — le calendrier, gardé à part plutôt qu'enfilé dans le
  // regroupeur : celui-ci ne fait qu'un regroupement par (session, type), et
  // lui ajouter des champs dont il n'a pas besoin élargirait son contrat pour
  // le confort d'un seul appelant.
  const calendrierParSession = new Map<
    string,
    { debut: Date | null; fin: Date | null; statut: string | null }
  >();
  for (const e of trainee.enrollments) {
    if (e.session?.id == null) continue;
    calendrierParSession.set(e.session.id, {
      debut: e.session.dateDebut ?? null,
      fin: e.session.dateFin ?? null,
      statut: e.session.statut ?? null,
    });
  }

  // 🔴 Lot 1ter — « produire ≠ remettre ». La requête dit QUELS types peuvent
  // apparaître ; cette règle dit QUAND. Sans elle, le jour où les six pièces
  // standard seront produites à la création de la session, le stagiaire les
  // verrait TOUTES — c'est le défaut du 16/08 sur les questionnaires, transposé
  // aux documents. La règle existe donc AVANT la génération automatique.
  const maintenant = new Date();
  const piecesRemises = piecesRetenues.filter(({ doc, sessionId }) => {
    const cal = sessionId != null ? calendrierParSession.get(sessionId) : undefined;
    return pieceEstRemise(
      {
        type: doc.type,
        sessionDateDebut: cal?.debut ?? null,
        sessionDateFin: cal?.fin ?? null,
        sessionStatut: cal?.statut ?? null,
      },
      maintenant,
    );
  });

  const pieces: PieceRemise[] = await Promise.all(
    piecesRemises.map(async ({ doc, sessionId, sessionTitre }) => {
      // Même règle que les attestations : URL re-signée 24 h à CHAQUE lecture.
      // La `pdfUrl` stockée expire en 900 s — la servir telle quelle donnerait
      // un lien mort au stagiaire. On re-signe donc, pour la durée du clic et
      // pas pour la journée (`D4-4-C`).
      let pdfUrl: string | null = doc.pdfUrl ?? null;
      try {
        pdfUrl = (await signedDocumentPdfUrl(doc, TTL_LECTURE_NOMINATIVE_S)) ?? pdfUrl;
      } catch {
        // Fail-soft : mieux vaut un lien peut-être expiré qu'un espace en erreur.
      }
      return {
        type: doc.type,
        numero: doc.numero,
        pdfUrl,
        remiseLe: doc.createdAt,
        sessionId,
        sessionTitre,
      };
    }),
  );

  const detailsChiffre = trainee.handicapDetailsChiffre ?? null;
  const details = detailsChiffre !== null ? decryptPii(detailsChiffre) : null;

  return {
    trainee: { prenom: trainee.prenom, nom: trainee.nom },
    formations,
    attestations,
    questionnaires,
    pieces,
    situationHandicap: {
      declaree: trainee.situationHandicap,
      details,
    },
  };
}
