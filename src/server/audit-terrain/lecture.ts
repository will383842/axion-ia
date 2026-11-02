/**
 * Audit présentiel (PR3) : lecture pour l'écran « Audit » de la console (super_admin seulement,
 * contrôlé par l'appelant). Lecture seule. Les contenus chiffrés passent par `dechiffrerParole` ;
 * un contenu qui ne se déchiffre pas est compté « illisible », sans jamais journaliser ni valeur ni message.
 */
import { prisma } from "@/lib/prisma";
import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { construireVueAudit, type EvenementLu, type SessionLue, type VueAudit } from "./vue";

export interface RapportLu {
  readonly id: string;
  readonly version: number;
  readonly source: string;
  readonly statut: string;
  readonly creeLe: Date;
  readonly valideLe: Date | null;
  /** `null` : brouillon illisible. */
  readonly contenu: unknown;
  readonly lisible: boolean;
}

export interface RefusLu {
  readonly le: Date;
  readonly rejetes: number;
  /** Motifs conservés par la réception (`trop_gros`, `limite_session`…) ; vide si non conservés. */
  readonly motifs: ReadonlyArray<string>;
}

export interface EcranAudit {
  readonly refus: ReadonlyArray<RefusLu>;
  readonly sessions: ReadonlyArray<SessionLue>;
  readonly courante: SessionLue | null;
  readonly vue: VueAudit | null;
  readonly rapport: RapportLu | null;
}

const MAX_EVENEMENTS = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lireJson(chiffre: string): { ok: true; valeur: unknown } | { ok: false } {
  try {
    return { ok: true, valeur: JSON.parse(dechiffrerParole(chiffre)) as unknown };
  } catch {
    return { ok: false };
  }
}

export async function lireEcranAudit(
  clientId: string,
  sessionVoulue?: string,
): Promise<EcranAudit> {
  const sessions = await prisma.auditTerrainSession.findMany({
    where: { clientId },
    orderBy: { creeLe: "desc" },
    take: 20,
    select: {
      id: true,
      statut: true,
      jetonExpireLe: true,
      jetonRevoqueLe: true,
      dernierSeq: true,
      derniereEtapeIndex: true,
      dernierEnvoiLe: true,
      creeLe: true,
    },
  });
  const courante =
    (sessionVoulue !== undefined && UUID.test(sessionVoulue)
      ? sessions.find((s) => s.id === sessionVoulue)
      : undefined) ??
    sessions[0] ??
    null;
  if (courante === null) return { sessions, courante: null, vue: null, rapport: null, refus: [] };

  const lignes = await prisma.auditTerrainEvenement.findMany({
    where: { sessionId: courante.id },
    orderBy: { seq: "asc" },
    take: MAX_EVENEMENTS,
    select: {
      seq: true,
      type: true,
      etape: true,
      etapeIndex: true,
      heurePc: true,
      recuLe: true,
      donneesChiffrees: true,
    },
  });
  const evenements: EvenementLu[] = lignes.map((l) => {
    const j = lireJson(l.donneesChiffrees);
    const donnees =
      j.ok && j.valeur !== null && typeof j.valeur === "object" && !Array.isArray(j.valeur)
        ? (j.valeur as Record<string, unknown>)
        : null;
    return {
      seq: l.seq,
      type: l.type,
      etape: l.etape,
      etapeIndex: l.etapeIndex,
      heurePc: l.heurePc,
      recuLe: l.recuLe,
      donnees,
    };
  });

  const r = await prisma.auditTerrainRapport.findFirst({
    where: { sessionId: courante.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      source: true,
      statut: true,
      creeLe: true,
      valideLe: true,
      contenuChiffre: true,
    },
  });
  let rapport: RapportLu | null = null;
  if (r !== null) {
    const j = lireJson(r.contenuChiffre);
    rapport = {
      id: r.id,
      version: r.version,
      source: r.source,
      statut: r.statut,
      creeLe: r.creeLe,
      valideLe: r.valideLe,
      contenu: j.ok ? j.valeur : null,
      lisible: j.ok,
    };
  }
  // Refus (plafond atteint, événement trop gros) : lus dans le journal d'accès de la réception, sans contenu.
  const journal = await prisma.activityLog.findMany({
    where: { action: "audit-terrain.reception", targetId: courante.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { createdAt: true, changes: true },
  });
  const refus: RefusLu[] = [];
  for (const j of journal) {
    const c = (j.changes ?? {}) as Record<string, unknown>;
    const motifs = Array.isArray(c["motifs"])
      ? c["motifs"].filter((m): m is string => typeof m === "string").slice(0, 10)
      : c["statut"] === 413
        ? ["trop_gros"]
        : c["statut"] === 409
          ? ["limite_session"]
          : [];
    const rejetes = typeof c["rejetes"] === "number" ? c["rejetes"] : motifs.length;
    if (rejetes > 0 || motifs.length > 0) refus.push({ le: j.createdAt, rejetes, motifs });
  }
  return { sessions, courante, vue: construireVueAudit(courante, evenements), rapport, refus };
}
