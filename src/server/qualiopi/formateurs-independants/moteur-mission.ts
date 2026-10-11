/**
 * Le MOTEUR UNIQUE des missions de formateur indépendant (lot L11c, 08 §2.5,
 * 08b §3.1) : `reevaluerMission` lit les faits, calcule l'étape
 * (`etapeMission`) et fait la SEULE chose due à cette étape.
 *
 *   - lettre due : régime de TVA figé sur la mission, lettre v2 émise
 *     (`genererLettreMissionV2`), empreinte rangée, F26 ;
 *   - bloquée : motif mémorisé, F32 si le motif CHANGE (et seulement pour une
 *     pièce que le formateur peut fournir), alerte ;
 *   - acceptée, client pas encore engagé : F25, à la réponse seulement.
 *
 * 🔑 Interrupteurs : `formateurs.lettre_auto` ET `formateurs.lettre_v2`.
 * L'un ou l'autre absent : rien n'est lu, rien n'est écrit — exactement le
 * comportement d'avant (la lettre se génère à la main depuis la console).
 *
 * 🔑 IDEMPOTENT, SOUS VERROU (T2). Un verrou consultatif de transaction par
 * mission sérialise les réveils simultanés (convention signée et « J'accepte »
 * à la même minute, crochet et passage horaire) ; le second relit la lettre
 * posée par le premier et ne fait rien. Les e-mails portent un `jobId`
 * déterministe.
 *
 * Ne lève jamais. Aucun nom ni montant dans les journaux ni dans Telegram.
 * Module NEUTRE (Prisma seulement) : le worker le charge.
 */

import { sendTelegram } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { STATUTS_ACCORD_DONNE } from "@/server/qualiopi/trainers/mission-formateur";
import { journaliser } from "@/server/journal/journaliser";
import { genererLettreMissionV2 } from "@/server/qualiopi/documents/lettre-mission-v2-generation";
import { PIECES_ENGAGEANTES } from "@/server/qualiopi/documents/signature/pieces-engageantes";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";
import type { Prisma } from "../../../../prisma/generated/client";

import { eurosCourts } from "./choix-formateur";
import { lireContratCadreSigne } from "./contrat-cadre-en-vigueur";
import { empreinteDeMetadata, empreinteMission } from "./empreinte-mission";
import { envoyer } from "./envois";
import { etapeMission, type EtapeMission } from "./etape-mission";
import { MANQUES_MISSION } from "./garde-mission";
import { controlerGardeMission } from "./garde-mission-portes";
import { interrupteurAllume } from "./interrupteur-allume";
import { envoiAllume } from "./interrupteurs-envoi";
import {
  TARIF_JOURNEE_HT_CENTS,
  decompterJournees,
  echeancePaiement,
  honorairesLettre,
} from "./lettre-mission-v2-calcul";

const isStub = (): boolean => process.env.DATABASE_URL?.includes("stub.invalid") ?? false;

export type CauseReevaluation =
  "reponse" | "convention" | "signature_lettre" | "accord_hors_outil" | "passage";

export type ActionMoteur =
  | "coupe"
  | "rien"
  | "lettre_emise"
  | "lettre_refusee"
  | "bloquee_notifiee"
  | "accord_enregistre"
  | "erreur";

export interface ResultatReevaluation {
  readonly etape: EtapeMission | null;
  readonly action: ActionMoteur;
}

/** Version du gabarit de la lettre émise par le moteur (v2). */
const GABARIT_LETTRE = 2;

