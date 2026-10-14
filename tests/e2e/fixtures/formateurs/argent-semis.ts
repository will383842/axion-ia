// Banc @formateurs, équipe ARGENT — SEMIS des données de départ, côté spec.
//
// Données FICTIVES : noms inventés, adresses `example.test` (RFC 2606), numéros
// préfixés `BANC-ARG-`. Toutes les dates d'argent sont en 2037-2038 : aucun passage
// planifié du worker, qui tourne à l'heure réelle, ne les atteint, et aucune autre
// équipe du banc ne date ses sessions là.
//
// ⚠️ Ce qui ne s'efface PAS, et pourquoi. Le paiement écrit dans des tables en AJOUT
// SEUL (`revendications_paiement`, `numeros_emis`, contresignatures chaînées), dont les
// clés étrangères sont RESTRICT : une session payée, ou un formateur revendiqué, ne se
// supprime plus — c'est voulu en production. Le banc ne force pas ces gardes : ses
// lignes restent dans la base ÉPHÉMÈRE du job, isolées par leurs dates et leurs clés
// aléatoires. Ce qui s'efface (interrupteurs, puits SMTP) est rendu à l'état d'avant.

import { randomUUID } from "node:crypto";

import { prisma } from "./base";

/** Suffixe aléatoire : isole les lignes d'un test. */
export function cle(): string {
  return randomUUID().slice(0, 8);
}

export interface FormateurSeme {
  readonly id: string;
  readonly email: string;
  readonly prenom: string;
  readonly nom: string;
  /** « Prénom Nom » : la confirmation accessible de la contresignature. */
  readonly nomComplet: string;
}

/**
 * Un formateur INDÉPENDANT complet pour l'autofacture : SIRET, adresse, mandat
 * d'autofacturation signé, régime de TVA (franchise par défaut), dossier vérifié.
 */
export async function semerFormateur(o: {
  readonly prenom: string;
  readonly regimeTva?: "franchise_293b" | "exonere_formation" | "assujetti_20";
  readonly tarifJourneeHtCents?: number;
  readonly activationValideeAt?: Date;
  readonly candidatureId?: string;
}): Promise<FormateurSeme> {
  const k = cle();
  const email = `${o.prenom.toLowerCase()}.argent.${k}@example.test`;
  const t = await prisma.trainer.create({
    data: {
      nom: `Banc-Argent-${k}`,
      prenom: o.prenom,
      email,
      statut: "sous_traitant",
      siret: "98765432400019",
      adresseProfessionnelle: "1 rue du Banc d'Essai, 69000 Lyon",
      mandatAutofacturationSigneAt: new Date("2026-01-05T10:00:00Z"),
      regimeTvaHonoraires: o.regimeTva ?? "franchise_293b",
      tarifJourneeHtCents: o.tarifJourneeHtCents ?? 35_000,
      dossierStatut: "verifie",
      ...(o.activationValideeAt ? { activationValideeAt: o.activationValideeAt } : {}),
      ...(o.candidatureId ? { candidatureId: o.candidatureId } : {}),
    },
    select: { id: true, nom: true },
  });
  return { id: t.id, email, prenom: o.prenom, nom: t.nom, nomComplet: `${o.prenom} ${t.nom}` };
}

export interface JourneeASemer {
  /** « AAAA-MM-JJ », jour civil de Paris. */
  readonly date: string;
  readonly heureDebut?: string;
  readonly heureFin?: string;
  /** Formateur de la journée (co-animation) ; absent = journée sans formateur désigné. */
  readonly trainerId?: string;
}

export interface SessionSemee {
  readonly id: string;
  readonly numero: string;
  readonly titre: string;
}

/**
 * Une session (offre, formation, session, journées, formateurs affectés). La
 * `dateDebut` est la première journée à 9 h de Paris (7 h UTC en été comme en hiver
 * à l'heure près : seul le jour civil compte pour le paiement).
 */
