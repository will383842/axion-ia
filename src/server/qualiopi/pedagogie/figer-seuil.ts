/**
 * Lot L08 — fige le seuil de réussite dans le snapshot d'une session qui se crée.
 *
 * Éteint : le snapshot est rendu tel quel (rien ne change). Essai ou actif : le
 * seuil du réglage `seuil_reussite_pct` y est posé, une fois pour toutes.
 */

import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { lirePedagogie } from "./interrupteur";
import { figerSeuilDansSnapshot } from "./seuil-reussite";

export async function figerSeuilSiPedagogie<T extends object>(snapshot: T): Promise<T> {
  if ((await lirePedagogie()) === "eteint") return snapshot;
  return figerSeuilDansSnapshot(snapshot, await getQualiopiConfig("seuil_reussite_pct"));
}