/** Les deux interrupteurs du moteur. Lus à l'appel ; absents = arrêté. */
export async function moteurAllume(): Promise<boolean> {
  return (await envoiAllume("lettre_auto")) && (await interrupteurAllume("lettre_v2"));
}

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function dateCivile(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function civileLongue(iso: string): string {
  return DATE_LONGUE.format(new Date(`${iso}T12:00:00.000Z`));
}

async function alerter(body: string): Promise<void> {
  try {
    await sendTelegram({ tag: "AUTO", body });
  } catch {
    // Une alerte manquée ne défait jamais l'acte.
  }
}

function lienFiche(sessionId: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const prefixe = process.env.ADMIN_URL_PREFIX ?? "admin";
  const chemin = `/fr/${prefixe}/qualiopi/sessions/${sessionId}#formateur`;
  return site ? `${site}${chemin}` : `(console ${chemin})`;
}

function lienEspaceFormateur(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return site ? `${site}${FORMATEUR_BASE_PATH}` : null;
}

/**
 * Ce que le formateur peut fournir, dit dans F32. Un manque qui n'est pas de
 * son fait (registre, fiche inactive, erreur) ne lui est jamais écrit.
 */
const MANQUE_POUR_LE_FORMATEUR: ReadonlyMap<string, string> = new Map([
  [MANQUES_MISSION.vigilance, "une attestation URSSAF à jour"],
  [MANQUES_MISSION.nda, "votre numéro de déclaration d'activité"],
  [MANQUES_MISSION.contrat, "la signature de votre contrat-cadre"],
]);

const MISSION_SELECT = {
  id: true,
  statut: true,
  role: true,
  trainerId: true,
  sessionId: true,
  lettreMissionId: true,
  lettreBlocageMotif: true,
  tarifHtCents: true,
  forfaitDeplacementParJourHtCents: true,
  regimeTvaFige: true,
  trainer: {
    select: {
      statut: true,
      organismeSousTraitantId: true,
      regimeTvaHonoraires: true,
      prenom: true,
      nom: true,
      email: true,
    },
  },
  session: {
    select: {
      numero: true,
      titreSession: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      formateurPrincipalId: true,
      lieuType: true,
      lieuAdresse: true,
      lieuCodePostal: true,
      lieuVille: true,
      jours: { select: { date: true, heureDebut: true, heureFin: true } },
    },
  },
  lettreMission: {
    select: {
      annuleeAt: true,
      metadata: true,
      signatures: { where: { revokedAt: null }, select: { partie: true } },
    },
  },
} as const;

/**
 * Réévalue UNE mission. Ne lève jamais. Interrupteurs coupés : `coupe`, sans
 * rien lire d'autre.
 */
export async function reevaluerMission(
  missionId: string,
  cause: CauseReevaluation,
  maintenant: Date,
): Promise<ResultatReevaluation> {
  if (isStub()) return { etape: null, action: "coupe" };
  if (!(await moteurAllume())) return { etape: null, action: "coupe" };
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mission-formateur:${missionId}`}))`;
        return agir(missionId, cause, maintenant);
      },
      { maxWait: 15_000, timeout: 300_000 },
    );
  } catch (err) {
    console.error(
      `[moteur-mission] réévaluation impossible (mission ${missionId}) :`,
      err instanceof Error ? err.message : String(err),
    );
    return { etape: null, action: "erreur" };
  }
}

/** Les faits lus et l'étape calculée d'UNE mission (sans rien écrire). */
export interface EtatMission {
  readonly mission: MissionLue;
  readonly etape: EtapeMission;
  readonly gardeRefus: ReadonlyArray<string>;
  readonly empreinteActuelle: string;
  /** Tarif de la journée : mission, puis affectation, puis 350 € HT (comme la lettre). */
  readonly tarifEffectif: number;
}

/**
 * Lit les faits d'une mission d'indépendant et calcule son étape. `null` si
 * la mission n'est pas celle d'un indépendant en nom propre au rang principal
 * (un organisme suit son propre circuit, lot L11f ; un salarié n'a pas de
 * lettre). Lecture seule : la page « Missions » et le moteur lisent ceci.
 */
