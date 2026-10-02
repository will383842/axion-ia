/**
 * BATTEMENT DE L'APPAREIL (`POST /api/enregistreur/appareil/battement`) et
 * « extension silencieuse » (PR 5).
 *
 * L'extension bat toutes les 5 minutes quand Chrome est ouvert : versions,
 * taille de sa file locale et âge du plus vieux morceau en attente. AUCUN nom,
 * AUCUN texte : rien qui vienne d'un rendez-vous.
 *
 * « Extension silencieuse » : un rendez-vous « Discutons » est en cours et
 * aucun appareil valide n'a battu depuis 10 minutes — Chrome fermé, extension
 * désactivée, ou jeton non collé. Une alerte technique le dit, sans nom.
 */

import type { PrismaClient } from "../../../prisma/generated/client";
import type { TBattementAppareil } from "@/lib/schemas/enregistreur";
import { estRendezVousDuDossier } from "./liste-blanche-types";
import { ok, type Resultat } from "./resultat";
import { versionAccepteePourVisio, type Appareil } from "./sessions";

/** Au-delà, un appareil est « silencieux ». Deux battements manqués. */
export const SILENCE_APPAREIL_MS = 600_000;

/** Âge du plus vieux morceau en attente au-delà duquel on alerte (plan §3.6, C5). */
export const ATTENTE_LOCALE_ALERTE_MS = 2 * 3_600_000;

export async function enregistrerBattementAppareil(
  db: Pick<PrismaClient, "appareilEnregistrement">,
  entree: {
    readonly appareil: Appareil;
    readonly corps: TBattementAppareil;
    readonly maintenant: Date;
  },
): Promise<Resultat> {
  await db.appareilEnregistrement.update({
    where: { id: entree.appareil.id },
    data: {
      dernierBattementLe: entree.maintenant,
      versionExtension: entree.corps.versionExtension.slice(0, 20),
    },
  });
  return ok({
    ok: true,
    attenteLocaleTropLongue:
      entree.corps.agePlusVieuxMs !== null &&
      entree.corps.agePlusVieuxMs > ATTENTE_LOCALE_ALERTE_MS,
    // V2, N2 — ajout facultatif au contrat v1 : cette copie ne peut plus
    // enregistrer de visio (le balayage alerte aussi, sur la version gardée).
    extensionTropAncienne: !versionAccepteePourVisio(entree.corps.versionExtension),
  });
}

/**
 * Vrai si un rendez-vous enregistrable est en cours et qu'aucun appareil
 * valide n'a battu depuis `SILENCE_APPAREIL_MS`. Décision PURE.
 */
export function extensionSilencieuse(
  entree: {
    readonly rendezVousEnCours: ReadonlyArray<{
      readonly eventTypeName: string;
      readonly linkedJobApplicationId: string | null;
    }>;
    readonly appareils: ReadonlyArray<{
      readonly dernierBattementLe: Date | null;
      readonly revoqueLe: Date | null;
    }>;
  },
  maintenant: Date,
): boolean {
  if (!entree.rendezVousEnCours.some((r) => estRendezVousDuDossier(r))) return false;
  // Un appareil est valide tant qu'il n'est pas révoqué : le jeton n'expire
  // plus (révision du 02/10).
  const valides = entree.appareils.filter((a) => a.revoqueLe === null);
  return !valides.some(
    (a) =>
      a.dernierBattementLe !== null &&
      maintenant.getTime() - a.dernierBattementLe.getTime() <= SILENCE_APPAREIL_MS,
  );
}
