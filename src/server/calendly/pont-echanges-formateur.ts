/**
 * U7-f — les échanges formateur réservés PENDANT LE PONT (lot F-CAL-2, scénario E37).
 *
 * Avant la mise en service du suivi, Will a envoyé à la main, depuis le composeur, le lien
 * `/fr/appel/formateur-independant?depuis=fa-<id>`. Les échanges réservés ainsi n'ont été
 * rattachés à rien. Cette relecture, déclenchée par un humain après l'allumage de
 * `formateurs.suivi_echange` :
 *   1. FIGE la liste datée des échanges formateur depuis le 13/10 (identifiants triés et
 *      leur empreinte, au journal — jamais un nom ni une adresse) ;
 *   2. relit chaque échange NON RATTACHÉ par l'enrichissement normal, qui interroge l'API
 *      Calendly : le marqueur `fa-<id>` et l'adresse viennent ainsi de Calendly, jamais de
 *      la colonne qu'une route publique peut avoir remplie ; le nom seul ne rattache rien ;
 *   3. relit la liste et la compare : chaque échange a une candidature et une issue, ou une
 *      ligne « à trancher » / « à vérifier ».
 *
 * L'e-mail F5 (« la suite », avec le lien du dossier) n'est PAS envoyé ici : il part par
 * l'issue « Retenu », après aperçu, quand le dossier en ligne existe (lot L5).
 */

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

import { SEULS_ECHANGES_FORMATEUR } from "./rappels-echange-formateur";

/** Le 13/10/2026, 0 h, heure de Paris : premier jour où le lien formateur a pu partir. */
export const DEBUT_DU_PONT = new Date("2026-10-12T22:00:00.000Z");

/** Au plus 50 relectures par geste (une requête à l'API Calendly chacune). */
export const PLAFOND_RELECTURES_PONT = 50;

export type EtatEchangePont = "a_verifier" | "a_trancher" | "issue_notee" | "a_venir" | "annule";

export interface EchangeDuPont {
  readonly id: string;
  readonly debut: Date | null;
  readonly candidatureId: string | null;
  readonly etat: EtatEchangePont;
}

/** L'état d'un échange du pont, à partir de ce qui est en base. Pur. */
export function etatEchangePont(
  e: {
    readonly status: string;
    readonly startTime: Date | null;
    readonly linkedJobApplicationId: string | null;
    readonly aUnPoint: boolean;
  },
  maintenant: Date,
): EtatEchangePont {
  if (e.status === "canceled") return "annule";
  if (!e.linkedJobApplicationId) return "a_verifier";
  if (e.aUnPoint) return "issue_notee";
  if (e.startTime && e.startTime > maintenant) return "a_venir";
  return "a_trancher";
}

export async function listerEchangesDuPont(maintenant: Date): Promise<EchangeDuPont[]> {
  const lignes = await prisma.calendlyEvent.findMany({
    where: { capturedAt: { gte: DEBUT_DU_PONT }, AND: [SEULS_ECHANGES_FORMATEUR] },
    orderBy: { capturedAt: "asc" },
    take: 500,
    select: {
      id: true,
      status: true,
      startTime: true,
      linkedJobApplicationId: true,
      suivi: { select: { id: true } },
    },
  });
  return lignes.map((l) => ({
    id: l.id,
    debut: l.startTime,
    candidatureId: l.linkedJobApplicationId,
    etat: etatEchangePont(
      {
        status: l.status,
        startTime: l.startTime,
        linkedJobApplicationId: l.linkedJobApplicationId,
        aUnPoint: l.suivi !== null,
      },
      maintenant,
    ),
  }));
}

/** L'empreinte d'une liste figée : ses identifiants triés. Aucune donnée personnelle. */
export function empreinteListe(ids: readonly string[]): string {
  return createHash("sha256")
    .update([...ids].sort().join("\n"))
    .digest("hex");
}

export interface BilanPont {
  readonly avant: {
    readonly nombre: number;
    readonly empreinte: string;
    readonly aVerifier: number;
  };
  readonly apres: {
    readonly nombre: number;
    readonly aVerifier: number;
    readonly aTrancher: number;
  };
  readonly relus: number;
  readonly rattaches: number;
  readonly plafondAtteint: boolean;
}

/**
 * Relit les échanges du pont non rattachés. `relire` est l'enrichissement normal
 * (`enrichCalendlyEvent`), injecté pour le banc.
 */
export async function relireEchangesDuPont(
  maintenant: Date,
  relire: (eventId: string) => Promise<unknown>,
): Promise<BilanPont> {
  const avant = await listerEchangesDuPont(maintenant);
  const aRelire = avant.filter((e) => e.etat === "a_verifier");
  const lot = aRelire.slice(0, PLAFOND_RELECTURES_PONT);
  for (const e of lot) {
    try {
      await relire(e.id);
    } catch {
      // Une relecture ratée laisse la ligne « à vérifier » : elle reste visible.
    }
  }
  const apres = await listerEchangesDuPont(maintenant);
  const restants = new Set(apres.filter((e) => e.etat === "a_verifier").map((e) => e.id));
  return {
    avant: {
      nombre: avant.length,
      empreinte: empreinteListe(avant.map((e) => e.id)),
      aVerifier: aRelire.length,
    },
    apres: {
      nombre: apres.length,
      aVerifier: restants.size,
      aTrancher: apres.filter((e) => e.etat === "a_trancher").length,
    },
    relus: lot.length,
    rattaches: lot.filter((e) => !restants.has(e.id)).length,
    plafondAtteint: aRelire.length > lot.length,
  };
}
