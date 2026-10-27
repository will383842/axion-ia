/**
 * Export COMPLET des réponses d'un questionnaire avant audit (2026-10-27) — LECTURE SEULE.
 *
 * Une copie de sécurité lisible, que le super-administrateur peut garder en lieu sûr : toutes les
 * réponses (déchiffrées) et tous les brouillons du questionnaire, en JSON. Sans cette copie, tout
 * dépend de la clé `PII_ENCRYPTION_KEY` et de la sauvegarde de la base.
 *
 *   · interrupteur `QUESTIONNAIRE_EXPORT_COMPLET_ENABLED` : ABSENT = ÉTEINT, seule la valeur
 *     exacte "true" l'allume ;
 *   · ⛔ le code du dirigeant (il ouvre son brouillon) est remplacé par `CODE_DIRIGEANT_MASQUE`
 *     dans les colonnes `membre`, dans `charge.membre` et partout où une valeur entière est ce code ;
 *   · une réponse mise à l'écart (demande d'effacement) n'est PAS déchiffrée : `charge: null` ;
 *   · l'empreinte (SHA-256) porte sur les réponses et les brouillons seulement : deux appels sur les
 *     mêmes données rendent la même empreinte, et une copie conservée se vérifie ;
 *   · aucune écriture ici. La trace de l'export (qui, quand, quoi — sans contenu) est écrite par la
 *     route, AVANT de rendre quoi que ce soit.
 */

import { createHash } from "node:crypto";

import { dechiffrerParole } from "@/lib/chiffrer-parole";
import { prisma } from "@/lib/prisma";
import { codeDirigeantPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import type { PrismaClient } from "../../../prisma/generated/client";

import { CODE_DIRIGEANT_MASQUE } from "./lecture";

type Env = Readonly<Record<string, string | undefined>>;

export const exportCompletActif = (env: Env = process.env): boolean =>
  env["QUESTIONNAIRE_EXPORT_COMPLET_ENABLED"] === "true";

type BaseExport = Pick<
  PrismaClient,
  | "questionnaireAvantAudit"
  | "questionnaireAvantAuditEnvoi"
  | "questionnaireAvantAuditBrouillon"
>;

export interface ReponseExportee {
  readonly id: string;
  readonly mode: string;
  readonly membre: string | null;
  readonly recuLe: string;
  readonly ecarteLe: string | null;
  readonly charge: unknown;
  readonly illisible?: true;
}

export interface BrouillonExporte {
  readonly id: string;
  readonly mode: string;
  readonly membre: string;
  readonly majLe: string;
  readonly horodatage: string;
  readonly instantane: unknown;
  readonly illisible?: true;
}

export interface ExportComplet {
  readonly questionnaire: {
    readonly id: string;
    readonly ref: string;
    readonly envoyeLe: string | null;
    readonly expireLe: string | null;
    readonly closLe: string | null;
  };
  readonly reponses: ReadonlyArray<ReponseExportee>;
  readonly brouillons: ReadonlyArray<BrouillonExporte>;
  readonly comptes: {
    readonly reponses: number;
    readonly ecartees: number;
    readonly illisibles: number;
    readonly brouillons: number;
  };
  readonly genereLe: string;
  readonly empreinte: string;
}

const CODE = /^[A-Za-z0-9_-]{12,60}$/;
const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

/** Remplace, partout, une valeur entière qui est le code du dirigeant. */
function masquer(v: unknown, estCodeDirigeant: (m: string) => boolean): unknown {
  if (typeof v === "string") return CODE.test(v) && estCodeDirigeant(v) ? CODE_DIRIGEANT_MASQUE : v;
  if (Array.isArray(v)) return v.map((x) => masquer(x, estCodeDirigeant));
  if (typeof v === "object" && v !== null) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, masquer(x, estCodeDirigeant)]),
    );
  }
  return v;
}

function lire(valeur: string, estCodeDirigeant: (m: string) => boolean): unknown | undefined {
  try {
    return masquer(JSON.parse(dechiffrerParole(valeur)), estCodeDirigeant);
  } catch {
    return undefined; // clé absente ou valeur illisible
  }
}

/** Le questionnaire, ses réponses et ses brouillons, ou `null` s'il n'existe pas. */
export async function exporterQuestionnaireComplet(
  questionnaireId: string,
  base: BaseExport = prisma,
  maintenant: Date = new Date(),
): Promise<ExportComplet | null> {
  const q = await base.questionnaireAvantAudit.findUnique({
    where: { id: questionnaireId },
    select: { id: true, ref: true, envoyeLe: true, expireLe: true, closLe: true },
  });
  if (q === null) return null;
  const [envois, brouillons] = await Promise.all([
    base.questionnaireAvantAuditEnvoi.findMany({
      where: { questionnaireId },
      orderBy: [{ recuLe: "asc" }, { id: "asc" }],
      select: { id: true, mode: true, membre: true, recuLe: true, ecarteLe: true, donnees: true },
    }),
    base.questionnaireAvantAuditBrouillon.findMany({
      where: { questionnaireId },
      orderBy: [{ majLe: "asc" }, { id: "asc" }],
      select: { id: true, mode: true, membre: true, majLe: true, horodatage: true, donnees: true },
    }),
  ]);
  const estCode = (m: string): boolean => codeDirigeantPreauditValide(questionnaireId, m);
  const masqueMembre = (m: string): string =>
    CODE.test(m) && estCode(m) ? CODE_DIRIGEANT_MASQUE : m;

  let ecartees = 0;
  let illisibles = 0;
  const reponses: ReponseExportee[] = envois.map((e) => {
    const base0 = {
      id: e.id,
      mode: e.mode,
      membre: e.membre === null ? null : masqueMembre(e.membre),
      recuLe: e.recuLe.toISOString(),
      ecarteLe: iso(e.ecarteLe),
    };
    if (e.ecarteLe !== null) {
      ecartees++;
      return { ...base0, charge: null };
    }
    const charge = lire(e.donnees, estCode);
    if (charge === undefined) {
      illisibles++;
      return { ...base0, charge: null, illisible: true as const };
    }
    return { ...base0, charge };
  });
  const bs: BrouillonExporte[] = brouillons.map((b) => {
    const base0 = {
      id: b.id,
      mode: b.mode,
      membre: masqueMembre(b.membre),
      majLe: b.majLe.toISOString(),
      horodatage: b.horodatage.toISOString(),
    };
    const instantane = lire(b.donnees, estCode);
    if (instantane === undefined) {
      illisibles++;
      return { ...base0, instantane: null, illisible: true as const };
    }
    return { ...base0, instantane };
  });

  return {
    questionnaire: {
      id: q.id,
      ref: q.ref,
      envoyeLe: iso(q.envoyeLe),
      expireLe: iso(q.expireLe),
      closLe: iso(q.closLe),
    },
    reponses,
    brouillons: bs,
    comptes: { reponses: reponses.length, ecartees, illisibles, brouillons: bs.length },
    genereLe: maintenant.toISOString(),
    empreinte: createHash("sha256")
      .update(JSON.stringify({ reponses, brouillons: bs }))
      .digest("hex"),
  };
}
