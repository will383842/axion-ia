/**
 * Relevé mensuel des apporteurs : numérotation `REL-AAAA-MM-NNNN[-Rk]` et création d'une ligne
 * sous verrou (lot 3c, plan § 6.1). Série DISTINCTE d'AXI-APP : un relevé n'est pas une facture.
 *
 *  - une transaction COURTE par relevé : verrou consultatif de transaction, lecture de la BORNE
 *    HAUTE des numéros du mois (jamais un comptage), `INSERT` ;
 *  - P2002 sur `(apporteur_id, periode, rang)` : déjà préparé, normal, compté ;
 *  - P2002 sur `numero` : ANOMALIE (impossible sous verrou) : remontée, jamais avalée.
 * Pas de `createMany({ skipDuplicates })`, qui avalerait aussi une collision de numéro.
 * Sans `server-only` (le worker l'atteint par `tsx`).
 */
import { prisma } from "@/lib/prisma";

import type { Prisma } from "../../../../prisma/generated/client";

export const CLE_VERROU_SERIE_RELEVE = "serie-releve-apporteur";
const SEQUENCE_MAX = 9999;

export const prefixeNumeroReleve = (periode: string): string => `REL-${periode}-`;

export function formaterNumeroReleve(periode: string, sequence: number, rang = 0): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > SEQUENCE_MAX) {
    throw new Error(`série des relevés : séquence hors limites (${sequence})`);
  }
  const base = `${prefixeNumeroReleve(periode)}${String(sequence).padStart(4, "0")}`;
  return rang > 0 ? `${base}-R${rang}` : base;
}

/** Séquence d'un numéro de la période (origine ou rectificatif), sinon `null`. */
export function sequenceDeNumeroReleve(numero: string, periode: string): number | null {
  const m = new RegExp(`^REL-${periode}-(\\d{4})(?:-R\\d+)?$`).exec(numero);
  return m ? Number(m[1]) : null;
}

/** Collision sur le NUMÉRO : impossible sous verrou, donc remontée telle quelle. */
export class CollisionNumeroReleve extends Error {
  constructor(numero: string) {
    super(`série des relevés : le numéro ${numero} existe déjà (anomalie, rien n'est ignoré)`);
    this.name = "CollisionNumeroReleve";
  }
}

export type CreationReleve =
  { statut: "cree"; id: string; numero: string } | { statut: "deja_prepare" };

type Cible = { target?: unknown } | undefined;

function p2002(err: unknown): { cible: string } | null {
  const e = err as { code?: string; meta?: Cible } | null;
  if (!e || e.code !== "P2002") return null;
  const t = e.meta?.target;
  return { cible: Array.isArray(t) ? t.join(",") : String(t ?? "") };
}

/**
 * Crée le relevé d'origine (rang 0) d'un apporteur pour la période. `donnees` ne porte NI `numero`
 * NI `rang` : ils sont posés ici, sous verrou.
 */
export async function creerReleveNumerote(
  periode: string,
  donnees: Omit<Prisma.ReleveMensuelApporteurUncheckedCreateInput, "numero" | "rang" | "periode">,
): Promise<CreationReleve> {
  let numeroTente = "";
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('serie-releve-apporteur'))`;
      const dernier = await tx.releveMensuelApporteur.findFirst({
        where: { numero: { startsWith: prefixeNumeroReleve(periode) }, rang: 0 },
        orderBy: { numero: "desc" },
        select: { numero: true },
      });
      const borne = (dernier && sequenceDeNumeroReleve(dernier.numero, periode)) || 0;
      numeroTente = formaterNumeroReleve(periode, borne + 1);
      const ligne = await tx.releveMensuelApporteur.create({
        data: { ...donnees, periode, rang: 0, numero: numeroTente },
        select: { id: true, numero: true },
      });
      return { statut: "cree" as const, id: ligne.id, numero: ligne.numero };
    });
  } catch (err) {
    const d = p2002(err);
    if (!d) throw err;
    if (d.cible.includes("numero")) throw new CollisionNumeroReleve(numeroTente);
    return { statut: "deja_prepare" };
  }
}
