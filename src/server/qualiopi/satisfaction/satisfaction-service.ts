/**
 * Qualiopi — Service questionnaires de satisfaction (AGENT A — T10).
 *
 * creerQuestionnaire         : upsert idempotent (enrollmentId×type), token via makeQrToken.
 * soumettreReponses          : met à jour reponses + noteGlobale + reponduAt.
 * listQuestionnairesSession  : liste tous les questionnaires d'une session.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", les mutations lèvent
 * et les lectures retournent des valeurs vides (safe au build SSG).
 */

import { prisma } from "@/lib/prisma";
import { creerOuDedup } from "@/server/qualiopi/alertes/alertes-service";
import { makeQrToken } from "@/server/qualiopi/documents/qr";
import { createEvaluation } from "@/server/qualiopi/evaluations/evaluations-service";
import { creerAppreciation } from "@/server/qualiopi/portail/appreciation-service";
import type { Questionnaire, QuestionnaireType } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type { QuestionnaireType };

export interface CreerQuestionnaireInput {
  enrollmentId: string;
  type: QuestionnaireType;
}

export interface SoumettreReponsesInput {
  token: string;
  reponses: Record<string, unknown>;
  noteGlobale?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerQuestionnaire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée ou récupère (upsert idempotent) un questionnaire pour une inscription × type.
 *
 * - Si le questionnaire existe déjà (même enrollmentId + type), retourne l'existant.
 * - Sinon, génère un token aléatoire et insère le questionnaire.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function creerQuestionnaire(
  input: CreerQuestionnaireInput,
): Promise<{ id: string; token: string }> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("creerQuestionnaire: stub DB — non disponible au build");
  }

  const token = makeQrToken();

  // upsert idempotent : si déjà existant, on ne touche PAS au token existant.
  // On utilise create/findUnique pour préserver le token original (upsert écrase).
  const existing = await prisma.questionnaire.findUnique({
    where: {
      enrollmentId_type: {
        enrollmentId: input.enrollmentId,
        type: input.type,
      },
    },
    select: { id: true, token: true },
  });

  if (existing !== null) {
    return { id: existing.id, token: existing.token };
  }

  const created = await prisma.questionnaire.create({
    data: {
      enrollmentId: input.enrollmentId,
      type: input.type,
      token,
    },
    select: { id: true, token: true },
  });

  return { id: created.id, token: created.token };
}

// ─────────────────────────────────────────────────────────────────────────────
// soumettreReponses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enregistre les réponses d'un stagiaire à son questionnaire (via token).
 *
 * - Valide noteGlobale ∈ [1..5] si fournie.
 * - Pose reponduAt = now() lors de la première soumission.
 * - Retourne null si le token est inconnu.
 *
 * Stub-aware : lève si DATABASE_URL contient "stub.invalid".
 */