export async function lireEtatMission(
  missionId: string,
  maintenant: Date,
): Promise<EtatMission | null> {
  const m = await prisma.missionFormateur.findUnique({
    where: { id: missionId },
    select: MISSION_SELECT,
  });
  if (m === null) return null;
  if (
    m.role !== "principal" ||
    m.trainer.statut !== "sous_traitant" ||
    m.trainer.organismeSousTraitantId !== null
  ) {
    return null;
  }
  const s = m.session;
  const [clientEngage, financeurEnAttente, garde, contrat, affectation, v1Signee] =
    await Promise.all([
      prisma.documentGenere.count({
        where: {
          sessionId: m.sessionId,
          type: { in: [...PIECES_ENGAGEANTES] },
          statutSignature: "signee",
          annuleeAt: null,
        },
      }),
      prisma.documentGenere.count({
        where: {
          sessionId: m.sessionId,
          conditionSuspensiveOpco: true,
          etatConditionSuspensive: "en_attente",
          annuleeAt: null,
        },
      }),
      controlerGardeMission(m.trainerId, maintenant),
      lireContratCadreSigne(m.trainerId),
      // Même repli que la lettre : tarif de la mission, puis de l'affectation.
      prisma.sessionFormateur.findUnique({
        where: { sessionId_trainerId: { sessionId: m.sessionId, trainerId: m.trainerId } },
        select: { tarifHtCents: true },
      }),
      // Une lettre émise avant le moteur (non liée), déjà signée par le formateur :
      // c'est SA lettre ; le moteur n'en émet pas d'autre.
      m.lettreMission === null || m.lettreMission.annuleeAt !== null
        ? prisma.documentGenere.findFirst({
            where: {
              type: "lettre_mission",
              sessionId: m.sessionId,
              trainerId: m.trainerId,
              annuleeAt: null,
              signatures: { some: { revokedAt: null, partie: "formateur" } },
            },
            select: { signatures: { where: { revokedAt: null }, select: { partie: true } } },
          })
        : Promise.resolve(null),
    ]);
  const tarifEffectif = m.tarifHtCents ?? affectation?.tarifHtCents ?? TARIF_JOURNEE_HT_CENTS;
  const regime = m.regimeTvaFige ?? m.trainer.regimeTvaHonoraires;
  const jours = s.jours.map((j) => ({
    date: dateCivile(j.date),
    heureDebut: j.heureDebut,
    heureFin: j.heureFin,
  }));
  const distanciel = s.lieuType === "distanciel";
  const empreinteActuelle = empreinteMission({
    intitule: s.titreSession,
    jours,
    distanciel,
    adresse: s.lieuAdresse,
    codePostal: s.lieuCodePostal,
    ville: s.lieuVille,
    tarifHtCents: tarifEffectif,
    forfaitDeplacementParJourHtCents: m.forfaitDeplacementParJourHtCents,
    regimeTva: regime,
    role: m.role,
    versionContratCadre: contrat?.version ?? null,
    gabaritVersion: GABARIT_LETTRE,
  });
  const lettre =
    m.lettreMission !== null && m.lettreMission.annuleeAt === null
      ? {
          signeeFormateur: m.lettreMission.signatures.some((x) => x.partie === "formateur"),
          signeeAxion: m.lettreMission.signatures.some((x) => x.partie !== "formateur"),
          empreinte: empreinteDeMetadata(m.lettreMission.metadata),
        }
      : v1Signee !== null
        ? {
            signeeFormateur: true,
            signeeAxion: v1Signee.signatures.some((x) => x.partie !== "formateur"),
            // Émise hors du moteur : aucune empreinte, jamais « périmée » par lui.
            empreinte: null,
          }
        : null;
  const etape = etapeMission(
    {
      statut: m.statut,
      sessionStatut: s.statut,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      affecte: s.formateurPrincipalId === m.trainerId,
      clientEngage: clientEngage > 0,
      financeurEnAttente: financeurEnAttente > 0,
      gardeRefus: garde.refus,
      lettre,
      empreinteActuelle,
    },
    maintenant,
  );
  return { mission: m, etape, gardeRefus: garde.refus, empreinteActuelle, tarifEffectif };
}

async function agir(
  missionId: string,
  cause: CauseReevaluation,
  maintenant: Date,
): Promise<ResultatReevaluation> {
  const etat = await lireEtatMission(missionId, maintenant);
  if (etat === null) return { etape: null, action: "rien" };
  const { mission: m, etape, empreinteActuelle } = etat;
  const s = m.session;
  const garde = { refus: etat.gardeRefus };

  switch (etape) {
    case "lettre_due":
      return emettreLettre(m, empreinteActuelle, etat.tarifEffectif, maintenant);
    case "bloquee":
      return notifierBlocage(m, garde.refus, maintenant);
    case "client_pas_engage":
      if (cause === "reponse" || cause === "accord_hors_outil") {
        await envoyer({
          gabarit: "formateur-accord-enregistre",
          destinataire: m.trainer.email,
          entityType: "Trainer",
          entityId: m.trainerId,
          jobId: `formateur-accord-enregistre-${m.id}`,
          payload: { prenom: m.trainer.prenom, valeurs: { intitulé: s.titreSession } },
        });
        return { etape, action: "accord_enregistre" };
      }
      return { etape, action: "rien" };
    default:
      return { etape, action: "rien" };
  }
}

type MissionLue = Prisma.MissionFormateurGetPayload<{ select: typeof MISSION_SELECT }>;

