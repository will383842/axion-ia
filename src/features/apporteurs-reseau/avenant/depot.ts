/**
 * Avenant 2.8 (#2512, lot S1) — dépôt de données de la table `apporteur_avenants`.
 *
 * Une seule ligne ACTIVE (propose | accepte | enregistre) par apporteur : garantie par un index unique partiel
 * SQL ; ce module en traduit le refus en erreur claire. Les transitions de statut sont limitées :
 *   propose → accepte | decline | retire      accepte → enregistre | retire
 * `decline`, `retire` et `enregistre` n'ont pas de suite autre que celle ci-dessus. `enregistreAt` (date d'effet)
 * est fixé une seule fois, à l'enregistrement.
 *
 * ⚠️ Aucun `server-only` (worker et scripts l'importent). Aucun nom ni donnée d'apporteur dans les journaux.
 */

import { prisma } from "@/lib/prisma";

export const STATUTS_AVENANT = ["propose", "accepte", "enregistre", "decline", "retire"] as const;
export type StatutAvenant = (typeof STATUTS_AVENANT)[number];

/** Statuts qui comptent comme « la ligne active » de l'apporteur. */
export const STATUTS_ACTIFS: readonly StatutAvenant[] = ["propose", "accepte", "enregistre"];

const TRANSITIONS: Readonly<Record<StatutAvenant, readonly StatutAvenant[]>> = {
  propose: ["accepte", "decline", "retire"],
  accepte: ["enregistre", "retire"],
  enregistre: [],
  decline: [],
  retire: [],
};

export function transitionAutorisee(de: StatutAvenant, vers: StatutAvenant): boolean {
  return TRANSITIONS[de].includes(vers);
}

export class AvenantErreur extends Error {
  constructor(
    readonly code: "deja_actif" | "transition_interdite" | "introuvable" | "ligne_changee",
    message: string,
  ) {
    super(message);
    this.name = "AvenantErreur";
  }
}

export type EntreeProposition = {
  apporteurId: string;
  versionCible: string;
  versionDepart: string;
  texteAvenant: string;
  texteAvenantSha256: string;
  texteContratSha256: string;
  /** Défaut : maintenant. */
  proposeAt?: Date;
};

/** La ligne active de l'apporteur, ou `null`. */
export async function avenantActif(apporteurId: string) {
  return prisma.apporteurAvenant.findFirst({
    where: { apporteurId, statut: { in: [...STATUTS_ACTIFS] } },
  });
}

/** Crée une proposition (statut `propose`). Refuse s'il existe déjà une ligne active. */
export async function creerProposition(e: EntreeProposition) {
  if (await avenantActif(e.apporteurId)) {
    throw new AvenantErreur("deja_actif", "Cet apporteur a déjà un avenant actif.");
  }
  const dernier = await prisma.apporteurAvenant.findFirst({
    where: { apporteurId: e.apporteurId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  try {
    return await prisma.apporteurAvenant.create({
      data: {
        apporteurId: e.apporteurId,
        numero: (dernier?.numero ?? 0) + 1,
        versionCible: e.versionCible,
        versionDepart: e.versionDepart,
        texteAvenant: e.texteAvenant,
        texteAvenantSha256: e.texteAvenantSha256,
        texteContratSha256: e.texteContratSha256,
        statut: "propose",
        ...(e.proposeAt ? { proposeAt: e.proposeAt } : {}),
      },
    });
  } catch (err) {
    // Course perdue contre l'index unique partiel (P2002).
    if ((err as { code?: unknown } | null)?.code === "P2002") {
      throw new AvenantErreur("deja_actif", "Cet apporteur a déjà un avenant actif.");
    }
    throw err;
  }
}

export type ChampsTransition = {
  /** Pour `accepte` : preuve (IP hachée, navigateur, cases). */
  preuve?: unknown;
  /** Pour `accepte`. */
  accepteAt?: Date;
  /** Pour `enregistre` : date d'effet. Défaut : maintenant. */
  enregistreAt?: Date;
  pdfCle?: string;
};

/**
 * Change le statut d'une ligne. La mise à jour est conditionnée au statut lu (aucune course ne passe deux fois),
 * et `enregistreAt` n'est jamais réécrit.
 */
export async function changerStatut(
  id: string,
  vers: StatutAvenant,
  champs: ChampsTransition = {},
) {
  const ligne = await prisma.apporteurAvenant.findUnique({ where: { id } });
  if (!ligne) throw new AvenantErreur("introuvable", "Avenant introuvable.");
  const de = ligne.statut as StatutAvenant;
  if (!transitionAutorisee(de, vers)) {
    throw new AvenantErreur("transition_interdite", `Transition interdite : ${de} → ${vers}.`);
  }
  const maintenant = new Date();
  const data: Record<string, unknown> = { statut: vers };
  if (vers === "accepte") {
    data.accepteAt = champs.accepteAt ?? maintenant;
    if (champs.preuve !== undefined) data.preuve = champs.preuve;
  }
  if (vers === "enregistre" && ligne.enregistreAt === null) {
    data.enregistreAt = champs.enregistreAt ?? maintenant;
  }
  if (champs.pdfCle !== undefined) data.pdfCle = champs.pdfCle;
  const r = await prisma.apporteurAvenant.updateMany({
    where: { id, statut: de, ...(vers === "enregistre" ? { enregistreAt: null } : {}) },
    data,
  });
  if (r.count !== 1) {
    throw new AvenantErreur(
      "ligne_changee",
      "L'avenant a changé entre-temps ; relire puis réessayer.",
    );
  }
  return prisma.apporteurAvenant.findUnique({ where: { id } });
}
