/**
 * Réseau d'apporteurs — le RÉGIME DE TVA FIGÉ sur chaque pièce de la série AXI-APP.
 *
 * Décisions de Will (26/11) :
 *   · une autofacture ou un avoir GARDE POUR TOUJOURS le régime de TVA, le numéro de TVA et les
 *     totaux de son PDF : une commission facturée sans TVA en mars reste sans TVA au virement, même
 *     si l'apporteur passe à la TVA en avril ;
 *   · une AUTOFACTURE prend le régime applicable au jour de son établissement (art. 4.7) ;
 *   · un AVOIR prend le régime de l'autofacture qu'il rectifie (il corrige la TVA facturée dessus) ;
 *   · le VIREMENT suit le PDF : tout calcul d'argent lié à une pièce lit le régime DE LA PIÈCE,
 *     jamais celui de la fiche ;
 *   · une commission pas encore facturée prend le régime applicable aujourd'hui.
 *
 * ⚠️ Atteint par le WORKER (job horaire de facturation) : aucun `server-only`. Le worker et l'app
 * n'atterrissent pas en même temps (AGENTS.md, « DEUX conteneurs ») : tant que les tables ne sont pas
 * là (`piecesFigeesDisponible()` faux), TOUT se replie sur la fiche, c'est-à-dire le comportement
 * d'avant, sans aucune écriture.
 */

import { prisma } from "@/lib/prisma";

import { jourParis, type RegimeApporteur } from "./autofacture-donnees";
import { PREFIXE_PALIER_REPRISE } from "./resiliation";

export type RegimeFige = {
  regimeTva: "assujetti" | "franchise_293b" | null;
  numeroTva: string | null;
};

export type GenrePiece = "facture" | "avoir";
export type OriginePiece = "emission" | "reprise_migration" | "rattrapage";

/** Une base ou une transaction Prisma (les deux exposent les mêmes tables). */
type Db = Pick<typeof prisma, "pieceAutofactureApporteur">;

/** La table des pièces figées est-elle en base ? Seule la PRÉSENCE est mémorisée (comme `litige.ts`). */
let disponible: { lu: number } | null = null;
const RELIRE_MS = 10 * 60 * 1000;

export async function piecesFigeesDisponible(): Promise<boolean> {
  if (disponible && Date.now() - disponible.lu < RELIRE_MS) return true;
  try {
    await prisma.pieceAutofactureApporteur.findFirst({ select: { numero: true } });
    disponible = { lu: Date.now() };
    return true;
  } catch {
    disponible = null;
    return false;
  }
}

/** Pour les tests : oublie la lecture de la table. */
export function oublierPiecesFigeesDisponible(): void {
  disponible = null;
}

/** Le régime de la fiche : repli quand aucune pièce figée ni changement n'est lu. */
async function regimeDeLaFiche(apporteurId: string): Promise<RegimeFige> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { regimeTva: true, numeroTva: true },
  });
  return { regimeTva: a?.regimeTva ?? null, numeroTva: a?.numeroTva ?? null };
}

/** « AAAA-MM-JJ » → date civile (colonne `@db.Date`), rendue à midi UTC. */
function dateCivile(jour: string): Date {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, j!, 12));
}

/**
 * Le régime applicable à une autofacture ÉTABLIE le `jour` (jour de Paris, « AAAA-MM-JJ ») : le
 * dernier changement non annulé dont la date d'effet est ≤ ce jour (à égalité, le plus récemment
 * saisi) ; à défaut — ou si la table manque —, la fiche. Ne dépend donc pas de la bascule de la fiche :
 * un changement daté du jour s'applique même si `basculerRegimesDuJour` n'a pas encore tourné.
 */