async function emettreLettre(
  m: MissionLue,
  empreinte: string,
  tarif: number,
  maintenant: Date,
): Promise<ResultatReevaluation> {
  const r = await genererLettreMissionV2({
    sessionId: m.sessionId,
    trainerId: m.trainerId,
    maintenant,
  });
  if (!r.ok) {
    // La lettre ne peut pas partir (pièce de la fiche manquante) : on le dit à
    // Will une fois par motif, jamais au formateur (ce n'est pas une pièce
    // qu'il dépose).
    if (r.erreur !== m.lettreBlocageMotif) {
      await prisma.missionFormateur.update({
        where: { id: m.id },
        data: { lettreBlocageMotif: r.erreur.slice(0, 500) },
      });
      await alerter(
        `📄 Session ${m.session.numero} : la lettre de mission ne peut pas être émise. ${lienFiche(m.sessionId)}`,
      );
    }
    return { etape: "lettre_due", action: "lettre_refusee" };
  }
  // Le régime de TVA et le tarif se FIGENT à l'émission réussie (08 §2.7
  // règle 3) : la lettre vient de les lire ainsi ; le paiement et l'empreinte
  // liront désormais ceux-ci.
  await prisma.missionFormateur.updateMany({
    where: { id: m.id, tarifHtCents: null },
    data: { tarifHtCents: tarif },
  });
  if (m.regimeTvaFige === null && m.trainer.regimeTvaHonoraires !== null) {
    await prisma.missionFormateur.updateMany({
      where: { id: m.id, regimeTvaFige: null },
      data: { regimeTvaFige: m.trainer.regimeTvaHonoraires },
    });
  }
  const doc = await prisma.documentGenere.findUnique({
    where: { id: r.documentId },
    select: { metadata: true },
  });
  const meta =
    doc?.metadata !== null && typeof doc?.metadata === "object" && !Array.isArray(doc?.metadata)
      ? (doc.metadata as Record<string, unknown>)
      : {};
  await prisma.documentGenere.update({
    where: { id: r.documentId },
    data: { metadata: { ...meta, empreinteMission: empreinte } as never },
  });
  if (m.lettreBlocageMotif !== null) {
    await prisma.missionFormateur.update({
      where: { id: m.id },
      data: { lettreBlocageMotif: null, lettreBlocageNotifieAt: null },
    });
  }
  await journaliser(prisma, {
    action: "qualiopi.mission.lettre_emise",
    targetType: "MissionFormateur",
    targetId: m.id,
    changes: { documentId: r.documentId, numero: r.numero, automatique: true },
    session: null,
  });

  // F26 — la lettre est prête. Les montants sont ceux de la lettre (même règle).
  const jours = [...m.session.jours]
    .map((j) => ({ date: dateCivile(j.date), heureDebut: j.heureDebut, heureFin: j.heureFin }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const distanciel = m.session.lieuType === "distanciel";
  const forfait = distanciel ? null : m.forfaitDeplacementParJourHtCents;
  const premier = jours[0];
  const dernier = jours[jours.length - 1];
  if (premier !== undefined && dernier !== undefined) {
    const h = honorairesLettre({
      jours,
      tarifJourneeHtCents: tarif,
      forfaitDeplacementParJourHtCents: forfait,
      joursDeplacement: forfait !== null && forfait > 0 ? jours.length : 0,
    });
    const { journees, demiJournees } = decompterJournees(jours);
    const lien = lienEspaceFormateur();
    await envoyer({
      gabarit: "formateur-lettre-a-signer",
      destinataire: m.trainer.email,
      entityType: "Trainer",
      entityId: m.trainerId,
      jobId: `formateur-lettre-a-signer-${r.documentId}`,
      payload: {
        prenom: m.trainer.prenom,
        ...(lien !== null ? { lien } : {}),
        valeurs: {
          intitulé: m.session.titreSession,
          N: String(journees),
          M: String(demiJournees),
          "date de début": civileLongue(premier.date),
          "date de fin": civileLongue(dernier.date),
          lieu: distanciel
            ? "distance"
            : [m.session.lieuVille, m.session.lieuCodePostal].filter(Boolean).join(" ") ||
              "l'adresse indiquée dans la lettre",
          total: eurosCourts(h.totalHtCents).replace(/ €$/, ""),
          "le cas échéant":
            forfait !== null && forfait > 0
              ? `(${eurosCourts(forfait)} HT par journée)`
              : "(compris dans les honoraires)",
          "date limite": civileLongue(echeancePaiement(dernier.date)),
        },
      },
    });
  }
  return { etape: "lettre_due", action: "lettre_emise" };
}

async function notifierBlocage(
  m: MissionLue,
  refus: ReadonlyArray<string>,
  maintenant: Date,
): Promise<ResultatReevaluation> {
  const motif = refus.join(" ").slice(0, 500);
  if (motif === m.lettreBlocageMotif) return { etape: "bloquee", action: "rien" };
  // F32 ne repart que si ce que le FORMATEUR doit fournir a changé.
  const avant = m.lettreBlocageMotif ?? "";
  const dejaDit = [...MANQUE_POUR_LE_FORMATEUR.keys()].filter((k) => avant.includes(k));
  await prisma.missionFormateur.update({
    where: { id: m.id },
    data: { lettreBlocageMotif: motif, lettreBlocageNotifieAt: maintenant },
  });
  await journaliser(prisma, {
    action: "qualiopi.mission.bloquee",
    targetType: "MissionFormateur",
    targetId: m.id,
    changes: { sessionId: m.sessionId, manques: refus.length },
    session: null,
  });
  // I6 — sans nom ni motif.
  await alerter(
    `⛔ Session ${m.session.numero} : mission acceptée mais bloquée (élément manquant). ${lienFiche(m.sessionId)}`,
  );
  // F32 — seulement ce que le formateur peut fournir lui-même.
  const pourLui = refus
    .map((r) => MANQUE_POUR_LE_FORMATEUR.get(r))
    .filter((x): x is string => x !== undefined);
  const memes =
    dejaDit.length === pourLui.length &&
    dejaDit.every((k) => pourLui.includes(MANQUE_POUR_LE_FORMATEUR.get(k)!));
  if (pourLui.length > 0 && !memes) {
    const lien = lienEspaceFormateur();
    await envoyer({
      gabarit: "formateur-mission-en-attente",
      destinataire: m.trainer.email,
      entityType: "Trainer",
      entityId: m.trainerId,
      // Une par motif : un motif nouveau a sa propre clé.
      jobId: `formateur-mission-en-attente-${m.id}-${maintenant.getTime()}`,
      payload: {
        prenom: m.trainer.prenom,
        ...(lien !== null ? { lien } : {}),
        valeurs: { motif: pourLui.join(", ") },
      },
    });
  }
  return { etape: "bloquee", action: "bloquee_notifiee" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Réveils
// ─────────────────────────────────────────────────────────────────────────────

/** Une pièce engageante vient d'être intégralement signée : les missions acceptées de la session. */
export async function reevaluerMissionsDeLaSession(
  sessionId: string,
  cause: CauseReevaluation,
  maintenant: Date,
): Promise<number> {
  if (isStub() || !(await moteurAllume())) return 0;
  const missions = await prisma.missionFormateur.findMany({
    where: { sessionId, role: "principal", statut: { in: [...STATUTS_ACCORD_DONNE] } },
    select: { id: true },
  });
  for (const x of missions) await reevaluerMission(x.id, cause, maintenant);
  return missions.length;
}

/** Au plus 30 missions par passage. */
export const MISSIONS_PAR_PASSAGE = 30;

/** Le moteur ne travaille que de 8 h à 19 h, heure de Paris (décision 59). */
export function dansLaFenetre(maintenant: Date): boolean {
  const heure = Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" })
      .formatToParts(maintenant)
      .find((p) => p.type === "hour")?.value ?? "0",
  );
  return heure >= 8 && heure < 19;
}

/**
 * Passage horaire (filet) : les missions acceptées d'indépendants, à venir,
 * sans lettre vivante liée (aucune, ou annulée).
 */
export async function passerMoteurMissions(maintenant: Date): Promise<{
  reevaluees: number;
  lettres: number;
}> {
  const bilan = { reevaluees: 0, lettres: 0 };
  if (isStub() || !dansLaFenetre(maintenant) || !(await moteurAllume())) return bilan;
  const missions = await prisma.missionFormateur.findMany({
    where: {
      role: "principal",
      statut: { in: [...STATUTS_ACCORD_DONNE] },
      OR: [{ lettreMissionId: null }, { lettreMission: { annuleeAt: { not: null } } }],
      trainer: { statut: "sous_traitant", organismeSousTraitantId: null },
      session: { statut: "planifiee", dateDebut: { gt: maintenant } },
    },
    orderBy: { session: { dateDebut: "asc" } },
    select: { id: true },
    take: MISSIONS_PAR_PASSAGE,
  });
  for (const x of missions) {
    const r = await reevaluerMission(x.id, "passage", maintenant);
    bilan.reevaluees += 1;
    if (r.action === "lettre_emise") bilan.lettres += 1;
  }
  return bilan;
}
