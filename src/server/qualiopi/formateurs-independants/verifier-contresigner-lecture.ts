/**
 * Écran « Vérifier et contresigner » (W-4, lot L9) — LECTURE.
 *
 * Compose les faits de l'écran à partir de la base : dernier contrôle du
 * registre (L4), attestation URSSAF et sa preuve (L4b), pièces, habilitations,
 * contrat-cadre v3 (L7c). Rien n'est écrit ici : relire le registre en direct
 * est le travail de la contresignature elle-même (`objectionContratCadre`).
 *
 * L'IBAN n'est lu que pour savoir s'il est présent ; aucune donnée ne part au
 * journal ni à Sentry.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { aUnFichier } from "@/server/qualiopi/trainers/piece-competence";

import { etatControle, LIBELLES_MOTIFS, type MotifControle } from "./controle-regles";
import { versionDuContrat } from "./faits-activation";
import {
  VERSION_MINIMALE_CONTRAT_INDEPENDANT,
  vigilanceProuvee,
} from "./garde-activation-complete";
import type { FaitsW4, PieceW4 } from "./verifier-contresigner-regles";

export interface LienPiece {
  readonly libelle: string;
  readonly url: string;
}

export interface EcranW4 {
  readonly trainerId: string;
  /** « Prénom N. » — l'écran de console, jamais un journal. */
  readonly nomAffiche: string;
  readonly signeLe: Date | null;
  readonly faits: FaitsW4;
  readonly liens: ReadonlyArray<LienPiece>;
  readonly lienAttestation: string | null;
  readonly formations: ReadonlyArray<{ id: string; titre: string; habilite: boolean }>;
}

function raisonControle(motif: string | null): string | null {
  if (motif === null || motif.trim() === "") return null;
  const libelles = motif
    .split(",")
    .map((m) => m.trim())
    .filter((m): m is MotifControle => Object.prototype.hasOwnProperty.call(LIBELLES_MOTIFS, m))
    .map((m) => LIBELLES_MOTIFS[m]);
  return libelles.length > 0 ? libelles.join(" ") : null;
}

function pieceW4(
  docs: ReadonlyArray<{
    id: string;
    type: string;
    statutValidation: string;
    fichierUrl: string | null;
  }>,
  type: string,
): (PieceW4 & { url: string | null }) | null {
  // La plus récente non rejetée d'abord, sinon la plus récente.
  const duType = docs.filter((d) => d.type === type);
  const d = duType.find((x) => x.statutValidation !== "rejete") ?? duType[0];
  if (d === undefined) return null;
  return {
    id: d.id,
    statutValidation: d.statutValidation,
    fichierPresent: aUnFichier(d.fichierUrl),
    url: aUnFichier(d.fichierUrl) ? d.fichierUrl : null,
  };
}

/** L'écran d'un formateur indépendant, ou `null` (fiche absente ou hors périmètre). */
export async function lireEcranVerifierContresigner(
  trainerId: string,
  maintenant: Date = new Date(),
): Promise<EcranW4 | null> {
  const t = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      prenom: true,
      nom: true,
      statut: true,
      actif: true,
      finCollaborationAt: true,
      sousTraitantNda: true,
      ndaVerifieListeAt: true,
      regimeTvaHonoraires: true,
      iban: true,
      declarationsVersion: true,
      habilitations: { where: { retireAt: null }, select: { formationId: true } },
      documents: {
        where: {
          type: { in: ["attestation_vigilance_urssaf", "cv", "assurance_rc_pro", "rib"] },
          archiveAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          statutValidation: true,
          fichierUrl: true,
          numeroPiece: true,
          dateEmission: true,
          dateExpiration: true,
        },
      },
    },
  });
  if (t === null || t.statut !== "sous_traitant") return null;

  const [controles, preuves, contrats, formations] = await Promise.all([
    prisma.verificationRegistreSousTraitance.findMany({
      where: { trainerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { verdict: true, source: true, verifieAt: true, createdAt: true, motif: true },
    }),
    prisma.preuveVigilance.findMany({
      where: { trainerId },
      select: { trainerDocumentId: true, resultat: true },
    }),
    prisma.documentGenere.findMany({
      where: { trainerId, type: "contrat_sous_traitance", annuleeAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        numero: true,
        metadata: true,
        statutSignature: true,
        signatures: {
          where: { revokedAt: null, partie: "sous_traitant" },
          orderBy: { signeAt: "desc" },
          take: 1,
          select: { signeAt: true },
        },
      },
    }),
    prisma.formation.findMany({
      where: { statut: "actif" },
      orderBy: { titre: "asc" },
      select: { id: true, titre: true },
    }),
  ]);

  const etat = etatControle(controles, maintenant);
  const derniere = controles[0];
  // Raison du contrôle jugé (celui qui a été validé, pour un orange validé).
  const jugee = controles.find((c) => c.source !== "validation_administrateur") ?? derniere;

  const attestations = t.documents.filter((d) => d.type === "attestation_vigilance_urssaf");
  const att = attestations.find((d) => d.statutValidation !== "rejete") ?? attestations[0];
  const contrat = contrats.find(
    (c) => versionDuContrat(c.metadata) >= VERSION_MINIMALE_CONTRAT_INDEPENDANT,
  );

  const cv = pieceW4(t.documents, "cv");
  const rcPro = pieceW4(t.documents, "assurance_rc_pro");
  const rib = pieceW4(t.documents, "rib");
  const habilitees = new Set(t.habilitations.map((h) => h.formationId));

  const faits: FaitsW4 = {
    controle: {
      statut: etat.statut,
      dernierAt: etat.dernierAt,
      raison: raisonControle(jugee?.motif ?? null),
    },
    nda: {
      renseigne: (t.sousTraitantNda ?? "").trim() !== "",
      vuSurListe: t.ndaVerifieListeAt !== null,
    },
    attestation:
      att === undefined
        ? null
        : {
            id: att.id,
            statutValidation: att.statutValidation,
            code: att.numeroPiece ?? null,
            prouvee: vigilanceProuvee([att], preuves, maintenant),
          },
    pieces: { cv, rcPro, rib },
    dossier: {
      regimeTva: t.regimeTvaHonoraires !== null,
      iban: typeof t.iban === "string" && t.iban !== "",
      declarations: (t.declarationsVersion ?? "").trim() !== "",
    },
    habilitationsActives: habilitees.size,
    contrat:
      contrat === undefined
        ? null
        : { id: contrat.id, numero: contrat.numero, statutSignature: contrat.statutSignature },
    actif: t.actif,
    finCollaboration: t.finCollaborationAt !== null,
  };

  const liens: LienPiece[] = [
    ...(cv?.url ? [{ libelle: "Voir le CV", url: cv.url }] : []),
    ...(rcPro?.url ? [{ libelle: "Voir la RC pro", url: rcPro.url }] : []),
    ...(rib?.url ? [{ libelle: "Voir le RIB", url: rib.url }] : []),
  ];

  return {
    trainerId: t.id,
    nomAffiche: `${t.prenom} ${t.nom.slice(0, 1)}.`,
    signeLe: contrat?.signatures[0]?.signeAt ?? null,
    faits,
    liens,
    lienAttestation: att !== undefined && aUnFichier(att.fichierUrl) ? att.fichierUrl : null,
    formations: formations.map((f) => ({ ...f, habilite: habilitees.has(f.id) })),
  };
}
