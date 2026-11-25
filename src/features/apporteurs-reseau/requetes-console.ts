/**
 * Réseau d'apporteurs (démarrage manuel) — les LECTURES de la console : liste des
 * apporteurs et fiche détaillée. Noms déchiffrés ici, jamais côté client.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import type { ApporteurReseauStatut } from "../../../prisma/generated/client";

import { lireContenuPiece } from "./pieces-chiffrement";
import { STATUTS_CUMUL, piecesVigilanceConformes } from "./commissions";
import { lireDossier } from "./donnees";
import { SEUIL_VIGILANCE_CENTS } from "./regles";
import { idsRetires } from "./retrait";

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
  /** Apporteurs retirés du réseau (2026-10-07) : hors des compteurs par statut. */
  retires: number;
}> {
  if (process.env.DATABASE_URL?.includes("stub.invalid"))
    return { parStatut: {}, commissionsDuesCents: 0, retires: 0 };
  const retires = await idsRetires();
  const [g, dues] = await Promise.all([
    prisma.apporteurReseau.groupBy({
      by: ["statut"],
      ...(retires.size > 0 ? { where: { id: { notIn: [...retires] } } } : {}),
      _count: { _all: true },
    }),
    prisma.commissionApporteur.aggregate({
      where: { statut: { in: ["due", "en_attente_vigilance"] } },
      _sum: { montantCents: true },
    }),
  ]);
  return {
    parStatut: Object.fromEntries(g.map((x) => [x.statut, x._count._all])),
    commissionsDuesCents: dues._sum.montantCents ?? 0,
    retires: retires.size,
  };
}

export async function listerApporteurs(
  o: { statuts?: readonly ApporteurReseauStatut[]; page?: number; retires?: boolean } = {},
): Promise<LigneApporteur[]> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  const page = Math.max(1, Math.floor(o.page ?? 1));
  // Les fiches retirées du réseau (2026-10-07) n'apparaissent QUE dans l'onglet « Retirés ».
  const retires = [...(await idsRetires())];
  const where = o.retires
    ? { id: { in: retires } }
    : {
        ...(o.statuts ? { statut: { in: [...o.statuts] } } : {}),
        ...(retires.length > 0 ? { id: { notIn: retires } } : {}),
      };
  const lignes = await prisma.apporteurReseau.findMany({
    where,
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
  /** Autofacture impossible faute de donnée : ce qui manque. */
  autofactureAttenteMotif: string | null;
}

/** La preuve de signature pour l'écran : le texte archivé (~60 Ko) reste en base. */
function sansTexteArchive(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const { texte: _texte, ...reste } = json as Record<string, unknown>;
  return reste;
}

export async function lireFicheApporteur(id: string) {
  const dossier = await lireDossier(id);
  if (!dossier) return null;
  const [a, presentations, commissions, parrains, piecesVigilance, purgees] = await Promise.all([
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
        autofactureAttenteMotif: true,
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
    // Pièces dont le fichier est effacé : la console n'affiche plus de lien « Ouvrir ».
    prisma.pieceApporteur.findMany({
      where: { apporteurId: id, remplaceeAt: null, purgeeAt: { not: null } },
      select: { id: true },
    }),
  ]);
  const cumulVigilanceCents = commissions
    .filter((c) => (STATUTS_CUMUL as readonly string[]).includes(c.statut))
    .reduce((s, c) => s + (c.montantCents ?? 0), 0);
  const nom = (x: { prenom: string; nom: string }) =>
    `${decryptPii(x.prenom) ?? ""} ${decryptPii(x.nom) ?? ""}`.trim();
  return {
    dossier,
    piecesPurgeesIds: purgees.map((p) => p.id),
    noteInterne: a?.noteInterne ?? null,
    parrainId: a?.parrainId ?? null,
    aContratApporteur: !!a?.contratCle,
    aContratSigne: !!a?.contratSigneCle,
    submissionId: a?.submissionId ?? null,
    signature: sansTexteArchive(a?.signatureApporteur),
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
    // Déchiffrée ici, seul point de lecture (aperçu console et antivirus à l'ouverture).
    octets: lireContenuPiece(p.contenu.octets),
  };
}

// ── Validation par rendez-vous (lot 6) ───────────────────────────────────

export type MotifProposition = "email_exact" | "meme_entreprise" | "meme_siren";

/** Pourquoi l'outil a rapproché ce rendez-vous de cette entreprise, en clair. */
export const LIBELLE_MOTIF_PROPOSITION: Readonly<Record<MotifProposition, string>> = {
  email_exact: "Même adresse e-mail que la personne présentée",
  meme_entreprise: "Même entreprise (même domaine professionnel ou même fiche client)",
  meme_siren: "Même SIREN (une fiche client de cette entreprise a réservé)",
};

export interface PropositionVue {
  id: string;
  presentationId: string;
  denomination: string;
  siren: string;
  apporteur: string;
  /** Rendez-vous Calendly ou rencontre ; `null` sinon (jamais pour une proposition). */
  rendezVousCle: string;
  motif: string;
  motifLibelle: string;
  apporteurCite: boolean;
  recueAt: Date;
  prisAt: Date;
  rendezVousAt: Date | null;
  /** Le rendez-vous a-t-il déjà eu lieu (date passée) ? Sinon le dirigeant attend. */
  tenuPasse: boolean;
}

/**
 * Les propositions du rapprochement que le dirigeant n'a ni retenues ni écartées, pour des
 * présentations encore « réservées ». Aucune pagination fine : une trentaine tout au plus.
 * Table absente (fenêtre app/worker) : liste vide.
 */
export async function lirePropositionsATraiter(
  maintenant: Date = new Date(),
): Promise<PropositionVue[]> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  let propositions;
  try {
    propositions = await prisma.propositionRendezVousPresentation.findMany({
      where: { ecarteeAt: null, retenueAt: null },
      orderBy: [{ creeAt: "asc" }, { id: "asc" }],
      take: 200,
    });
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === "P2021") return [];
    throw err;
  }
  if (propositions.length === 0) return [];
  const presentations = await prisma.presentationEntreprise.findMany({
    where: {
      id: { in: [...new Set(propositions.map((p) => p.presentationId))] },
      statut: "reservee",
    },
    select: {
      id: true,
      denomination: true,
      siren: true,
      recueAt: true,
      apporteur: { select: { prenom: true, nom: true } },
    },
  });
  const parId = new Map(presentations.map((p) => [p.id, p]));
  const sorties: PropositionVue[] = [];
  for (const pr of propositions) {
    const p = parId.get(pr.presentationId);
    if (!p) continue; // la présentation n'est plus « réservée » : plus rien à proposer
    sorties.push({
      id: pr.id,
      presentationId: p.id,
      denomination: p.denomination,
      siren: p.siren,
      apporteur:
        `${decryptPii(p.apporteur.prenom) ?? ""} ${decryptPii(p.apporteur.nom) ?? ""}`.trim(),
      rendezVousCle: pr.rendezVousCle,
      motif: pr.motif,
      motifLibelle:
        LIBELLE_MOTIF_PROPOSITION[pr.motif as MotifProposition] ?? "Rapprochement de l'outil",
      apporteurCite: pr.apporteurCite,
      recueAt: p.recueAt,
      prisAt: pr.prisAt,
      rendezVousAt: pr.rendezVousAt,
      tenuPasse: !!pr.rendezVousAt && pr.rendezVousAt.getTime() <= maintenant.getTime(),
    });
  }
  return sorties;
}

