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
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { resolvePrincipalTrainerId } from "@/server/qualiopi/trainers/session-formateurs";
import {
  genererCreneaux,
  sessionTropEtaleePourLeRepli,
  ECART_MAX_REPLI_JOURS,
} from "@/server/qualiopi/presence/creneaux";
import { parseReleveConnexion } from "@/server/qualiopi/presence/parse-releve";
import { matchParticipants } from "@/server/qualiopi/presence/match";
import {
  parisDateISO,
  formatMinutesToHHhMM,
  parisMinutesDuJour,
} from "@/server/qualiopi/presence/time";
import {
  repartirMinutesConnexion,
  fenetreDemiJournee,
} from "@/server/qualiopi/presence/repartition-distanciel";
import { upsertCreneau, recomputeTauxPresence } from "@/server/qualiopi/presence/presence-service";
import { storeAndSignCsv } from "@/server/qualiopi/documents/render";
import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { ReleveConnexionPdf } from "@/server/qualiopi/documents/templates/releve-connexion";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { readFormationForDocs } from "@/server/qualiopi/formations/formation-snapshot";
import type { DemiJourneeLabel, PlateformeLabel } from "@/server/qualiopi/presence/types";
import { invalidateIndicateursCache } from "@/server/qualiopi/indicateurs/service";

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
  /**
   * Passe outre le garde-fou D14 sur une session étalée sans journées déclarées.
   *
   * Il existe de vraies sessions continues de plus d'un mois (reconversion), et
   * les refuser serait une régression. Mais le geste doit être EXPLICITE : le
   * défaut est de refuser, et l'admin confirme après avoir lu pourquoi.
   */
  confirmerSansJournees: z.boolean().optional(),
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
  confirmerSansJournees?: boolean;
}): Promise<{ data: { created: number } } | { error: string; confirmable?: boolean }> {
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
        // Filtre d'ÉCRITURE : on ne crée pas de nouveaux créneaux pour qui a
        // abandonné. Le filtre de LECTURE, lui, a été dissocié (oubli O3) —
        // masquer en grille les créneaux DÉJÀ signés d'un abandon revenait à se
        // priver d'heures réellement suivies et facturables à l'OPCO.
        where: {
          statut: { notIn: ["abandon", "exclu"] },
        },
        select: { id: true },
      },
      /// Journées RÉELLEMENT animées (D14). Vide = repli sur `dateDebut..dateFin`.
      jours: {
        select: { date: true, heureDebut: true, heureFin: true },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!trainingSession) return { error: "Session introuvable" };

  const jours = trainingSession.jours.map((j) => ({
    date: parisDateISO(j.date),
    heureDebut: j.heureDebut,
    heureFin: j.heureFin,
  }));

  // 🔴 Garde-fou D14. Sans journées déclarées, on ne sait pas quels jours sont
  // animés : on ne peut que supposer qu'ils se suivent. Sur une session étalée
  // c'est faux, et générer les créneaux de tous les jours ouvrés traversés
  // multiplierait le dénominateur du taux — un parcours de 4 journées sur 3 mois
  // produit 66 jours au lieu de 4, soit un taux à ≈ 3 % et une attestation
  // refusée à un stagiaire assidu. Refuser bruyamment vaut mieux que produire
  // des dizaines de créneaux faux en silence.
  if (
    v.confirmerSansJournees !== true &&
    sessionTropEtaleePourLeRepli({
      dateDebut: trainingSession.dateDebut,
      dateFin: trainingSession.dateFin,
      jours,
    })
  ) {
    return {
      error: `Cette session s'étale sur plus de ${ECART_MAX_REPLI_JOURS} jours sans avoir déclaré ses journées. Renseignez-les dans la section « Journées réellement animées », juste au-dessus : sinon le taux de présence sera calculé sur TOUS les jours ouvrés de la période. Si la session est réellement continue sur toute la plage, confirmez pour générer quand même.`,
      // Refus levable : une session continue de deux mois est légitime.
      confirmable: true,
    };
  }

  // Génération des créneaux via logique pure.
  // ⚠️ `dureeReelleHeures` est la durée TOTALE de la session, PAS une durée
  // journalière : elle est passée en `dureeTotaleHeures` pour être répartie sur
  // les demi-journées retenues. La passer en `heuresParJour` (bug corrigé)
  // doublait le dénominateur du taux sur toute session de plus d'un jour.
  let creneaux;
  try {
    creneaux = genererCreneaux({
      dateDebut: trainingSession.dateDebut,
      dateFin: trainingSession.dateFin,
      ...(jours.length > 0 ? { jours } : {}),
      ...(v.heuresParJour !== undefined ? { heuresParJour: v.heuresParJour } : {}),
      ...(trainingSession.dureeReelleHeures !== null
        ? { dureeTotaleHeures: trainingSession.dureeReelleHeures }
        : {}),
    });
  } catch (err) {
    // `genererCreneaux` lève sur une journée malformée. Le CHECK SQL rend le cas
    // improbable, mais le laisser remonter en erreur 500 n'apprendrait rien à
    // l'admin qui doit corriger la saisie.
    Sentry.captureException(err, {
      tags: { action: "generateSessionCreneauxAction" },
      extra: { sessionId: v.sessionId },
    });
    return { error: "Une journée déclarée est invalide. Corrigez la saisie des journées." };
  }

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

  // Vérification session. `dateDebut` sert à invalider le cache des indicateurs
  // de la BONNE année (une session de décembre émargée en janvier invaliderait
  // sinon la mauvaise clé, et le taux de complétion resterait faux 1 h durant).
  const trainingSession = await prisma.trainingSession.findUnique({
    where: { id: v.sessionId },
    select: { id: true, dateDebut: true },
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
      select: { id: true, dureePrevueMinutes: true, source: true, libelle: true },
    });

    // Durée réalisée : si présent et non fournie → dureePrevue du créneau.
    let dureeRealiseeMinutes = entry.dureeRealiseeMinutes ?? 0;
    if (entry.present && entry.dureeRealiseeMinutes === undefined) {
      dureeRealiseeMinutes = existingCreneau?.dureePrevueMinutes ?? 0;
    }

    // ⚠️ La PROVENANCE d'un créneau importé ne doit jamais être réécrite.
    // La grille reçoit TOUS les créneaux de la session, y compris ceux issus d'un
    // relevé Zoom/Teams/Meet. Un simple clic « Enregistrer », même sans rien
    // modifier, transformait `import_zoom` en `emargement_presentiel` sur des
    // enregistrements à valeur probante — et remplaçait leur libellé horodaté.
    // Le PDF de relevé de connexion et le dossier d'audit lisent ce champ.
    const sourceImportee = existingCreneau?.source?.startsWith("import_") === true;
    const source = sourceImportee
      ? (existingCreneau?.source as "import_zoom" | "import_teams" | "import_meet")
      : "emargement_presentiel";
    const libelle = sourceImportee
      ? (existingCreneau?.libelle ?? "")
      : `${entry.date} ${entry.demiJournee === "apres_midi" ? "après-midi" : entry.demiJournee}`;

    await upsertCreneau({
      enrollmentId: entry.enrollmentId,
      date: dateObj,
      demiJournee: toDemiJourneeEnum(entry.demiJournee),
      libelle,
      dureePrevueMinutes: existingCreneau?.dureePrevueMinutes ?? dureeRealiseeMinutes,
      source,
      present: entry.present,
      dureeRealiseeMinutes,
    });
    updated++;
  }

  // Recompute taux + pose emargementSigneAt pour chaque enrollment touché.
  // Verrou write-once : le `where` sur emargementSigneAt:null fait que seul le
  // PREMIER émargement horodate la signature ; les ré-enregistrements suivants
  // (correction de présence) n'affectent 0 ligne → preuve horodatée immuable.
  const now = new Date();
  for (const enrollmentId of enrollmentIds) {
    await recomputeTauxPresence(enrollmentId);
    await prisma.enrollment.updateMany({
      where: { id: enrollmentId, emargementSigneAt: null },
      data: { emargementSigneAt: now },
    });
  }

  // UN SEUL appel, APRÈS la boucle : `invalidateIndicateursCache` fait un
  // `redis.keys()` (bloquant O(N) sur Redis, partagé avec BullMQ) — l'appeler
  // par enrollment le déclencherait 15 fois pour une sauvegarde de grille.
  await invalidateIndicateursCache(trainingSession.dateDebut.getUTCFullYear());

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
      // `dateFin` requis pour dériver le nombre de jours retenus et donc la durée
      // prévue d'UNE journée distancielle (cf. genererCreneaux plus bas).
      dateFin: true,
      dureeReelleHeures: true,
      // 🔴 Journées déclarées (D14) — INDISPENSABLE ici aussi. Les omettre
      // rendait ce chemin faux exactement comme l'autre : voir le commentaire
      // du calcul de `dureePrevueMinutes` plus bas.
      jours: {
        select: { date: true, heureDebut: true, heureFin: true },
        orderBy: { date: "asc" },
      },
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

  // 6. Durée prévue d'UNE journée distancielle.
  //
  // ⚠️ Corrigé : on posait ici `dureeReelleHeures * 60`, soit la durée TOTALE de
  // la session sur un unique créneau. Une session distancielle de 2 jours voyait
  // donc 14 h attendues sur une seule journée — et les autres jours n'avaient
  // aucun créneau du tout, donc aucune présence justifiable.
  // `genererCreneaux` porte déjà la répartition correcte (jours retenus + plafond
  // horaire) : on en dérive la durée d'une journée pleine = 2 demi-journées.
  //
  // 🔴 Les journées déclarées (D14) doivent être passées ICI AUSSI. Sans elles,
  // ce chemin retombait sur `dateDebut..dateFin` alors que l'autre chemin, lui,
  // les respectait — et les deux dénominateurs divergeaient. Sur une session
  // distancielle de 28 h dont les 4 journées sont réparties sur 3 mois, le repli
  // retenait 66 jours ouvrés, d'où 0,42 h/jour et une durée prévue de 26 MINUTES
  // pour la journée. Le réalisé étant plafonné au prévu, tout le monde ressortait
  // à 100 % avec 0 h 26 sur l'attestation. Surévaluer la présence est bien plus
  // grave que la sous-évaluer : c'est ce qu'un contrôle sanctionne.
  const joursDeclares = trainingSession.jours.map((j) => ({
    date: parisDateISO(j.date),
    heureDebut: j.heureDebut,
    heureFin: j.heureFin,
  }));

  // 🔴 Le MÊME garde-fou que `generateSessionCreneauxAction`. Le passer ici
  // seulement était une incohérence dangereuse : un chemin refusait bruyamment,
  // l'autre écrivait en silence. Sans journées déclarées — l'état par défaut de
  // toute session existante — l'import retombait sur les 66 jours ouvrés d'un
  // parcours de 3 mois, soit 26 minutes de durée prévue et TOUT LE MONDE à 100 %
  // avec 0 h 26 sur l'attestation.
  if (
    sessionTropEtaleePourLeRepli({
      dateDebut: trainingSession.dateDebut,
      dateFin: trainingSession.dateFin,
      jours: joursDeclares,
    })
  ) {
    return {
      error: `Cette session s'étale sur plus de ${ECART_MAX_REPLI_JOURS} jours sans avoir déclaré ses journées. Renseignez-les avant d'importer un relevé : sinon la durée attendue serait calculée sur tous les jours ouvrés de la période, et le taux de présence de tous les stagiaires serait faux.`,
    };
  }

  const creneauxSession = genererCreneaux({
    dateDebut: trainingSession.dateDebut,
    dateFin: trainingSession.dateFin,
    ...(joursDeclares.length > 0 ? { jours: joursDeclares } : {}),
    ...(trainingSession.dureeReelleHeures !== null
      ? { dureeTotaleHeures: trainingSession.dureeReelleHeures }
      : {}),
  });
  // 🔴 La durée prévue d'une journée est la SOMME des créneaux de CETTE journée.
  //
  // L'ancien `creneauxSession[0].dureePrevueMinutes * 2` postulait « une journée
  // = 2 demi-journées de durée égale ». D14 casse les deux moitiés du postulat :
  // une journée déclarée peut produire UN seul créneau, et les créneaux ont
  // désormais des durées différentes entre eux. Le `[0]` désignait de surcroît
  // toujours le PREMIER jour de la session, alors que le créneau créé est daté
  // sur l'heure de connexion réelle.
  //
  // Conséquence mesurée : 3 matinées déclarées 09:00–13:00 pour 12 h. Avant D14
  // le stagiaire assidu sortait à 100 % ; avec le `× 2` il tombait à 50 % et
  // perdait son attestation — PARCE QUE l'organisme avait correctement saisi ses
  // journées. Déclarer la vérité rendait le résultat faux.
  const creneauxParJour = new Map<string, typeof creneauxSession>();
  for (const c of creneauxSession) {
    const liste = creneauxParJour.get(c.date);
    if (liste === undefined) creneauxParJour.set(c.date, [c]);
    else liste.push(c);
  }
  // Journée de repli : la première du plan. Elle remplace l'ancien bornage sur
  // `dateDebut..dateFin`, plus faible — une connexion un samedi non planifié
  // créait un créneau sur un jour sans durée prévue, gonflant le dénominateur.
  const premierJourPlan = creneauxSession[0]?.date ?? parisDateISO(trainingSession.dateDebut);

  // 7. Création des créneaux distanciels.
  //
  // ⚠️ DEUX RÈGLES NON NÉGOCIABLES, chacune corrigeant une manière de FAUSSER le
  // taux de présence — et donc l'attestation :
  //
  // (a) On crée un créneau pour TOUS les inscrits actifs, pas seulement pour ceux
  //     retrouvés dans le relevé. Ne créer que les présents retirait les absents
  //     du DÉNOMINATEUR : un stagiaire venu 1 jour sur 2 obtenait 100 % au lieu
  //     de 50 %, donc une attestation complète au lieu de partielle. Surévaluer la
  //     présence est bien plus grave que la sous-évaluer : c'est ce qu'un contrôle
  //     de service fait sanctionne.
  //
  // (b) Le réalisé est PLAFONNÉ au prévu. Les parseurs agrègent un participant sur
  //     toute la plage du fichier (cf. `parse-zoom.ts`) : un export couvrant 2 jours
  //     produisait 840 min réalisées pour 420 prévues, soit un taux de 200 % écrit
  //     en base. `computeTauxPresence` n'a aucun plafond.
  //
  // La date vient de l'heure de connexion réelle, bornée à la plage de la session :
  // une connexion de test la veille, un fuseau mal parsé ou un CSV d'une autre
  // réunion créeraient sinon un créneau HORS session que `recomputeTauxPresence`
  // compterait quand même (il lit tous les créneaux de l'inscription, sans filtre
  // de date) — et qu'aucune UI ne permet de supprimer.
  const enrollmentIdsTouches = new Set<string>();
  const matchedById = new Map(matched.map((m) => [m.enrollmentId, m.participant]));

  for (const enrollment of trainingSession.enrollments) {
    const participant = matchedById.get(enrollment.id);

    // La date doit être une journée RÉELLEMENT PLANIFIÉE : sinon le créneau créé
    // n'a pas de durée prévue de référence et fausse le dénominateur.
    const isoBrut = parisDateISO(participant?.joinAt ?? trainingSession.dateDebut);
    const dateCivile = creneauxParJour.has(isoBrut) ? isoBrut : premierJourPlan;
    const dateObj = new Date(`${dateCivile}T00:00:00+00:00`);
    const creneauxDuJour = creneauxParJour.get(dateCivile) ?? [];

    // 🔴 (c) UN CRÉNEAU PAR DEMI-JOURNÉE, comme en présentiel.
    //
    // On posait ici un unique créneau « journée ». Deux conséquences : sur une
    // session hybride la même journée portait matin + après-midi + journée, soit
    // 14 h attendues pour 7 h réelles et un stagiaire assidu à 50 % ; et surtout
    // la feuille n'était signée qu'UNE fois par jour — exactement la forme que
    // CAA Nantes 14/06/2022 juge « insuffisamment probante », avec redressement
    // au prorata. Aligner le grain traite la cause, pas le symptôme.
    const cibles = creneauxDuJour.map((c) => ({
      demiJournee: c.demiJournee,
      dureePrevueMinutes: c.dureePrevueMinutes,
      ...(c.jourHeureDebut !== undefined && c.jourHeureFin !== undefined
        ? fenetreDemiJournee(c.jourHeureDebut, c.jourHeureFin, c.demiJournee)
        : { debutMin: 0, finMin: 0 }),
    }));

    // Sans horaires déclarés, la fenêtre de chaque demi-journée est inconnue :
    // on n'invente pas de bornes, on répartit au prorata du prévu.
    const horairesConnus = creneauxDuJour.every((c) => c.jourHeureDebut !== undefined);
    const joinMin =
      horairesConnus && participant?.joinAt != null ? parisMinutesDuJour(participant.joinAt) : null;
    const leaveMin =
      horairesConnus && participant?.leaveAt != null
        ? parisMinutesDuJour(participant.leaveAt)
        : null;

    const parts = repartirMinutesConnexion({
      creneaux: cibles,
      dureeMinutes: participant?.dureeMinutes ?? 0,
      joinMin,
      leaveMin,
    });

    for (const [index, creneau] of creneauxDuJour.entries()) {
      await upsertCreneau({
        enrollmentId: enrollment.id,
        date: dateObj,
        demiJournee: toDemiJourneeEnum(creneau.demiJournee),
        libelle: creneau.libelle,
        dureePrevueMinutes: creneau.dureePrevueMinutes,
        source: toPresenceSource(v.plateforme),
        present: false, // sera mis à jour par recomputeTauxPresence
        dureeRealiseeMinutes: parts[index] ?? 0,
        // Horodatages bruts du relevé, portés sur chaque demi-journée du jour :
        // c'est l'enveloppe de connexion de la journée, la seule que le relevé
        // fournisse. Les répartir serait inventer une donnée.
        ...(participant?.joinAt != null ? { heureConnexion: participant.joinAt } : {}),
        ...(participant?.leaveAt != null ? { heureDeconnexion: participant.leaveAt } : {}),
        importId: releveImport.id,
      });
    }
    enrollmentIdsTouches.add(enrollment.id);
  }

  // 8. Recompute taux pour les enrollments touchés.
  for (const enrollmentId of enrollmentIdsTouches) {
    await recomputeTauxPresence(enrollmentId);
  }

  // Cache indicateurs : le taux de complétion dérive de `tauxPresencePct`.
  // Sans invalidation, un import distanciel reste invisible jusqu'à 1 h.
  await invalidateIndicateursCache(new Date(trainingSession.dateDebut).getUTCFullYear());

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
    // `session.dateDebut` remonté pour invalider le cache indicateurs de la
    // bonne année (cf. saveEmargementAction).
    select: {
      id: true,
      enrollmentId: true,
      enrollment: { select: { session: { select: { dateDebut: true } } } },
    },
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

  // Recompute taux + invalidation du cache indicateurs.
  await recomputeTauxPresence(creneau.enrollmentId);
  await invalidateIndicateursCache(creneau.enrollment.session.dateDebut.getUTCFullYear());

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
