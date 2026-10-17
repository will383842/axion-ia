/**
 * Lot L08 — « Mes supports » : lecture pour le stagiaire et journal des consultations.
 *
 * Deux écritures dans `remises_retours` (ajout seul, aucune adresse) :
 *  - une REMISE, la première fois qu'un support est mis à sa disposition dans
 *    l'espace (canal `espace`) — une par support ET par version : une
 *    régénération est une nouvelle remise ;
 *  - un RETOUR `ouverture` à chaque consultation par une personne, qui pointe sa
 *    remise (CHECK `remises_retours_retour_vise_une_remise`).
 *
 * Éteint, `lireMesSupports` rend `[]` : la rubrique n'existe pas et rien n'est écrit.
 * Les dates sont posées par le serveur (`survenu_le`), jamais par l'appelant.
 */

import { prisma } from "@/lib/prisma";
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { estActifPour } from "@/server/qualiopi/socle/interrupteurs";
import { lirePedagogie } from "./interrupteur";
import {
  TYPES_SUPPORT_STAGIAIRE,
  libelleRemise,
  objetRemise,
  supportsRemis,
  type SupportCandidat,
} from "./mes-supports";

export interface SupportStagiaire {
  readonly id: string;
  readonly type: string;
  readonly titre: string;
  readonly version: number;
  readonly sessionTitre: string;
  /** Première mise à disposition dans l'espace (date serveur). */
  readonly remisLe: Date;
  /** Dernière consultation par ce stagiaire, `null` s'il ne l'a pas ouvert. */
  readonly vuLe: Date | null;
}

interface Contexte {
  readonly support: SupportCandidat & { readonly pdfKey: string };
  readonly enrollmentId: string;
  readonly sessionId: string;
  readonly sessionTitre: string;
}

const enStub = (): boolean => process.env["DATABASE_URL"]?.includes("stub.invalid") === true;

/** Les supports que CE stagiaire peut ouvrir, avec l'inscription qui les lui ouvre. */
async function contextes(traineeId: string): Promise<Contexte[]> {
  const etat = await lirePedagogie();
  if (etat === "eteint") return [];

  const inscriptions = await prisma.enrollment.findMany({
    where: {
      traineeId,
      ...inscriptionsActives(),
      session: { statut: { notIn: ["annulee", "reportee"] } },
    },
    select: {
      id: true,
      estTestInterne: true,
      session: {
        select: { id: true, titreSession: true, formationId: true, estTestInterne: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const concernees = inscriptions.filter((i) =>
    estActifPour(etat, { estTestInterne: i.estTestInterne || i.session.estTestInterne }),
  );
  if (concernees.length === 0) return [];

  const lignes = await prisma.supportFormation.findMany({
    where: {
      formationId: { in: [...new Set(concernees.map((i) => i.session.formationId))] },
      statut: "genere",
      pdfKey: { not: null },
      type: { in: [...TYPES_SUPPORT_STAGIAIRE] as never },
    },
    select: {
      id: true,
      formationId: true,
      type: true,
      titre: true,
      version: true,
      statut: true,
      pdfKey: true,
    },
  });

  return concernees.flatMap((i) =>
    supportsRemis(lignes.filter((l) => l.formationId === i.session.formationId)).map((s) => ({
      support: s as Contexte["support"],
      enrollmentId: i.id,
      sessionId: i.session.id,
      sessionTitre: i.session.titreSession,
    })),
  );
}

/** La remise de ce support dans cette inscription ; créée à la première mise à disposition. */
async function assurerRemise(c: Contexte): Promise<{ id: string; survenuLe: Date }> {
  const objet = objetRemise(c.support.type);
  const libelle = libelleRemise(c.support.titre, c.support.version);
  return prisma.$transaction(async (tx) => {
    // Deux ouvertures simultanées ne doivent pas écrire la remise deux fois.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`remise.${c.enrollmentId}.${objet}.${libelle}`}))`;
    const existante = await tx.remiseRetour.findFirst({
      where: { enrollmentId: c.enrollmentId, nature: "remise", objet, libelle },
      select: { id: true, survenuLe: true },
    });
    if (existante !== null) return existante;
    return tx.remiseRetour.create({
      data: {
        sessionId: c.sessionId,
        enrollmentId: c.enrollmentId,
        nature: "remise",
        destinataire: "stagiaire",
        canal: "espace",
        objet,
        libelle,
      },
      select: { id: true, survenuLe: true },
    });
  });
}

export async function lireMesSupports(traineeId: string): Promise<SupportStagiaire[]> {
  if (enStub()) return [];
  const liste = await contextes(traineeId);
  const vues: SupportStagiaire[] = [];
  for (const c of liste) {
    const remise = await assurerRemise(c);
    const derniere = await prisma.remiseRetour.findFirst({
      where: { remiseId: remise.id, nature: "ouverture" },
      orderBy: { survenuLe: "desc" },
      select: { survenuLe: true },
    });
    vues.push({
      id: c.support.id,
      type: c.support.type,
      titre: c.support.titre,
      version: c.support.version,
      sessionTitre: c.sessionTitre,
      remisLe: remise.survenuLe,
      vuLe: derniere?.survenuLe ?? null,
    });
  }
  return vues;
}

/**
 * Le support demandé, s'il est bien l'un de ceux de CE stagiaire ; `null` sinon
 * (l'identifiant d'un support d'une autre formation ne mène nulle part).
 */
export async function trouverSupportDuStagiaire(
  traineeId: string,
  supportId: string,
): Promise<{ pdfKey: string; nomFichier: string; contexte: Contexte } | null> {
  if (enStub()) return null;
  const c = (await contextes(traineeId)).find((x) => x.support.id === supportId);
  if (c === undefined) return null;
  return {
    pdfKey: c.support.pdfKey,
    nomFichier: `${c.support.type}-v${c.support.version}.pdf`,
    contexte: c,
  };
}

/** Écrit le retour « ouverture » d'une consultation par une personne. */
export async function journaliserConsultation(c: Contexte): Promise<void> {
  const remise = await assurerRemise(c);
  await prisma.remiseRetour.create({
    data: {
      sessionId: c.sessionId,
      enrollmentId: c.enrollmentId,
      nature: "ouverture",
      remiseId: remise.id,
      destinataire: "stagiaire",
      canal: "espace",
      objet: objetRemise(c.support.type),
      libelle: libelleRemise(c.support.titre, c.support.version),
    },
  });
}