/** Une entreprise « réservée » qui attend un rendez-vous (pour la saisie manuelle du dirigeant). */
export interface ReservationOuverteVue {
  presentationId: string;
  denomination: string;
  siren: string;
  apporteur: string;
  recueAt: Date;
  reserveeJusquAt: Date;
}

export async function lireReservationsOuvertes(): Promise<ReservationOuverteVue[]> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  let lignes;
  try {
    lignes = await prisma.presentationReservation.findMany({
      where: { regle: "rendez_vous", valideeAt: null, echueAt: null },
      orderBy: [{ reserveeJusquAt: "asc" }],
      take: 300,
      select: { presentationId: true, reserveeJusquAt: true },
    });
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === "P2021") return [];
    throw err;
  }
  if (lignes.length === 0) return [];
  const presentations = await prisma.presentationEntreprise.findMany({
    where: { id: { in: lignes.map((l) => l.presentationId) }, statut: "reservee" },
    select: {
      id: true,
      denomination: true,
      siren: true,
      recueAt: true,
      apporteur: { select: { prenom: true, nom: true } },
    },
  });
  const parId = new Map(presentations.map((p) => [p.id, p]));
  const sorties: ReservationOuverteVue[] = [];
  for (const l of lignes) {
    const p = parId.get(l.presentationId);
    if (!p) continue;
    sorties.push({
      presentationId: p.id,
      denomination: p.denomination,
      siren: p.siren,
      apporteur:
        `${decryptPii(p.apporteur.prenom) ?? ""} ${decryptPii(p.apporteur.nom) ?? ""}`.trim(),
      recueAt: p.recueAt,
      reserveeJusquAt: l.reserveeJusquAt,
    });
  }
  return sorties;
}
