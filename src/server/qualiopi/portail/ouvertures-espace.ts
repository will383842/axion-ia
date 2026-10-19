/**
 * Chantier QNC, lot P11 — les TRACES de l'espace stagiaire.
 *
 * Deux écritures, toutes deux derrière `qualiopi.dossier_session.actif` :
 *  - une ligne `espace_stagiaire_ouvertures` quand un lien d'accès est ouvert
 *    (table en création seule : le trigger interdit UPDATE et DELETE) ;
 *  - un retour « ouverture » dans `remises_retours` quand une PERSONNE ouvre
 *    une pièce de son espace (jamais pour un aperçu automatique).
 *
 * « Essai » = TOUTES les inscriptions du stagiaire sont du banc d'essai : sans
 * inscription, rien (`every` sur le vide serait vrai, d'où la garde).
 *
 * Éteint, rien n'est lu au-delà de l'interrupteur et rien n'est écrit.
 */

import { prisma } from "@/lib/prisma";
import { lireEtatDossierSession } from "@/server/qualiopi/dossier-session/interrupteur";
import { ouverturesActives } from "./ouvertures-actives";
import {
  TYPES_PIECES_COLLECTIVES_ESPACE_STAGIAIRE,
  TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE,
} from "./portail-service";
import { pieceEstRemise } from "./piece-remise";

export { ouverturesActives };

type Origine = "navigateur" | "apercu_automatique";

const enStub = (): boolean => process.env["DATABASE_URL"]?.includes("stub.invalid") === true;

/** Les traces sont-elles écrites pour CE stagiaire ? Ne lève jamais. */
export async function ouverturesActivesPourStagiaire(traineeId: string): Promise<boolean> {
  if (enStub()) return false;
  try {
    const etat = await lireEtatDossierSession();
    if (etat === "eteint") return false;
    const inscriptions = await prisma.enrollment.findMany({
      where: { traineeId },
      select: { estTestInterne: true },
    });
    return ouverturesActives(etat, inscriptions);
  } catch {
    return false;
  }
}

/**
 * Trace l'ouverture d'un lien d'accès. Fail-soft : l'accès n'échoue jamais à
 * cause de la trace, mais l'échec est journalisé côté serveur.
 */
export async function tracerOuvertureEspace(traineeId: string, origine: Origine): Promise<void> {
  try {
    if (!(await ouverturesActivesPourStagiaire(traineeId))) return;
    await prisma.espaceStagiaireOuverture.create({ data: { traineeId, origine } });
  } catch (err) {
    console.error(
      "[portail] ouverture de l'espace non tracée :",
      err instanceof Error ? err.name : "erreur",
    );
  }
}

export interface PieceDuStagiaire {
  readonly documentId: string;
  readonly type: string;
  readonly numero: string;
  readonly createdAt: Date;
  readonly enrollmentId: string;
  readonly sessionId: string | null;
}

/**
 * La pièce demandée, si elle appartient à une inscription DU stagiaire — mêmes
 * règles que la liste de l'espace : attestation de l'inscription, pièce
 * collective de la session, pièce nominative établie pour ce stagiaire, et
 * seulement si elle est « remise ». `null` sinon, sans distinguer « n'existe
 * pas » de « appartient à un autre ».
 */
export async function trouverPieceDuStagiaire(
  traineeId: string,
  documentId: string,
): Promise<PieceDuStagiaire | null> {
  if (enStub()) return null;
  const champs = { id: true, type: true, numero: true, createdAt: true } as const;
  const inscriptions = await prisma.enrollment.findMany({
    where: { traineeId },
    select: {
      id: true,
      sessionId: true,
      attestationDocument: { select: champs },
      session: {
        select: {
          statut: true,
          dateDebut: true,
          dateFin: true,
          documents: {
            where: {
              id: documentId,
              OR: [
                { type: { in: [...TYPES_PIECES_COLLECTIVES_ESPACE_STAGIAIRE] } },
                { type: { in: [...TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE] }, traineeId },
              ],
            },
            select: champs,
          },
        },
      },
    },
  });

  const maintenant = new Date();
  for (const i of inscriptions) {
    const att = i.attestationDocument;
    if (att !== null && att.id === documentId) {
      return { documentId, ...pick(att), enrollmentId: i.id, sessionId: i.sessionId ?? null };
    }
    const doc = i.session?.documents.find((d) => d.id === documentId);
    if (doc === undefined || i.session === null || i.session === undefined) continue;
    const remise = pieceEstRemise(
      {
        type: doc.type,
        sessionDateDebut: i.session.dateDebut ?? null,
        sessionDateFin: i.session.dateFin ?? null,
        sessionStatut: i.session.statut ?? null,
      },
      maintenant,
    );
    if (!remise) continue;
    return { documentId, ...pick(doc), enrollmentId: i.id, sessionId: i.sessionId ?? null };
  }
  return null;
}

function pick(d: { type: string; numero: string; createdAt: Date }) {
  return { type: d.type, numero: d.numero, createdAt: d.createdAt };
}

/**
 * Écrit le retour « ouverture » d'une pièce, après avoir assuré sa remise (un
 * retour vise toujours une remise : CHECK `remises_retours_retour_vise_une_remise`).
 */
export async function journaliserOuvertureDocument(p: {
  readonly documentId: string;
  readonly type: string;
  readonly numero: string;
  readonly enrollmentId: string;
  readonly sessionId: string | null;
}): Promise<void> {
  if (p.sessionId === null) return; // `session_id` est obligatoire : sans session, rien à journaliser.
  const objet = `document_${p.type}`.slice(0, 80);
  const libelle = p.numero.slice(0, 300);
  const sessionId = p.sessionId;
  const remise = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`remise.${p.enrollmentId}.${objet}.${libelle}`}))`;
    const existante = await tx.remiseRetour.findFirst({
      where: { enrollmentId: p.enrollmentId, nature: "remise", objet, libelle },
      select: { id: true },
    });
    if (existante !== null) return existante;
    return tx.remiseRetour.create({
      data: {
        sessionId,
        enrollmentId: p.enrollmentId,
        nature: "remise",
        destinataire: "stagiaire",
        canal: "espace",
        objet,
        libelle,
        documentGenereId: p.documentId,
      },
      select: { id: true },
    });
  });
  await prisma.remiseRetour.create({
    data: {
      sessionId,
      enrollmentId: p.enrollmentId,
      nature: "ouverture",
      remiseId: remise.id,
      destinataire: "stagiaire",
      canal: "espace",
      objet,
      libelle,
      documentGenereId: p.documentId,
    },
  });
}
