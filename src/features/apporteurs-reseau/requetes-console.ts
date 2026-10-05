/**
 * Réseau d'apporteurs (démarrage manuel) — les LECTURES de la console : liste des
 * apporteurs et fiche détaillée. Noms déchiffrés ici, jamais côté client.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import type { ApporteurReseauStatut } from "../../../prisma/generated/client";

import { STATUTS_CUMUL, piecesVigilanceConformes } from "./commissions";
import { lireDossier } from "./donnees";
import { SEUIL_VIGILANCE_CENTS } from "./regles";

export const LIBELLE_STATUT_APPORTEUR: Readonly<Record<ApporteurReseauStatut, string>> = {
  dossier_en_cours: "Dossier en cours",
  a_verifier: "À vérifier",
  a_completer: "À compléter",
  signe: "Signé",
  refuse: "Refusé",
  resilie: "Terminé",
};

export interface LigneApporteur {
  id: string;
  nom: string;
  statut: ApporteurReseauStatut;
  denomination: string | null;
  entreprises: number;
  commissionsDuesCents: number;
  commissionsVerseesCents: number;
  creeAt: Date;
  signeParSocieteAt: Date | null;
}

/** Taille d'une page des listes de la console (pagination simple, précédent / suivant). */
export const PAR_PAGE = 100;

/** Nombre d'apporteurs par statut, et total des commissions à verser (toutes pages confondues). */
export async function compterApporteurs(): Promise<{
  parStatut: Partial<Record<ApporteurReseauStatut, number>>;
  commissionsDuesCents: number;
}> {
  if (process.env.DATABASE_URL?.includes("stub.invalid"))
    return { parStatut: {}, commissionsDuesCents: 0 };
  const [g, dues] = await Promise.all([
    prisma.apporteurReseau.groupBy({ by: ["statut"], _count: { _all: true } }),
    prisma.commissionApporteur.aggregate({
      where: { statut: { in: ["due", "en_attente_vigilance"] } },
      _sum: { montantCents: true },
    }),
  ]);
  return {
    parStatut: Object.fromEntries(g.map((x) => [x.statut, x._count._all])),
    commissionsDuesCents: dues._sum.montantCents ?? 0,
  };
}

export async function listerApporteurs(
  o: { statuts?: readonly ApporteurReseauStatut[]; page?: number } = {},
): Promise<LigneApporteur[]> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  const page = Math.max(1, Math.floor(o.page ?? 1));
  const lignes = await prisma.apporteurReseau.findMany({
    ...(o.statuts ? { where: { statut: { in: [...o.statuts] } } } : {}),
    orderBy: [{ creeAt: "desc" }, { id: "asc" }],
    take: PAR_PAGE,
    skip: (page - 1) * PAR_PAGE,
    select: {
      id: true,
      prenom: true,
      nom: true,
      statut: true,
      denomination: true,
      creeAt: true,
      signeParSocieteAt: true,
      _count: { select: { presentations: true } },
      commissions: { select: { statut: true, montantCents: true } },
    },
  });
  return lignes.map((a) => ({
    id: a.id,
    nom: `${decryptPii(a.prenom) ?? ""} ${decryptPii(a.nom) ?? ""}`.trim() || "(sans nom)",
    statut: a.statut,
    denomination: a.denomination,
    entreprises: a._count.presentations,
    commissionsDuesCents: a.commissions
      .filter((c) => c.statut === "due" || c.statut === "en_attente_vigilance")
      .reduce((s, c) => s + (c.montantCents ?? 0), 0),
    commissionsVerseesCents: a.commissions
      .filter((c) => c.statut === "versee")
      .reduce((s, c) => s + (c.montantCents ?? 0), 0),
    creeAt: a.creeAt,
    signeParSocieteAt: a.signeParSocieteAt,
  }));
}

export interface EntrepriseDeLApporteur {
  id: string;
  denomination: string;
  siren: string;
  statut: string;
  recueAt: Date;
  confirmeeAt: Date | null;
  protegeeJusquAt: Date | null;
  prolongeeAt: Date | null;
}

