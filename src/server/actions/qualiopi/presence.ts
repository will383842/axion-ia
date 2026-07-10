/**
 * Qualiopi — Server Actions Émargement + Relevé de connexion (T8).
 *
 * generateSessionCreneauxAction  : génère les créneaux présentiel pour tous
 *                                   les inscrits actifs d'une session (idempotent).
 * saveEmargementAction           : upsert émargement + recompute taux.
 * importReleveConnexionAction    : parse CSV Zoom/Teams/Meet + match inscrits
 *                                   + archive R2 + crée ReleveConnexionImport
 *                                   + créneaux distanciels + recompute taux.
 * setPresenceCreneauManualAction : correction manuelle d'un créneau + recompute.
 *
 * Pattern EXACT de `src/server/actions/qualiopi/enrollments.ts` :
 *   requireAdminWrite() + Zod safeParse + ActionResult<T> + logQualiopiActivity.
 */

"use server";

import { createHash } from "node:crypto";
import React from "react";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import { genererCreneaux } from "@/server/qualiopi/presence/creneaux";
import { parseReleveConnexion } from "@/server/qualiopi/presence/parse-releve";
import { matchParticipants } from "@/server/qualiopi/presence/match";
import { parisDateISO, formatMinutesToHHhMM } from "@/server/qualiopi/presence/time";
import { upsertCreneau, recomputeTauxPresence } from "@/server/qualiopi/presence/presence-service";
import { storeAndSignCsv } from "@/server/qualiopi/documents/render";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { ReleveConnexionPdf } from "@/server/qualiopi/documents/templates/releve-connexion";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import type { DemiJourneeLabel, PlateformeLabel } from "@/server/qualiopi/presence/types";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Mapping label → enum Prisma
// ─────────────────────────────────────────────────────────────────────────────

/** Convertit DemiJourneeLabel → DemiJournee Prisma. */
function toDemiJourneeEnum(dj: DemiJourneeLabel): "matin" | "apres_midi" | "journee" {
  return dj;
}

/** Convertit PlateformeLabel → PresenceSource Prisma. */
function toPresenceSource(
  plateforme: PlateformeLabel,
): "import_zoom" | "import_teams" | "import_meet" | "emargement_presentiel" {
  const map: Record<
    PlateformeLabel,
    "import_zoom" | "import_teams" | "import_meet" | "emargement_presentiel"
  > = {
    zoom: "import_zoom",
    teams: "import_teams",
    meet: "import_meet",
    autre: "emargement_presentiel",
  };
  return map[plateforme];
}

/** Convertit PlateformeLabel → PlateformeDistanciel Prisma. */
function toPlateformeDistancielEnum(
  plateforme: PlateformeLabel,
): "zoom" | "teams" | "meet" | "autre" {
  return plateforme;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const DEMI_JOURNEE_VALUES = ["matin", "apres_midi", "journee"] as const;
const PLATEFORME_VALUES = ["zoom", "teams", "meet", "autre"] as const;

const generateSessionCreneauxSchema = z.object({
  sessionId: z.string().uuid(),
  heuresParJour: z.number().int().min(1).max(12).optional(),
});

const emargementEntrySchema = z.object({
  enrollmentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)"),
  demiJournee: z.enum(DEMI_JOURNEE_VALUES),
  present: z.boolean(),
  dureeRealiseeMinutes: z.number().int().min(0).optional(),
});

const saveEmargementSchema = z.object({
  sessionId: z.string().uuid(),
  entries: z.array(emargementEntrySchema).min(1),
});

const importReleveConnexionSchema = z.object({
  sessionId: z.string().uuid(),
  plateforme: z.enum(PLATEFORME_VALUES),
  fileName: z.string().min(1).max(255),
  content: z.string().min(1),
});

