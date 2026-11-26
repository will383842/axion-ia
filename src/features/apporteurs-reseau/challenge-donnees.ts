/**
 * Challenges d'apporteurs — lecture et écriture de la table `challenges_apporteur`.
 *
 * Ce module ne lit JAMAIS une donnée d'apporteur : ni commande, ni facture, ni attribution. Les
 * vues de l'espace (`VueEncartChallenge`, `VueReglementChallenge`) n'ont aucun champ propre à une
 * personne. Un brouillon n'est lu que par la console.
 */
import { prisma } from "@/lib/prisma";

import { MESSAGES_ERREUR, type CodeErreur } from "./challenge-messages";

import {
  empreinteChallenge,
  periodesSeChevauchent,
  type CritereChallenge,
  type ProduitChallenge,
  type SaisieChallenge,
  type StatutChallenge,
} from "./challenge-regles";

const enJour = (d: Date): string => d.toISOString().slice(0, 10);
const deJour = (j: string): Date => new Date(`${j}T00:00:00.000Z`);

/** Ce que l'encart de l'espace reçoit : la règle, rien d'autre. */
export interface VueEncartChallenge {
  titre: string;
  produit: ProduitChallenge;
  seuil: number;
  primeHtCents: number;
  debutLe: string;
  finLe: string;
}

/** Ce que la page du règlement reçoit : le texte publié. */
export interface VueReglementChallenge {
  titre: string;
  reglement: string;
  debutLe: string;
  finLe: string;
}

/** Le challenge publié dont la période contient `aujourdhui` (jour de Paris), sinon null. */
export async function lireEncartChallenge(aujourdhui: string): Promise<VueEncartChallenge | null> {
  const c = await prisma.challengeApporteur.findFirst({
    where: {
      statut: "publie",
      debutLe: { lte: deJour(aujourdhui) },
      finLe: { gte: deJour(aujourdhui) },
    },
    orderBy: { debutLe: "desc" },
    select: {
      titre: true,
      produit: true,
      seuil: true,
      primeHtCents: true,
      debutLe: true,
      finLe: true,
    },
  });
  if (!c) return null;
  return {
    titre: c.titre,
    produit: c.produit as ProduitChallenge,
    seuil: c.seuil,
    primeHtCents: c.primeHtCents,
    debutLe: enJour(c.debutLe),
    finLe: enJour(c.finLe),
  };
}

/**
 * Le règlement publié le plus récent, commencé à `aujourdhui` ; encore lisible après la fin ET
 * après l'archivage (le texte fonde la prime : seul l'encart disparaît à l'archivage).
 */
export async function lireReglementChallenge(
  aujourdhui: string,
): Promise<VueReglementChallenge | null> {
  const c = await prisma.challengeApporteur.findFirst({
    where: {
      statut: { in: ["publie", "archive"] },
      publieAt: { not: null },
      debutLe: { lte: deJour(aujourdhui) },
    },
    orderBy: [{ debutLe: "desc" }, { publieAt: "desc" }],
    select: { titre: true, reglement: true, debutLe: true, finLe: true },
  });
  if (!c) return null;
  return {
    titre: c.titre,
    reglement: c.reglement,
    debutLe: enJour(c.debutLe),
    finLe: enJour(c.finLe),
  };
}

export interface ChallengeConsole extends SaisieChallenge {
  id: string;
  statut: StatutChallenge;
  reglementSha256: string | null;
  publieAt: Date | null;
  creeAt: Date;
  /** Version affichée : la publication refuse si la ligne a changé depuis. */
  version: string;
}

type Ligne = {
  id: string;
  titre: string;
  debutLe: Date;
  finLe: Date;
  paiementJusquAu: Date | null;
  produit: string;
  critere: string;
  seuil: number;
  primeHtCents: number;
  reglement: string;
  reglementSha256: string | null;
  statut: string;
  publieAt: Date | null;
  creeAt: Date;
  majAt: Date;
};

function versConsole(c: Ligne): ChallengeConsole {
  return {
    id: c.id,
    titre: c.titre,
    debutLe: enJour(c.debutLe),
    finLe: enJour(c.finLe),
    paiementJusquAu: c.paiementJusquAu ? enJour(c.paiementJusquAu) : null,
    produit: c.produit as ProduitChallenge,
    critere: c.critere as CritereChallenge,
    seuil: c.seuil,
    primeHtCents: c.primeHtCents,
    reglement: c.reglement,
    reglementSha256: c.reglementSha256,
    statut: c.statut as StatutChallenge,
    publieAt: c.publieAt,
    creeAt: c.creeAt,
    version: c.majAt.toISOString(),
  };
}