export async function regimeApplicableAu(apporteurId: string, jour: string): Promise<RegimeFige> {
  try {
    const c = await prisma.apporteurRegimeTvaChangement.findFirst({
      where: { apporteurId, annuleAt: null, effetAu: { lte: dateCivile(jour) } },
      orderBy: [{ effetAu: "desc" }, { saisiAt: "desc" }],
      select: { regimeTva: true, numeroTva: true },
    });
    if (c) {
      return {
        regimeTva: c.regimeTva,
        numeroTva: c.regimeTva === "assujetti" ? (c.numeroTva ?? null) : null,
      };
    }
  } catch {
    // Table absente (migration pas encore passée) : la fiche, comme avant.
  }
  return regimeDeLaFiche(apporteurId);
}

/** Les pièces figées (régime, numéro de TVA, totaux) de ces numéros ; table absente = aucune. */
export async function piecesFigees(
  numeros: readonly string[],
  /** Cloisonnement : la page de l'apporteur ne lit que SES pièces. */
  apporteurId?: string,
): Promise<
  Map<
    string,
    {
      genre: string;
      regimeTva: "assujetti" | "franchise_293b";
      numeroTva: string | null;
      totalHtCents: number | null;
      totalTvaCents: number | null;
      totalTtcCents: number | null;
      factureRectifiee: string | null;
    }
  >
> {
  const out = new Map<
    string,
    {
      genre: string;
      regimeTva: "assujetti" | "franchise_293b";
      numeroTva: string | null;
      totalHtCents: number | null;
      totalTvaCents: number | null;
      totalTtcCents: number | null;
      factureRectifiee: string | null;
    }
  >();
  const ids = [...new Set(numeros.filter((n) => !!n))];
  if (ids.length === 0) return out;
  try {
    const l = await prisma.pieceAutofactureApporteur.findMany({
      where: { numero: { in: ids }, ...(apporteurId ? { apporteurId } : {}) },
      select: {
        numero: true,
        genre: true,
        regimeTva: true,
        numeroTva: true,
        totalHtCents: true,
        totalTvaCents: true,
        totalTtcCents: true,
        factureRectifiee: true,
      },
    });
    for (const p of l) out.set(p.numero, p);
  } catch {
    // Table absente : aucun régime figé, les appelants se replient sur la fiche.
  }
  return out;
}

/**
 * Le régime FIGÉ de chaque pièce, par numéro. Un numéro sans ligne (ou une table absente) n'est
 * PAS dans la carte : l'appelant se replie sur la fiche, c'est-à-dire sur le comportement d'avant.
 */
export async function regimesDesPieces(
  numeros: readonly string[],
  apporteurId?: string,
): Promise<Map<string, RegimeApporteur>> {
  const out = new Map<string, RegimeApporteur>();
  for (const [n, p] of await piecesFigees(numeros, apporteurId)) out.set(n, p.regimeTva);
  return out;
}

export interface PieceAFiger {
  numero: string;
  apporteurId: string;
  genre: GenrePiece;
  regimeTva: "assujetti" | "franchise_293b";
  numeroTva: string | null;
  totalHtCents: number | null;
  totalTvaCents: number | null;
  totalTtcCents: number | null;
  factureRectifiee?: string | null;
  emiseAt: Date;
  origine?: OriginePiece;
}

/**
 * Fige une pièce. Idempotent (un numéro ne se fige qu'une fois : `skipDuplicates`, jamais d'écrasement).
 * À appeler DANS la transaction d'émission : une écriture qui échoue fait échouer la transaction
 * (rien n'est émis, réessai) — il n'y a jamais de PDF sans pièce figée quand la table existe.
 */
export async function figerPiece(db: Db, p: PieceAFiger): Promise<void> {
  await db.pieceAutofactureApporteur.createMany({
    data: [
      {
        numero: p.numero,
        apporteurId: p.apporteurId,
        genre: p.genre,
        regimeTva: p.regimeTva,
        numeroTva: p.regimeTva === "assujetti" ? p.numeroTva : null,
        totalHtCents: p.totalHtCents,
        totalTvaCents: p.totalTvaCents,
        totalTtcCents: p.totalTtcCents,
        factureRectifiee: p.factureRectifiee ?? null,
        emiseAt: p.emiseAt,
        origine: p.origine ?? "emission",
      },
    ],
    skipDuplicates: true,
  });
}