export async function semerSession(o: {
  readonly jours: readonly JourneeASemer[];
  readonly formateurs: readonly string[];
  readonly principal?: string;
  readonly modalite?: "presentiel" | "distanciel" | "hybride";
  readonly statut?: "planifiee" | "en_cours" | "realisee" | "annulee";
  /** Durée de la formation, en heures (le calcul MENSUEL la lit). */
  readonly dureeHeures?: number;
}): Promise<SessionSemee> {
  const k = cle();
  const titre = `Formation banc argent ${k}`;
  const offre = await prisma.offreSite.create({
    data: {
      code: `BANC-ARG-${k}`,
      titreFr: "Offre du banc argent",
      slug: `offre-banc-argent-${k}`,
      formatPedagogique: "collectif_1jour",
      publicViseFr: "Public du banc",
      dureeHeuresMin: 7,
      dureeHeuresMax: 21,
      tarifType: "fixe",
      promessePrincipaleFr: "Promesse du banc",
      anglePedagogiqueFr: "Angle du banc",
    } as never,
    select: { id: true },
  });
  const formation = await prisma.formation.create({
    data: {
      numero: `BANC-ARG-F-${k}`,
      titre: titre,
      slug: `formation-banc-argent-${k}`,
      offreSiteId: offre.id,
      dureeHeures: o.dureeHeures ?? o.jours.length * 7,
    } as never,
    select: { id: true },
  });
  const tries = [...o.jours].sort((a, b) => a.date.localeCompare(b.date));
  const premier = tries[0]!.date;
  const dernier = tries.at(-1)!.date;
  const numero = `BANC-ARG-S-${k}`;
  const session = await prisma.trainingSession.create({
    data: {
      numero,
      titreSession: titre,
      formationId: formation.id,
      dateDebut: new Date(`${premier}T07:00:00Z`),
      dateFin: new Date(`${dernier}T15:00:00Z`),
      modalite: o.modalite ?? "presentiel",
      lieuType: o.modalite === "distanciel" ? "distanciel" : "nos_locaux",
      montantHtCents: 100_000,
      nbParticipantsPrevus: 1,
      statut: o.statut ?? "planifiee",
      formateurPrincipalId: o.principal ?? o.formateurs[0] ?? null,
    } as never,
    select: { id: true },
  });
  await prisma.sessionJour.createMany({
    data: tries.map((j) => ({
      sessionId: session.id,
      date: new Date(`${j.date}T00:00:00Z`),
      heureDebut: j.heureDebut ?? "09:00",
      heureFin: j.heureFin ?? "17:00",
      // Horaires confirmés en console : sans eux, aucun lien d'émargement n'est émis.
      horairesConfirmes: true,
      ...(j.trainerId ? { trainerId: j.trainerId } : {}),
    })),
  });
  if (o.formateurs.length > 0) {
    await prisma.sessionFormateur.createMany({
      data: o.formateurs.map((trainerId) => ({ sessionId: session.id, trainerId })),
    });
  }
  return { id: session.id, numero, titre };
}

/** Une mission ACCEPTÉE au prix figé (ce que lit le passage). */
export async function semerMissionAcceptee(o: {
  readonly sessionId: string;
  readonly trainerId: string;
  readonly tarifHtCents: number;
  readonly regimeTva?: "franchise_293b" | "exonere_formation" | "assujetti_20";
  readonly lettreBlocageMotif?: string;
}): Promise<string> {
  const m = await prisma.missionFormateur.create({
    data: {
      sessionId: o.sessionId,
      trainerId: o.trainerId,
      statut: "acceptee",
      tarifHtCents: o.tarifHtCents,
      regimeTvaFige: o.regimeTva ?? "franchise_293b",
      ...(o.lettreBlocageMotif ? { lettreBlocageMotif: o.lettreBlocageMotif } : {}),
    } as never,
    select: { id: true },
  });
  return m.id;
}

/** Un stagiaire inscrit, et ses créneaux d'émargement présentiel à signer. */
export async function semerInscrit(o: {
  readonly sessionId: string;
  readonly creneaux: ReadonlyArray<{ date: string; demiJournee: "matin" | "apres_midi" }>;
}): Promise<{
  enrollmentId: string;
  nomComplet: string;
  creneaux: Array<{ id: string; date: string; demiJournee: string }>;
}> {
  const k = cle();
  const trainee = await prisma.trainee.create({
    data: { nom: `Stagiaire-${k}`, prenom: "Camille", email: `camille.argent.${k}@example.test` },
    select: { id: true, nom: true },
  });
  const enrollment = await prisma.enrollment.create({
    data: { sessionId: o.sessionId, traineeId: trainee.id, statut: "presente" } as never,
    select: { id: true },
  });
  const creneaux = [];
  for (const c of o.creneaux) {
    const p = await prisma.presenceCreneau.create({
      data: {
        enrollmentId: enrollment.id,
        date: new Date(`${c.date}T00:00:00Z`),
        demiJournee: c.demiJournee,
        libelle: c.demiJournee === "matin" ? "Matin" : "Après-midi",
        dureePrevueMinutes: 210,
        source: "emargement_presentiel",
      } as never,
      select: { id: true },
    });
    creneaux.push({ id: p.id, date: c.date, demiJournee: c.demiJournee });
  }
  return { enrollmentId: enrollment.id, nomComplet: `Camille ${trainee.nom}`, creneaux };
}

/** Les relevés d'un formateur, avec leurs lignes, les plus anciens d'abord. */
export function relevesDe(trainerId: string) {
  return prisma.trainerStatement.findMany({
    where: { trainerId },
    orderBy: [{ periodeYear: "asc" }, { periodeMonth: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      statut: true,
      origine: true,
      sessionId: true,
      periodeYear: true,
      periodeMonth: true,
      totalHtCents: true,
      totalTtcCents: true,
      echeanceAt: true,
      dateFacture: true,
      autofactureAt: true,
      numeroFacture: true,
      avoirDeId: true,
      feeLines: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          objet: true,
          origine: true,
          statut: true,
          demiJournees: true,
          montantHtCents: true,
          sessionId: true,
        },
      },
    },
  });
}

/** Les lignes d'honoraires NON annulées d'un formateur sur une session (tous relevés). */
export async function lignesVivantes(trainerId: string, sessionId: string) {
  return prisma.trainerFeeLine.findMany({
    where: { trainerId, sessionId, statut: { not: "annule" } },
    select: { montantHtCents: true, origine: true, objet: true, statementId: true },
  });
}