export async function listerChallenges(): Promise<ChallengeConsole[]> {
  const l = await prisma.challengeApporteur.findMany({
    orderBy: [{ debutLe: "desc" }, { creeAt: "desc" }],
    take: 200,
  });
  return l.map(versConsole);
}

export async function lireChallenge(id: string): Promise<ChallengeConsole | null> {
  const c = await prisma.challengeApporteur.findUnique({ where: { id } });
  return c ? versConsole(c) : null;
}

const donnees = (s: SaisieChallenge) => ({
  titre: s.titre,
  debutLe: deJour(s.debutLe),
  finLe: deJour(s.finLe),
  paiementJusquAu: s.paiementJusquAu ? deJour(s.paiementJusquAu) : null,
  produit: s.produit,
  critere: s.critere,
  seuil: s.seuil,
  primeHtCents: s.primeHtCents,
  reglement: s.reglement,
});

/** Crée un BROUILLON (rien n'est visible d'un apporteur). */
export async function creerBrouillon(s: SaisieChallenge, auteur: string): Promise<string> {
  const c = await prisma.challengeApporteur.create({
    data: { ...donnees(s), statut: "brouillon", creePar: auteur },
    select: { id: true },
  });
  return c.id;
}

export type ResultatEcriture = { ok: true } | { ok: false; code: CodeErreur; message: string };

const refus = (code: CodeErreur) => ({ ok: false, code, message: MESSAGES_ERREUR[code] }) as const;

/** Modifie un brouillon, et seulement un brouillon : après publication, la règle est figée. */
export async function modifierBrouillon(id: string, s: SaisieChallenge): Promise<ResultatEcriture> {
  const r = await prisma.challengeApporteur.updateMany({
    where: { id, statut: "brouillon" },
    data: donnees(s),
  });
  return r.count === 1 ? { ok: true } : refus("pas_brouillon");
}

export interface OptionsPublication {
  /** Jour civil de Paris du geste (« AAAA-MM-JJ »). */
  aujourdhui: string;
  /** Case « Je publie un challenge déjà commencé », revérifiée par l'action. */
  confirmeDejaCommence: boolean;
}

/**
 * Publie un brouillon : fige la règle (empreinte de la règle complète), refuse une période déjà
 * terminée, exige une confirmation si elle a déjà commencé, refuse un chevauchement avec un
 * challenge déjà publié du même produit (les archivés sont ignorés : point à trancher avant le
 * lot 7, non-cumul de deux primes). Transaction sérialisable : deux publications simultanées ne
 * passent pas toutes les deux.
 */
export async function publierChallenge(
  id: string,
  auteur: string,
  version: string,
  options: OptionsPublication,
): Promise<ResultatEcriture> {
  return prisma.$transaction(
    async (tx) => {
      const c = await tx.challengeApporteur.findUnique({ where: { id } });
      if (!c || c.statut !== "brouillon") return refus("pas_publiable");
      // Ce que l'administrateur a relu doit être ce qui est figé.
      if (c.majAt.toISOString() !== version) return refus("modifie");
      const moi = { debutLe: enJour(c.debutLe), finLe: enJour(c.finLe) };
      if (moi.finLe < options.aujourdhui) return refus("termine");
      if (moi.debutLe < options.aujourdhui && !options.confirmeDejaCommence)
        return refus("deja_commence");
      const memes = await tx.challengeApporteur.findMany({
        where: { statut: "publie", produit: c.produit },
        select: { debutLe: true, finLe: true },
      });
      if (
        memes.some((m) =>
          periodesSeChevauchent(moi, { debutLe: enJour(m.debutLe), finLe: enJour(m.finLe) }),
        )
      )
        return refus("chevauche");
      const r = await tx.challengeApporteur.updateMany({
        where: { id, statut: "brouillon" },
        data: {
          statut: "publie",
          publieAt: new Date(),
          publiePar: auteur,
          reglementSha256: empreinteChallenge({
            titre: c.titre,
            debutLe: moi.debutLe,
            finLe: moi.finLe,
            paiementJusquAu: c.paiementJusquAu ? enJour(c.paiementJusquAu) : null,
            produit: c.produit as ProduitChallenge,
            critere: c.critere as CritereChallenge,
            seuil: c.seuil,
            primeHtCents: c.primeHtCents,
            reglement: c.reglement,
          }),
        },
      });
      return r.count === 1 ? ({ ok: true } as const) : refus("modifie");
    },
    { isolationLevel: "Serializable" },
  );
}

/** Archive un challenge publié (les droits déjà nés restent acquis) : il disparaît de l'espace. */
export async function archiverChallenge(id: string): Promise<ResultatEcriture> {
  const r = await prisma.challengeApporteur.updateMany({
    where: { id, statut: "publie" },
    data: { statut: "archive" },
  });
  return r.count === 1 ? { ok: true } : refus("pas_archivable");
}