/**
 * RATTRAPAGE idempotent : toute autofacture ou tout avoir déjà émis (numéro posé sur une ligne de
 * commission) mais sans pièce figée — émis par un ancien worker pendant la fenêtre de mise en ligne —
 * est figé au régime applicable au JOUR D'ÉMISSION. Limité à un apporteur si demandé (le changement de
 * régime fige d'abord, « au régime d'avant »). Rend le nombre de pièces créées ; 0 si la table manque.
 */
export async function figerPiecesManquantes(apporteurId?: string): Promise<number> {
  if (!(await piecesFigeesDisponible())) return 0;
  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      ...(apporteurId ? { apporteurId } : {}),
      OR: [{ autofactureNumero: { not: null } }, { avoirNumero: { not: null } }],
    },
    select: {
      apporteurId: true,
      autofactureNumero: true,
      avoirNumero: true,
      autofactureEmiseAt: true,
      majAt: true,
      palier: true,
    },
  });
  const voulues = new Map<
    string,
    { apporteurId: string; genre: GenrePiece; emiseAt: Date; origineId: string | null }
  >();
  for (const l of lignes) {
    const emiseAt = l.autofactureEmiseAt ?? l.majAt;
    if (l.autofactureNumero && !voulues.has(l.autofactureNumero))
      voulues.set(l.autofactureNumero, {
        apporteurId: l.apporteurId,
        genre: "facture",
        emiseAt,
        origineId: null,
      });
    if (l.avoirNumero && !voulues.has(l.avoirNumero))
      voulues.set(l.avoirNumero, {
        apporteurId: l.apporteurId,
        genre: "avoir",
        emiseAt,
        origineId: l.palier?.startsWith(PREFIXE_PALIER_REPRISE)
          ? l.palier.slice(PREFIXE_PALIER_REPRISE.length)
          : null,
      });
  }
  if (voulues.size === 0) return 0;
  const deja = await piecesFigees([...voulues.keys()]);
  // Un avoir prend le régime de l'autofacture qu'il rectifie : on retrouve son numéro par la reprise.
  const origineIds = [...new Set([...voulues.values()].map((v) => v.origineId).filter((x) => !!x))];
  const numeroOrigine = new Map<string, string>();
  if (origineIds.length > 0) {
    const os = await prisma.commissionApporteur.findMany({
      where: { id: { in: origineIds as string[] } },
      select: { id: true, autofactureNumero: true },
    });
    for (const o of os) if (o.autofactureNumero) numeroOrigine.set(o.id, o.autofactureNumero);
  }
  const figees = new Map<string, RegimeFige>();
  let n = 0;
  // Les autofactures d'abord : les avoirs lisent leur régime.
  const ordre = [...voulues].sort((a, b) =>
    a[1].genre === b[1].genre ? 0 : a[1].genre === "facture" ? -1 : 1,
  );
  for (const [numero, v] of ordre) {
    const existante = deja.get(numero);
    if (existante) {
      figees.set(numero, { regimeTva: existante.regimeTva, numeroTva: existante.numeroTva });
      continue;
    }
    let r = await regimeApplicableAu(v.apporteurId, jourParis(v.emiseAt));
    if (v.genre === "avoir" && v.origineId) {
      const num = numeroOrigine.get(v.origineId);
      const f = num ? (figees.get(num) ?? null) : null;
      const lue = num && !f ? (await piecesFigees([num])).get(num) : undefined;
      if (f) r = f;
      else if (lue) r = { regimeTva: lue.regimeTva, numeroTva: lue.numeroTva };
    }
    if (!r.regimeTva) continue; // régime inconnu : rien à figer, la pièce n'a pas pu être établie
    await figerPiece(prisma, {
      numero,
      apporteurId: v.apporteurId,
      genre: v.genre,
      regimeTva: r.regimeTva,
      numeroTva: r.numeroTva,
      totalHtCents: null,
      totalTvaCents: null,
      totalTtcCents: null,
      emiseAt: v.emiseAt,
      origine: "rattrapage",
    });
    figees.set(numero, r);
    n += 1;
  }
  return n;
}