const setPresenceCreneauManualSchema = z.object({
  creneauId: z.string().uuid(),
  present: z.boolean(),
  dureeRealiseeMinutes: z.number().int().min(0),
  commentaire: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Action 1 — Générer les créneaux présentiel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un créneau de présence présentiel par (enrollment × demi-journée)
 * pour tous les inscrits actifs de la session.
 *
 * Idempotent : si les créneaux existent déjà (upsert), retourne created=0.
 */
export async function generateSessionCreneauxAction(input: {
  sessionId: string;
  heuresParJour?: number;
}): Promise<ActionResult<{ created: number }>> {
  const session = await requireAdminWrite();
  const parsed = generateSessionCreneauxSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Lecture de la session.
  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: v.sessionId },
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      dureeReelleHeures: true,
      enrollments: {
        where: {
          statut: { notIn: ["abandon", "exclu"] },
        },
        select: { id: true },
      },
    },
  });

  if (!trainingSession) return { error: "Session introuvable" };

  const heuresParJour = v.heuresParJour ?? trainingSession.dureeReelleHeures ?? 7;

  // Génération des créneaux via logique pure AGENT A.
  const creneaux = genererCreneaux({
    dateDebut: trainingSession.dateDebut,
    dateFin: trainingSession.dateFin,
    heuresParJour,
  });

  if (creneaux.length === 0) return { error: "Aucun créneau généré (dates invalides)" };

  let created = 0;

  // Upsert de chaque créneau pour chaque enrollment.
  for (const enrollment of trainingSession.enrollments) {
    for (const creneau of creneaux) {
      // Date ISO Paris → Date UTC pour la colonne @db.Date (date civile).
      const dateObj = new Date(`${creneau.date}T00:00:00+00:00`);

      const existingId = await prisma.presenceCreneau.findUnique({
        where: {
          enrollmentId_date_demiJournee: {
            enrollmentId: enrollment.id,
            date: dateObj,
            demiJournee: toDemiJourneeEnum(creneau.demiJournee),
          },
        },
        select: { id: true },
      });

      if (!existingId) {
        await upsertCreneau({
          enrollmentId: enrollment.id,
          date: dateObj,
          demiJournee: toDemiJourneeEnum(creneau.demiJournee),
          libelle: creneau.libelle,
          dureePrevueMinutes: creneau.dureePrevueMinutes,
          source: "emargement_presentiel",
          present: false,
          dureeRealiseeMinutes: 0,
        });
        created++;
      }
    }
  }

  await logQualiopiActivity({
    action: "qualiopi.presence.creneaux.generate",
    targetType: "TrainingSession",
    targetId: v.sessionId,
    changes: {
      nbCreneaux: creneaux.length,
      nbEnrollments: trainingSession.enrollments.length,
      created,
    },
    session,
  });

  return { data: { created } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action 2 — Sauvegarder l'émargement présentiel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert les entrées d'émargement présentiel (présent/absent + durée),
 * recompute le taux pour chaque enrollment touché, set emargementSigneAt.
 */
export async function saveEmargementAction(input: {
  sessionId: string;
  entries: Array<{
    enrollmentId: string;
    date: string;
    demiJournee: DemiJourneeLabel;
    present: boolean;
    dureeRealiseeMinutes?: number;
  }>;
}): Promise<ActionResult<{ updated: number }>> {
  const session = await requireAdminWrite();
  const parsed = saveEmargementSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Vérification session.
  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: v.sessionId },
    select: { id: true },
  });
  if (!trainingSession) return { error: "Session introuvable" };

  const enrollmentIds = new Set(v.entries.map((e) => e.enrollmentId));

  // Pour chaque entrée, on a besoin de la dureePrevue du créneau existant
  // afin de remplir dureeRealiseeMinutes si absent.
  let updated = 0;

  for (const entry of v.entries) {
    const dateObj = new Date(`${entry.date}T00:00:00+00:00`);

    // Lecture du créneau existant pour récupérer dureePrevueMinutes.
    const existingCreneau = await prisma.presenceCreneau.findUnique({
      where: {
        enrollmentId_date_demiJournee: {
          enrollmentId: entry.enrollmentId,
          date: dateObj,
          demiJournee: toDemiJourneeEnum(entry.demiJournee),
        },
      },
      select: { id: true, dureePrevueMinutes: true },
    });

    // Durée réalisée : si présent et non fournie → dureePrevue du créneau.
    let dureeRealiseeMinutes = entry.dureeRealiseeMinutes ?? 0;
    if (entry.present && entry.dureeRealiseeMinutes === undefined) {
      dureeRealiseeMinutes = existingCreneau?.dureePrevueMinutes ?? 0;
    }

    // libelle reconstruit pour l'upsert.
    const libelle = `${entry.date} ${entry.demiJournee === "apres_midi" ? "après-midi" : entry.demiJournee}`;

    await upsertCreneau({
      enrollmentId: entry.enrollmentId,
      date: dateObj,
      demiJournee: toDemiJourneeEnum(entry.demiJournee),
      libelle,
      dureePrevueMinutes: existingCreneau?.dureePrevueMinutes ?? dureeRealiseeMinutes,
      source: "emargement_presentiel",
      present: entry.present,
      dureeRealiseeMinutes,
    });
    updated++;
  }

  // Recompute taux + set emargementSigneAt pour chaque enrollment touché.
  const now = new Date();
  for (const enrollmentId of enrollmentIds) {
    await recomputeTauxPresence(enrollmentId);
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { emargementSigneAt: now },
    });
  }

  await logQualiopiActivity({
    action: "qualiopi.presence.emargement.save",
    targetType: "TrainingSession",
    targetId: v.sessionId,
    changes: { updated, nbEnrollmentsTouches: enrollmentIds.size },
    session,
  });

  return { data: { updated } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action 3 — Import relevé de connexion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse le CSV de présence Zoom/Teams/Meet, rapproche les participants des
 * inscrits, archive le fichier dans R2, crée un `ReleveConnexionImport` et les
 * créneaux distanciels correspondants, puis recompute les taux.
 */
export async function importReleveConnexionAction(input: {
  sessionId: string;
  plateforme: PlateformeLabel;
  fileName: string;
  content: string;
}): Promise<
  ActionResult<{
    importId: string;
    nbMatched: number;
    nbUnmatched: number;
    unmatched: Array<{ nom: string; email: string | null; dureeMinutes: number }>;
  }>
> {
  const session = await requireAdminWrite();
  const parsed = importReleveConnexionSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Lecture de la session + enrollments (avec email/nom/prenom du stagiaire).
  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: v.sessionId },
    select: {
      id: true,
      dateDebut: true,
      dureeReelleHeures: true,
      enrollments: {
        where: { statut: { notIn: ["abandon", "exclu"] } },
        select: {
          id: true,
          trainee: {
            select: {
              email: true,
              nom: true,
              prenom: true,
            },
          },
        },
      },
    },
  });

  if (!trainingSession) return { error: "Session introuvable" };

  // 1. Parse du CSV.
  const parsedReleve = parseReleveConnexion(v.content, v.plateforme);

  // 2. Mise en correspondance participants ↔ inscrits.
  const matchInputs = trainingSession.enrollments.map((e) => ({
    enrollmentId: e.id,
    email: e.trainee.email,
    nom: e.trainee.nom,
    prenom: e.trainee.prenom,
  }));

  const { matched, unmatched } = matchParticipants(parsedReleve.participants, matchInputs);

  // 3. Hash SHA-256 du contenu brut.
  const hashSha256 = createHash("sha256").update(v.content, "utf8").digest("hex");

  // 4. Archive CSV dans R2 (fail-soft).
  const csvKey = `presence/${new Date().getFullYear()}/${v.sessionId}/${hashSha256.slice(0, 12)}-${v.fileName}`;
  const storedPath = await storeAndSignCsv(v.content, csvKey);

  // 5. Création de ReleveConnexionImport.
  const releveImport = await prisma.releveConnexionImport.create({
    data: {
      sessionId: v.sessionId,
      plateforme: toPlateformeDistancielEnum(v.plateforme),
      fichierOriginalNom: v.fileName.slice(0, 255),
      ...(storedPath !== null ? { fichierOriginalPath: storedPath } : {}),
      hashSha256,
      nbLignes: parsedReleve.nbLignes,
      nbMatched: matched.length,
      nbUnmatched: unmatched.length,
      unmatched: unmatched.map((u) => ({
        nom: u.nomBrut,
        email: u.email,
        dureeMinutes: u.dureeMinutes,
      })) as never,
      meta: parsedReleve.meta as never,
      importeParId: session.userId,
    },
    select: { id: true },
  });

  // 6. Durée prévue par créneau distanciel.
  const dureePrevueMinutes = (trainingSession.dureeReelleHeures ?? 7) * 60;

  // Date civile Paris de dateDebut.
  const dateCivile = parisDateISO(trainingSession.dateDebut);
  const dateObj = new Date(`${dateCivile}T00:00:00+00:00`);
  const libelle = `${dateCivile} journée`;

  // 7. Création des créneaux distanciels pour les participants matchés.
  const matchedEnrollmentIds = new Set<string>();

  for (const { enrollmentId, participant } of matched) {
    await upsertCreneau({
      enrollmentId,
      date: dateObj,
      demiJournee: "journee",
      libelle,
      dureePrevueMinutes,
      source: toPresenceSource(v.plateforme),
      present: false, // sera mis à jour par recomputeTauxPresence
      dureeRealiseeMinutes: participant.dureeMinutes,
      ...(participant.joinAt !== null ? { heureConnexion: participant.joinAt } : {}),
      ...(participant.leaveAt !== null ? { heureDeconnexion: participant.leaveAt } : {}),
      importId: releveImport.id,
    });
    matchedEnrollmentIds.add(enrollmentId);
  }

  // 8. Recompute taux pour les enrollments touchés.
  for (const enrollmentId of matchedEnrollmentIds) {
    await recomputeTauxPresence(enrollmentId);
  }

  // 9. Génération du PDF relevé de connexion (optionnel — séparé du présent périmètre).
  // Le PDF est généré via generateDocument + ReleveConnexionPdf par l'UI ou un job BullMQ.
  // Ici on ne génère PAS le PDF pour garder l'action rapide.

  await logQualiopiActivity({
    action: "qualiopi.presence.releve.import",
    targetType: "ReleveConnexionImport",
    targetId: releveImport.id,
    changes: {
      sessionId: v.sessionId,
      plateforme: v.plateforme,
      nbMatched: matched.length,
      nbUnmatched: unmatched.length,
    },
    session,
  });

  return {
    data: {
      importId: releveImport.id,
      nbMatched: matched.length,
      nbUnmatched: unmatched.length,
      unmatched: unmatched.map((u) => ({
        nom: u.nomBrut,
        email: u.email,
        dureeMinutes: u.dureeMinutes,
      })),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action 4 — Correction manuelle d'un créneau
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Correction manuelle d'un créneau de présence (source = `manuel`).
 * Recompute le taux de l'enrollment.
 */
export async function setPresenceCreneauManualAction(input: {
  creneauId: string;
  present: boolean;
  dureeRealiseeMinutes: number;
  commentaire?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = setPresenceCreneauManualSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const v = parsed.data;

  // Lecture du créneau pour récupérer l'enrollmentId.
  const creneau = await prisma.presenceCreneau.findUnique({
    where: { id: v.creneauId },
    select: { id: true, enrollmentId: true },
  });
  if (!creneau) return { error: "Créneau introuvable" };

  // Mise à jour.
  await prisma.presenceCreneau.update({
    where: { id: v.creneauId },
    data: {
      present: v.present,
      dureeRealiseeMinutes: v.dureeRealiseeMinutes,
      source: "manuel",
      ...(v.commentaire !== undefined ? { commentaire: v.commentaire } : {}),
    },
  });

  // Recompute taux.
  await recomputeTauxPresence(creneau.enrollmentId);

  await logQualiopiActivity({
    action: "qualiopi.presence.creneau.manual",
    targetType: "PresenceCreneau",
    targetId: v.creneauId,
    changes: {
      present: v.present,
      dureeRealiseeMinutes: v.dureeRealiseeMinutes,
      ...(v.commentaire !== undefined ? { commentaire: v.commentaire } : {}),
    },
    session,
  });

  return { data: { id: v.creneauId } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action 5 — Génération du document officiel relevé de connexion (PDF)
// ─────────────────────────────────────────────────────────────────────────────

/** Libellés humains des plateformes pour le PDF. */
const PLATEFORME_LABELS: Record<PlateformeLabel, string> = {
  zoom: "Zoom",
  teams: "Microsoft Teams",
  meet: "Google Meet",
  autre: "Autre plateforme",
};

/** Formate une heure en "HHhMM" sur le fuseau Europe/Paris. */
function formatHeureParis(d: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}h${m}`;
}

/**
 * Génère le `DocumentGenere` officiel « relevé de connexion » (PDF react-pdf)
 * à partir d'un import distanciel. Lie le PDF au CSV original archivé via
 * `fichierOriginalPath` (obligation CDC : conserver la source brute, pas que le
 * PDF). Couvre l'indicateur 12 (suivi de l'exécution, distanciel).
 *
 * NB : le numéro séquentiel officiel est alloué par `generateDocument` et
 * persisté en DB ; le rendu d'en-tête du numéro dans le PDF dépend du service
 * de numérotation (limitation connue documents-service — durcissement T16).
 */
export async function genererReleveConnexionDocumentAction(input: {
  importId: string;
}): Promise<ActionResult<{ documentId: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = z.object({ importId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Données invalides" };
  const { importId } = parsed.data;

  const releveImport = await prisma.releveConnexionImport.findUnique({
    where: { id: importId },
    select: {
      id: true,
      plateforme: true,
      fichierOriginalPath: true,
      meta: true,
      session: {
        select: {
          id: true,
          dateDebut: true,
          dateFin: true,
          coFormateurs: true,
          formateurPrincipalId: true,
          formationSnapshot: true,
          formation: { select: { titre: true } },
        },
      },
      presences: {
        select: {
          dureeRealiseeMinutes: true,
          present: true,
          heureConnexion: true,
          heureDeconnexion: true,
          enrollment: { select: { trainee: { select: { nom: true, prenom: true } } } },
        },
      },
    },
  });

  if (!releveImport) return { error: "Import introuvable" };
  if (!releveImport.session) return { error: "Session liée introuvable" };

  const identite = await getOrganismeIdentite();
  const seuilPct = await getQualiopiConfig("seuil_presence_pct");

  const plateformeLabel =
    PLATEFORME_LABELS[releveImport.plateforme as PlateformeLabel] ?? "Plateforme";
  const metaObj = (releveImport.meta ?? {}) as Record<string, unknown>;
  const idReunion = typeof metaObj["idReunion"] === "string" ? metaObj["idReunion"] : "—";

  const dateCivile = parisDateISO(releveImport.session.dateDebut);
  const horaires = `${formatHeureParis(releveImport.session.dateDebut)}–${formatHeureParis(
    releveImport.session.dateFin,
  )}`;

  // Formateur principal : FK formateurPrincipalId prioritaire, repli Json legacy.
  const principalTrainerId = resolvePrincipalTrainerId({
    formateurPrincipalId: releveImport.session.formateurPrincipalId,
    coFormateurs: releveImport.session.coFormateurs,
  });
  let nomFormateur = "—";
  if (principalTrainerId !== null) {
    const trainer = await prisma.trainer.findUnique({
      where: { id: principalTrainerId },
      select: { nom: true, prenom: true },
    });
    if (trainer) nomFormateur = `${trainer.prenom} ${trainer.nom}`.trim();
  }

  const participants = releveImport.presences.map((p) => ({
    nomPrenom: `${p.enrollment.trainee.prenom} ${p.enrollment.trainee.nom}`.trim(),
    heureConnexion: p.heureConnexion ? formatHeureParis(p.heureConnexion) : "—",
    heureDeconnexion: p.heureDeconnexion ? formatHeureParis(p.heureDeconnexion) : "—",
    dureeEffective: formatMinutesToHHhMM(p.dureeRealiseeMinutes),
    presenceValidee: p.present,
  }));

  // buildElement reçoit le numéro alloué → l'en-tête PDF affiche le vrai N°.
  const doc = await generateDocument({
    type: "releve_connexion",
    buildElement: (numero) =>
      React.createElement(ReleveConnexionPdf, {
        data: {
          numero,
          intituleFormation:
            readFormationForDocs(
              releveImport.session!.formationSnapshot,
              releveImport.session!.formation,
            ).titre ?? releveImport.session!.formation.titre,
          plateforme: plateformeLabel,
          idReunion,
          date: dateCivile,
          horairesSession: horaires,
          nomFormateur,
          dureeMinimaleRequisePercent: seuilPct,
          participants,
        },
        identite,
      }),
    refs: { sessionId: releveImport.session.id },
    ...(releveImport.fichierOriginalPath
      ? { fichierOriginalPath: releveImport.fichierOriginalPath }
      : {}),
  });

  await logQualiopiActivity({
    action: "qualiopi.presence.releve.document",
    targetType: "DocumentGenere",
    targetId: doc.id,
    changes: { importId, numero: doc.numero },
    session,
  });

  return { data: { documentId: doc.id, numero: doc.numero } };
}

// Export utilitaire exposé pour les tests.
export { formatMinutesToHHhMM };