export interface CommissionDeLApporteur {
  id: string;
  activite: string;
  palier: string | null;
  factureHtCents: number;
  montantCents: number | null;
  statut: string;
  parrainage: boolean;
  creeAt: Date;
  verseeAt: Date | null;
}

export async function lireFicheApporteur(id: string) {
  const dossier = await lireDossier(id);
  if (!dossier) return null;
  const [a, presentations, commissions, parrains, piecesVigilance] = await Promise.all([
    prisma.apporteurReseau.findUnique({
      where: { id },
      select: {
        noteInterne: true,
        parrainId: true,
        contratCle: true,
        contratSigneCle: true,
        submissionId: true,
        creeAt: true,
        refuseAt: true,
        signatureApporteur: true,
        filleuls: { select: { id: true, prenom: true, nom: true, statut: true } },
      },
    }),
    prisma.presentationEntreprise.findMany({
      where: { apporteurId: id },
      orderBy: { recueAt: "desc" },
      select: {
        id: true,
        denomination: true,
        siren: true,
        statut: true,
        recueAt: true,
        confirmeeAt: true,
        protegeeJusquAt: true,
        prolongeeAt: true,
      },
    }),
    prisma.commissionApporteur.findMany({
      where: { apporteurId: id },
      orderBy: { creeAt: "desc" },
      select: {
        id: true,
        activite: true,
        palier: true,
        factureHtCents: true,
        montantCents: true,
        statut: true,
        parrainage: true,
        creeAt: true,
        verseeAt: true,
      },
    }),
    prisma.apporteurReseau.findMany({
      where: { statut: "signe", id: { not: id } },
      select: { id: true, prenom: true, nom: true },
      take: 500,
    }),
    prisma.pieceApporteur.findMany({
      where: { apporteurId: id, type: { in: ["vigilance", "immatriculation"] }, remplaceeAt: null },
      select: { type: true, statut: true, expireAt: true, remplaceeAt: true },
    }),
  ]);
  const cumulVigilanceCents = commissions
    .filter((c) => (STATUTS_CUMUL as readonly string[]).includes(c.statut))
    .reduce((s, c) => s + (c.montantCents ?? 0), 0);
  const nom = (x: { prenom: string; nom: string }) =>
    `${decryptPii(x.prenom) ?? ""} ${decryptPii(x.nom) ?? ""}`.trim();
  return {
    dossier,
    noteInterne: a?.noteInterne ?? null,
    parrainId: a?.parrainId ?? null,
    aContratApporteur: !!a?.contratCle,
    aContratSigne: !!a?.contratSigneCle,
    submissionId: a?.submissionId ?? null,
    signature: (a?.signatureApporteur as Record<string, unknown> | null) ?? null,
    filleuls: (a?.filleuls ?? []).map((f) => ({ id: f.id, nom: nom(f), statut: f.statut })),
    parrainsPossibles: parrains.map((p) => ({ id: p.id, nom: nom(p) })),
    entreprises: presentations as EntrepriseDeLApporteur[],
    commissions: commissions as CommissionDeLApporteur[],
    /** Cumul vers le seuil de 5 000 € (art. 5.4) et état des deux pièces demandées. */
    vigilance: {
      cumulCents: cumulVigilanceCents,
      seuilCents: SEUIL_VIGILANCE_CENTS,
      piecesConformes: piecesVigilanceConformes(piecesVigilance, new Date()),
      piecesEnAttente: piecesVigilance.filter((p) => p.statut === "deposee").length,
    },
  };
}

export type FicheApporteur = NonNullable<Awaited<ReturnType<typeof lireFicheApporteur>>>;

/** Les octets d'une pièce, pour la route de téléchargement de la console. */
export async function lireOctetsPiece(apporteurId: string, pieceId: string) {
  const p = await prisma.pieceApporteur.findFirst({
    where: { id: pieceId, apporteurId },
    select: {
      nomFichier: true,
      typeMime: true,
      purgeeAt: true,
      contenu: { select: { octets: true } },
    },
  });
  if (!p || p.purgeeAt || !p.contenu) return null;
  return {
    nomFichier: p.nomFichier,
    typeMime: p.typeMime,
    octets: new Uint8Array(p.contenu.octets),
  };
}
