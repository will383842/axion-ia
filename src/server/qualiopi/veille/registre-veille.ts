/**
 * 🔴 CHANTIER QNC, LOT L10 — le registre de veille tel qu'on le LIT (écran et
 * export PDF : un seul lecteur, pour qu'ils ne disent pas deux choses).
 *
 * Chaque ligne porte DEUX dates, côte à côte :
 *   - la date de l'INFORMATION (`dateVeille`, choisie par la personne qui saisit) ;
 *   - la date de SAISIE (`created_at`, posée par le serveur), affichée à l'heure
 *     de Paris. Pour une version issue d'une décision ou d'une correction, c'est
 *     la saisie de la PREMIÈRE version qui fait foi : une correction ne rajeunit
 *     pas une veille.
 *
 * Interrupteur `qualiopi.veille.actif` éteint : les lignes d'avant, plus la date
 * de saisie. Allumé : la décision et son auteur réel, la pièce modifiée et
 * l'archivage, relus au journal (`trace-veille.ts`).
 */

import { prisma } from "@/lib/prisma";
import type { VeilleType } from "../../../../prisma/generated/client";
import { versionInitiale, type TraceVeille } from "./trace-veille";
import { lireJournalVeilles, veilleTraceeActive } from "./regle-veille";

export interface LigneRegistreVeille {
  readonly id: string;
  readonly type: VeilleType;
  readonly source: string;
  readonly titre: string;
  readonly contenu: string;
  readonly impact: string | null;
  readonly actionDecidee: string | null;
  /** Date de l'information. */
  readonly dateVeille: Date;
  /** Date de saisie (serveur) de la première version. */
  readonly saisieLe: Date;
  /** Veille tracée seulement : la décision humaine. */
  readonly decision: {
    readonly par: string;
    readonly le: Date;
    readonly pieceModifiee: string;
  } | null;
  /** Veille tracée seulement : l'archivage (version remplacée ou entrée retirée). */
  readonly archivage: {
    readonly le: Date;
    readonly motif: string;
    readonly remplaceePar: string | null;
  } | null;
}

export interface RegistreVeille {
  /** L'interrupteur `qualiopi.veille.actif` vaut `actif`. */
  readonly tracee: boolean;
  readonly lignes: ReadonlyArray<LigneRegistreVeille>;
}

/** « 17/10/2026 à 00:30 » — l'heure de PARIS, jamais celle du conteneur. */
export function formatSaisieParis(d: Date | null | undefined): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "non datée";
  const jour = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  const heure = d.toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${jour} à ${heure}`;
}

type LigneBrute = {
  id: string;
  type: VeilleType;
  source: string;
  titre: string;
  contenu: string;
  impact: string | null;
  actionDecidee: string | null;
  dateVeille: Date;
  createdAt: Date;
};

/** Pure : assemble les lignes et le journal relu. */
export function assemblerRegistreVeille(
  brutes: ReadonlyArray<LigneBrute>,
  trace: TraceVeille | null,
  noms: ReadonlyMap<string, string>,
): LigneRegistreVeille[] {
  const parId = new Map(brutes.map((b) => [b.id, b]));
  return brutes.map((b) => {
    const initiale = trace !== null ? parId.get(versionInitiale(trace, b.id)) : undefined;
    const d = trace?.decisions.get(b.id);
    const a = trace?.archivees.get(b.id);
    return {
      id: b.id,
      type: b.type,
      source: b.source,
      titre: b.titre,
      contenu: b.contenu,
      impact: b.impact,
      actionDecidee: b.actionDecidee,
      dateVeille: b.dateVeille,
      saisieLe: initiale?.createdAt ?? b.createdAt,
      decision:
        d !== undefined
          ? {
              par: noms.get(d.decideurId) ?? "administrateur",
              le: d.decideLe,
              pieceModifiee: d.pieceModifiee,
            }
          : null,
      archivage:
        a !== undefined ? { le: a.le, motif: a.motif, remplaceePar: a.remplaceePar } : null,
    };
  });
}

type Client = {
  veille: Pick<typeof prisma.veille, "findMany">;
  setting: Pick<typeof prisma.setting, "findUnique">;
  activityLog: Pick<typeof prisma.activityLog, "findMany">;
  adminUser: Pick<typeof prisma.adminUser, "findMany">;
};

export async function lireRegistreVeille(
  options: { readonly take?: number } = {},
  client: Client = prisma,
): Promise<RegistreVeille> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return { tracee: false, lignes: [] };
  const brutes = await client.veille.findMany({
    select: {
      id: true,
      type: true,
      source: true,
      titre: true,
      contenu: true,
      impact: true,
      actionDecidee: true,
      dateVeille: true,
      createdAt: true,
    },
    orderBy: [{ dateVeille: "desc" }, { createdAt: "desc" }],
    take: options.take ?? 1000,
  });
  const tracee = await veilleTraceeActive(client);
  if (!tracee) return { tracee, lignes: assemblerRegistreVeille(brutes, null, new Map()) };

  const trace = await lireJournalVeilles(client as never);
  const ids = [...new Set([...trace.decisions.values()].map((d) => d.decideurId))];
  const admins =
    ids.length === 0
      ? []
      : await client.adminUser.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        });
  const noms = new Map(
    admins.map((a) => [
      a.id,
      typeof a.name === "string" && a.name.trim() !== "" ? a.name.trim() : "administrateur",
    ]),
  );
  return { tracee, lignes: assemblerRegistreVeille(brutes, trace, noms) };
}