export async function soumettreReponses(
  input: SoumettreReponsesInput,
): Promise<{ id: string } | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    throw new Error("soumettreReponses: stub DB — non disponible au build");
  }

  if (
    input.noteGlobale !== undefined &&
    (input.noteGlobale < 1 || input.noteGlobale > 5 || !Number.isInteger(input.noteGlobale))
  ) {
    throw new Error(
      `noteGlobale invalide : ${input.noteGlobale} — doit être un entier entre 1 et 5`,
    );
  }

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { token: input.token },
    select: {
      id: true,
      type: true,
      // `reponduAt` AVANT écriture : c'est lui qui distingue la première
      // soumission d'une re-soumission — le versement aux registres ne doit
      // avoir lieu qu'une fois.
      reponduAt: true,
      enrollment: {
        select: {
          id: true,
          traineeId: true,
          // Identité du ou de la stagiaire : uniquement pour rendre l'alerte de
          // positionnement tardif actionnable (« qui, quelle session »). Aucune
          // donnée sensible n'entre ici.
          trainee: { select: { prenom: true, nom: true } },
          // 🔴 `dateDebut` : c'est le repère qui manquait. Sans lui, la
          // transcription automatique datait l'évaluation « initiale » à
          // l'instant de la réponse — y compris après la fin de la formation.
          session: { select: { clientId: true, titreSession: true, dateDebut: true } },
        },
      },
    },
  });

  if (questionnaire === null) {
    return null;
  }

  const premiereSoumission = questionnaire.reponduAt === null;

  // Un SEUL instant pour l'horodatage et pour le versement : `reponduAt` en base
  // et la date de l'évaluation transcrite doivent désigner le même moment, pas
  // deux `new Date()` distants de quelques millisecondes.
  const dateReponse = new Date();

  const updated = await prisma.questionnaire.update({
    where: { id: questionnaire.id },
    data: {
      reponses: input.reponses as never,
      reponduAt: dateReponse,
      ...(input.noteGlobale !== undefined ? { noteGlobale: input.noteGlobale } : {}),
    },
    select: { id: true },
  });

  // ── Versement aux registres Qualiopi ────────────────────────────────────────
  //
  // 🔴 Constaté sur le premier dossier réel (Simone Blanc, 2026-08-04) : cette
  // fonction écrivait le questionnaire ET RIEN D'AUTRE. La stagiaire avait
  // répondu aux trois questionnaires, et les écrans de conformité affichaient
  // « 0 évaluation initiale » (off.8) et « 0 appréciation recueillie » (off.30)
  // — les registres que les indicateurs lisent ne recevaient rien. Il a fallu
  // TRANSCRIRE À LA MAIN, pièce par pièce. Neuvième et dixième occurrences du
  // motif dominant du dépôt : le code existe (`createEvaluation`,
  // `creerAppreciation`), personne ne l'appelait ici.
  //
  // Deux versements, à la PREMIÈRE soumission seulement :
  //
  // - positionnement → évaluation des acquis INITIALE, transcription de
  //   l'auto-évaluation `niveauParObjectif` (échelle 1..3, la même que la
  //   grille). La provenance est écrite dans `recommandations` : c'est un
  //   niveau DÉCLARÉ, pas mesuré, et l'auditeur doit pouvoir le lire.
  //   ⚠️ Versé UNIQUEMENT si la réponse précède le début de la session (au jour
  //   près) : cf. la garde chronologique dans `verserAuxRegistres`.
  // - satisfaction (chaud/froid) notée → appréciation source « stagiaire »,
  //   verbatim conservé tel quel.
  //
  // ⚠️ Fail-soft, et c'est voulu : la soumission de la stagiaire ne doit JAMAIS
  // échouer parce qu'un versement de registre a échoué — son questionnaire est
  // enregistré, c'est l'essentiel. Mais l'échec est journalisé BRUYAMMENT :
  // un versement silencieusement perdu recréerait exactement le trou qu'on
  // vient de payer.
  if (premiereSoumission) {
    try {
      const trainee = questionnaire.enrollment.trainee;
      const nomComplet = `${trainee?.prenom ?? ""} ${trainee?.nom ?? ""}`.trim();
      const sessionDuQuestionnaire = questionnaire.enrollment.session;

      await verserAuxRegistres({
        type: questionnaire.type,
        enrollmentId: questionnaire.enrollment.id,
        traineeId: questionnaire.enrollment.traineeId,
        clientId: sessionDuQuestionnaire?.clientId ?? null,
        reponses: input.reponses,
        dateReponse,
        dateDebutSession:
          sessionDuQuestionnaire?.dateDebut instanceof Date
            ? sessionDuQuestionnaire.dateDebut
            : null,
        stagiaire: nomComplet === "" ? "Le ou la stagiaire" : nomComplet,
        titreSession: sessionDuQuestionnaire?.titreSession ?? "sa session",
        ...(input.noteGlobale !== undefined ? { noteGlobale: input.noteGlobale } : {}),
      });
    } catch (err) {
      console.error(
        `[satisfaction-service] versement aux registres ÉCHOUÉ (questionnaire ${questionnaire.id}, type ${questionnaire.type}) — à transcrire manuellement :`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return { id: updated.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// verserAuxRegistres
// ─────────────────────────────────────────────────────────────────────────────

/** Barème du positionnement — le même que la grille d'évaluation (1..3). */
const NIVEAUX_VALIDES = new Set([1, 2, 3]);

/**
 * Début de la journée civile UTC, en millisecondes.
 *
 * Délibérément LOCAL et non importé d'`evaluations-service` : ce module est
 * mocké en bloc dans les tests de satisfaction, un helper importé de là y
 * arriverait `undefined`. La règle de fond n'est pas dupliquée pour autant —
 * `createEvaluation` la ré-applique et REFUSE l'écriture. Ce pré-contrôle ne
 * sert qu'à produire une alerte lisible plutôt qu'une exception brute.
 */
function jourUtcLocal(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** JJ/MM/AAAA en UTC — indépendant de la locale du serveur. */
function formaterJourLocal(d: Date): string {
  const jour = String(d.getUTCDate()).padStart(2, "0");
  const mois = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}/${d.getUTCFullYear()}`;
}

/**
 * Verse une réponse de questionnaire dans les registres que les indicateurs
 * lisent. Cf. le commentaire d'appel dans `soumettreReponses`.
 */
async function verserAuxRegistres(input: {
  type: QuestionnaireType;
  enrollmentId: string;
  traineeId: string | null;
  clientId: string | null;
  reponses: Record<string, unknown>;
  noteGlobale?: number;
  /** Instant de la réponse — le MÊME objet que le `reponduAt` écrit en base. */
  dateReponse: Date;
  /** Début de la session de l'inscription. `null` si illisible. */
  dateDebutSession: Date | null;
  /** Nom affichable du ou de la stagiaire (alerte actionnable). */
  stagiaire: string;
  /** Titre de la session (alerte actionnable). */
  titreSession: string;
}): Promise<void> {
  if (input.type === "positionnement") {
    const niveaux = input.reponses["niveauParObjectif"];
    if (typeof niveaux !== "object" || niveaux === null) return;

    // Seules les entrées au barème sont transcrites — une valeur hors 1..3
    // fausserait le score au lieu de l'éclairer.
    const competences = Object.entries(niveaux as Record<string, unknown>)
      .filter(([libelle, note]) => libelle.trim() !== "" && NIVEAUX_VALIDES.has(note as number))
      .map(([libelle, note]) => ({ libelle, note: note as 1 | 2 | 3 }));
    if (competences.length === 0) return;

    // ⚠️ JAMAIS deux initiales : si l'organisme en a déjà saisi une à la main,
    // la transcription automatique s'efface — la saisie humaine prime.
    const dejaUne = await prisma.evaluationAcquis.count({
      where: { enrollmentId: input.enrollmentId, type: "initiale" },
    });
    if (dejaUne > 0) return;

    // ── Chronologie : un « avant formation » ne se date pas après la formation ─
    //
    // 🔴 Audit blanc de certification 2026-08-15. C'est CE chemin qui a fabriqué
    // la non-conformité majeure de l'indicateur 4 : la stagiaire a répondu au
    // positionnement le 04/08, quatre jours après la clôture de sa session du
    // 31/07, et la transcription automatique datait l'évaluation « initiale » de
    // `new Date()` — l'instant de la soumission. Le dossier portait donc, sur une
    // seule capture d'écran, un « avant formation » postérieur à l'« après
    // formation ». Sans garde ici, le prochain stagiaire en retard régénérait
    // exactement la même anomalie.
    //
    // On NE fabrique PAS une preuve de complaisance (on ne recule pas la date à
    // la veille de la session : ce serait un faux). On ne verse rien, et on le
    // DIT — dans le journal serveur ET sur /qualiopi/a-traiter, la première page
    // ouverte le matin. Une absence assumée se rattrape devant un auditeur ;
    // une pièce fausse, non.
    if (input.dateDebutSession === null) {
      console.error(
        `[satisfaction-service] positionnement (inscription ${input.enrollmentId}) : ` +
          `début de session illisible — évaluation initiale NON versée, chronologie invérifiable.`,
      );
      return;
    }

    if (jourUtcLocal(input.dateReponse) > jourUtcLocal(input.dateDebutSession)) {
      const jourReponse = formaterJourLocal(input.dateReponse);
      const jourDebut = formaterJourLocal(input.dateDebutSession);

      console.warn(
        `[satisfaction-service] positionnement (inscription ${input.enrollmentId}) répondu le ` +
          `${jourReponse}, après le début de session du ${jourDebut} — évaluation initiale NON versée.`,
      );

      // Alerte console : `creerOuDedup` dédoublonne sur (code, cibleId) tant
      // qu'elle est ouverte, et ce code n'est pas en résolution automatique —
      // elle reste donc visible jusqu'à ce qu'un humain traite le dossier.
      await creerOuDedup({
        code: "positionnement_hors_delai",
        niveau: "important",
        titre: "Positionnement d'entrée répondu après le début de la session",
        message:
          `${input.stagiaire} a répondu au questionnaire de positionnement le ${jourReponse}, ` +
          `après le début de la session « ${input.titreSession} » du ${jourDebut}. Aucune évaluation ` +
          `initiale n'a été versée au dossier : une évaluation « avant formation » datée après la ` +
          `formation n'est pas une preuve recevable (indicateur 4). Recueillez le positionnement ` +
          `d'entrée par un autre moyen, ou notez au dossier qu'il n'a pas pu l'être.`,
        cibleType: "Enrollment",
        cibleId: input.enrollmentId,
        metadata: {
          repondu: input.dateReponse.toISOString(),
          debutSession: input.dateDebutSession.toISOString(),
        },
      });
      return;
    }

    await createEvaluation({
      enrollmentId: input.enrollmentId,
      type: "initiale",
      // La date de l'évaluation est celle de la RÉPONSE, pas un instant
      // recalculé : c'est ce que le dossier doit pouvoir démontrer.
      dateEvaluation: input.dateReponse.toISOString(),
      competences,
      recommandations:
        "Positionnement à l'entrée — transcription automatique de l'auto-évaluation déclarée par le ou la stagiaire dans le questionnaire de positionnement (niveau déclaré par objectif, à confirmer par le formateur).",
    });
    return;
  }

  // 🔴 Réponse du CONTACT CLIENT (page publique /enquete/[token]) : c'est la
  // 2ᵉ source distincte que l'indicateur 30 exige. Le répondant se nomme dans
  // le formulaire — son identité et sa fonction sont conservées au verbatim.
  if (input.type === "satisfaction_entreprise" && input.noteGlobale !== undefined) {
    const repondant =
      typeof input.reponses["repondantNom"] === "string" &&
      (input.reponses["repondantNom"] as string).trim() !== ""
        ? (input.reponses["repondantNom"] as string).trim()
        : null;
    const fonction =
      typeof input.reponses["repondantFonction"] === "string" &&
      (input.reponses["repondantFonction"] as string).trim() !== ""
        ? ` (${(input.reponses["repondantFonction"] as string).trim()})`
        : "";
    const verbatimEntreprise =
      typeof input.reponses["commentaire"] === "string" &&
      (input.reponses["commentaire"] as string).trim() !== ""
        ? ` Verbatim : « ${(input.reponses["commentaire"] as string).trim()} »`
        : "";

    await creerAppreciation({
      source: "entreprise",
      enrollmentId: input.enrollmentId,
      ...(input.clientId !== null ? { clientId: input.clientId } : {}),
      note: input.noteGlobale,
      commentaire: `Enquête entreprise — note ${input.noteGlobale}/5${repondant ? `, répondue par ${repondant}${fonction}` : ""}.${verbatimEntreprise}`,
      dateAppreciation: new Date(),
    });
    return;
  }

  if (
    (input.type === "satisfaction_chaud" || input.type === "satisfaction_froid") &&
    input.noteGlobale !== undefined
  ) {
    const libelle =
      input.type === "satisfaction_chaud"
        ? "Questionnaire de satisfaction à chaud"
        : "Questionnaire de satisfaction à froid";
    const verbatim =
      typeof input.reponses["commentaire"] === "string" &&
      (input.reponses["commentaire"] as string).trim() !== ""
        ? ` Verbatim : « ${(input.reponses["commentaire"] as string).trim()} »`
        : "";

    await creerAppreciation({
      source: "stagiaire",
      enrollmentId: input.enrollmentId,
      ...(input.traineeId !== null ? { traineeId: input.traineeId } : {}),
      ...(input.clientId !== null ? { clientId: input.clientId } : {}),
      note: input.noteGlobale,
      commentaire: `${libelle} — note ${input.noteGlobale}/5.${verbatim}`,
      dateAppreciation: new Date(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// listQuestionnairesSession
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste tous les questionnaires des inscriptions d'une session.
 * Retourne [] en mode stub.invalid.
 */
export async function listQuestionnairesSession(sessionId: string): Promise<Questionnaire[]> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return [];
  }

  return prisma.questionnaire.findMany({
    where: {
      enrollment: {
        sessionId,
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
