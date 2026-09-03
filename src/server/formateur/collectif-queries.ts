/**
 * Espace formateur collectif — requêtes formations (Node runtime).
 *
 * Toutes SCOPÉES par `trainerId`. Un formateur ne voit que les sessions
 * auxquelles il est affecté, par l'une des deux voies (`formateurPrincipalId`
 * ou `SessionFormateur`).
 *
 * ⚠️ POLITIQUE DE CHAMPS STAGIAIRE — non négociable : ne jamais exposer
 * `Trainee.handicapDetailsChiffre` (détail de santé chiffré). Le formateur voit
 * le drapeau `situationHandicap` (nécessaire pour adapter, ind. 10/26) et
 * l'identité pédagogique minimale (nom, prénom, entreprise, fonction), jamais
 * l'email ni les détails sensibles.
 */

import { prisma } from "@/lib/prisma";
import { resoudreAppartenance, type RoleFormateur } from "./session-membership";

/** Filtre Prisma : sessions du formateur (principal FK OU ligne SessionFormateur). */
/**
 * Appartenance d'une session a un formateur : principal OU co-animateur.
 *
 * Exportee parce que TROIS endroits en dependent — la liste, le detail, et le
 * telechargement du kit. Recopiee, elle finirait par diverger, et une garde qui
 * diverge est une garde qui laisse passer.
 */
export function whereSessionsDuFormateur(trainerId: string) {
  return {
    OR: [{ formateurPrincipalId: trainerId }, { sessionFormateurs: { some: { trainerId } } }],
  };
}

/** Liste des formations collectives du formateur (résumé tableau de bord). */
export async function listMyTrainingSessions(trainerId: string) {
  const sessions = await prisma.trainingSession.findMany({
    where: whereSessionsDuFormateur(trainerId),
    orderBy: { dateDebut: "desc" },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      statut: true,
      modalite: true,
      dateDebut: true,
      dateFin: true,
      lieuVille: true,
      formateurPrincipalId: true,
      sessionFormateurs: {
        where: { trainerId },
        select: { role: true },
      },
      // Ne compte QUE les inscrits dont le stagiaire n'est pas effacé (RGPD).
      // `Trainee.deletedAt` = soft-delete du droit à l'effacement ; un stagiaire
      // effacé ne doit apparaître ni au compteur ni à la liste.
      _count: { select: { enrollments: { where: { trainee: { deletedAt: null } } } } },
    },
  });

  return sessions.map((s) => {
    const app = resoudreAppartenance({
      estPrincipalFk: s.formateurPrincipalId === trainerId,
      roleSessionFormateur: (s.sessionFormateurs[0]?.role as RoleFormateur | undefined) ?? null,
    });
    return {
      id: s.id,
      numero: s.numero,
      titreSession: s.titreSession,
      statut: s.statut,
      modalite: s.modalite,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      lieuVille: s.lieuVille,
      role: app.role,
      nbInscrits: s._count.enrollments,
    };
  });
}

/**
 * Détail d'une formation pour le formateur — `null` s'il n'y est pas affecté.
 *
 * Le contrôle d'appartenance est fait au niveau applicatif (pas seulement dans le
 * `where`) pour exposer aussi le RÔLE et le droit de clôture, dérivés du moteur
 * pur.
 */
export async function getTrainingSessionForFormateur(sessionId: string, trainerId: string) {
  const session = await prisma.trainingSession.findFirst({
    where: { id: sessionId, ...whereSessionsDuFormateur(trainerId) },
    select: {
      id: true,
      numero: true,
      titreSession: true,
      statut: true,
      modalite: true,
      dateDebut: true,
      dateFin: true,
      dureeReelleHeures: true,
      nbParticipantsPrevus: true,
      // 2026-09-03 — le formateur voyait ville et code postal, jamais la salle,
      // l'adresse, le lien visio, le contact sur place ni les consignes d'accès.
      // Ces champs sont POUR LUI : ils s'affichent ici et partent dans sa
      // convocation J-7. Ils ne figurent sur aucun document du client.
      lieuType: true,
      lieuIntitule: true,
      lieuAdresse: true,
      lieuVille: true,
      lieuCodePostal: true,
      lieuSalle: true,
      lieuVisioUrl: true,
      contactSurPlaceNom: true,
      contactSurPlaceTelephone: true,
      consignesAcces: true,
      jours: {
        orderBy: { date: "asc" },
        select: { date: true, heureDebut: true, heureFin: true },
      },
      formateurPrincipalId: true,
      sessionFormateurs: {
        where: { trainerId },
        select: { role: true, convocationJ7EnvoyeeAt: true, rappelJ1EnvoyeAt: true },
      },
      enrollments: {
        // Les abandons/exclus restent VISIBLES au formateur (contexte de séance),
        // mais un stagiaire EFFACÉ (droit à l'effacement RGPD, `Trainee.deletedAt`)
        // disparaît de la liste. On ne remonte jamais de détail sensible.
        where: { trainee: { deletedAt: null } },
        orderBy: { trainee: { nom: "asc" } },
        select: {
          id: true,
          statut: true,
          tauxPresencePct: true,
          trainee: {
            select: {
              nom: true,
              prenom: true,
              entreprise: true,
              fonction: true,
              situationHandicap: true,
              // ❌ JAMAIS : email, handicapDetailsChiffre, consentements.
            },
          },
        },
      },
    },
  });

  if (session === null) return null;

  const app = resoudreAppartenance({
    estPrincipalFk: session.formateurPrincipalId === trainerId,
    roleSessionFormateur: (session.sessionFormateurs[0]?.role as RoleFormateur | undefined) ?? null,
  });

  return {
    id: session.id,
    numero: session.numero,
    titreSession: session.titreSession,
    statut: session.statut,
    modalite: session.modalite,
    dateDebut: session.dateDebut,
    dateFin: session.dateFin,
    dureeReelleHeures: session.dureeReelleHeures,
    nbParticipantsPrevus: session.nbParticipantsPrevus,
    lieuType: session.lieuType,
    lieuIntitule: session.lieuIntitule,
    lieuAdresse: session.lieuAdresse,
    lieuVille: session.lieuVille,
    lieuCodePostal: session.lieuCodePostal,
    lieuSalle: session.lieuSalle,
    lieuVisioUrl: session.lieuVisioUrl,
    contactSurPlaceNom: session.contactSurPlaceNom,
    contactSurPlaceTelephone: session.contactSurPlaceTelephone,
    consignesAcces: session.consignesAcces,
    jours: session.jours,
    convocationJ7EnvoyeeAt: session.sessionFormateurs[0]?.convocationJ7EnvoyeeAt ?? null,
    rappelJ1EnvoyeAt: session.sessionFormateurs[0]?.rappelJ1EnvoyeAt ?? null,
    role: app.role,
    peutCloturerEmargement: app.peutCloturerEmargement,
    inscrits: session.enrollments.map((e) => ({
      id: e.id,
      statut: e.statut,
      tauxPresencePct: e.tauxPresencePct,
      nom: e.trainee.nom,
      prenom: e.trainee.prenom,
      entreprise: e.trainee.entreprise,
      fonction: e.trainee.fonction,
      situationHandicap: e.trainee.situationHandicap,
    })),
  };
}
