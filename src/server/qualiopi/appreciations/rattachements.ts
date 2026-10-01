/**
 * Rattachements LISIBLES des appréciations listées dans le registre.
 *
 * 🔴 POURQUOI (constat en production, 2026-10-01, veille du premier audit). La
 * colonne « Lien » du registre des appréciations affichait des identifiants
 * techniques tronqués — « T: 068304cd… E: 7c1d1a4e… ». Un auditeur ne peut rien
 * en faire : il ne remonte pas d'une appréciation au stagiaire, à la session ou
 * au client qui l'a donnée, alors que c'est précisément ce qu'il vérifie.
 *
 * On résout ici, pour une page d'appréciations, le nom du stagiaire, le numéro
 * de session, la raison sociale du client, le nom du formateur et la date de la
 * séance d'accompagnement — chacun avec l'identifiant qui sert de lien vers sa
 * fiche.
 *
 * Sans N+1 : UNE requête groupée par table (`id IN (…)`), quel que soit le
 * nombre d'appréciations, lancées en parallèle. Chaque lecture est fail-soft :
 * une table indisponible ne doit pas faire tomber le registre — la ligne retombe
 * alors sur « auteur non rattaché » pour ce rattachement-là.
 */

import { prisma } from "@/lib/prisma";

/** Ce dont la résolution a besoin d'une appréciation — rien de plus. */
export interface AppreciationARattacher {
  id: string;
  traineeId: string | null;
  enrollmentId: string | null;
  clientId: string | null;
  trainerId: string | null;
  coachingSessionId: string | null;
}

export interface LienFiche {
  id: string;
  libelle: string;
}

/** Ce qu'une appréciation désigne, en clair. Un champ absent = non rattaché. */
export interface RattachementsAppreciation {
  stagiaire?: LienFiche;
  session?: LienFiche;
  client?: LienFiche;
  formateur?: LienFiche;
  seance?: LienFiche;
}

const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function distincts(valeurs: (string | null)[]): string[] {
  return [...new Set(valeurs.filter((v): v is string => v !== null))];
}

function nomComplet(p: { prenom: string; nom: string }): string {
  return `${p.prenom} ${p.nom}`.trim();
}

/**
 * Résout les rattachements de chaque appréciation, indexés par l'identifiant de
 * l'appréciation. Une appréciation sans aucun rattachement résolu porte un
 * objet vide.
 */
export async function resoudreRattachementsAppreciations(
  appreciations: AppreciationARattacher[],
): Promise<Map<string, RattachementsAppreciation>> {
  const resultat = new Map<string, RattachementsAppreciation>();
  for (const a of appreciations) resultat.set(a.id, {});
  if (appreciations.length === 0) return resultat;
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return resultat;

  const traineeIds = distincts(appreciations.map((a) => a.traineeId));
  const enrollmentIds = distincts(appreciations.map((a) => a.enrollmentId));
  const clientIds = distincts(appreciations.map((a) => a.clientId));
  const trainerIds = distincts(appreciations.map((a) => a.trainerId));
  const seanceIds = distincts(appreciations.map((a) => a.coachingSessionId));

  const [stagiaires, inscriptions, clients, formateurs, seances] = await Promise.all([
    traineeIds.length === 0
      ? []
      : prisma.trainee
          .findMany({
            where: { id: { in: traineeIds } },
            select: { id: true, nom: true, prenom: true },
          })
          .catch(() => []),
    enrollmentIds.length === 0
      ? []
      : prisma.enrollment
          .findMany({
            where: { id: { in: enrollmentIds } },
            select: {
              id: true,
              trainee: { select: { id: true, nom: true, prenom: true } },
              session: { select: { id: true, numero: true } },
            },
          })
          .catch(() => []),
    clientIds.length === 0
      ? []
      : prisma.client
          .findMany({
            where: { id: { in: clientIds } },
            select: { id: true, raisonSociale: true },
          })
          .catch(() => []),
    trainerIds.length === 0
      ? []
      : prisma.trainer
          .findMany({
            where: { id: { in: trainerIds } },
            select: { id: true, nom: true, prenom: true },
          })
          .catch(() => []),
    seanceIds.length === 0
      ? []
      : prisma.coachingSession
          .findMany({
            where: { id: { in: seanceIds } },
            select: { id: true, dateSeance: true },
          })
          .catch(() => []),
  ]);

  const stagiaireParId = new Map(stagiaires.map((t) => [t.id, t]));
  const inscriptionParId = new Map(inscriptions.map((e) => [e.id, e]));
  const clientParId = new Map(clients.map((c) => [c.id, c]));
  const formateurParId = new Map(formateurs.map((t) => [t.id, t]));
  const seanceParId = new Map(seances.map((s) => [s.id, s]));

  for (const a of appreciations) {
    const r: RattachementsAppreciation = {};
    const inscription = a.enrollmentId ? inscriptionParId.get(a.enrollmentId) : undefined;

    // Le stagiaire : celui rattaché directement, à défaut celui de l'inscription
    // — une appréciation saisie depuis une inscription désigne bien quelqu'un.
    const stagiaire = a.traineeId ? stagiaireParId.get(a.traineeId) : inscription?.trainee;
    if (stagiaire) r.stagiaire = { id: stagiaire.id, libelle: nomComplet(stagiaire) };

    if (inscription) {
      r.session = { id: inscription.session.id, libelle: inscription.session.numero };
    }

    const client = a.clientId ? clientParId.get(a.clientId) : undefined;
    if (client) r.client = { id: client.id, libelle: client.raisonSociale };

    const formateur = a.trainerId ? formateurParId.get(a.trainerId) : undefined;
    if (formateur) r.formateur = { id: formateur.id, libelle: nomComplet(formateur) };

    const seance = a.coachingSessionId ? seanceParId.get(a.coachingSessionId) : undefined;
    if (seance) {
      r.seance = {
        id: seance.id,
        libelle: `Séance d'accompagnement du ${dateFr.format(seance.dateSeance)}`,
      };
    }

    resultat.set(a.id, r);
  }

  return resultat;
}
