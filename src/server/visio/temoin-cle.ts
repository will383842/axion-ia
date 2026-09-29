/**
 * TÉMOIN DE CLÉ de chiffrement (chantier visio, ADR 0056 ; PR 5).
 *
 * Le son est chiffré par le SITE (route des morceaux) et sera déchiffré par le
 * WORKER (transcription, PR 6). Si `PII_ENCRYPTION_KEY` diffère entre les deux
 * conteneurs, tout ce que le site dépose est illisible par le worker — et on ne
 * le découvrirait qu'au premier compte rendu, le son d'un vrai appel perdu.
 *
 * D'où une ligne témoin :
 *   · le SITE l'écrit (chiffrée) à la première requête de l'enregistreur, puis
 *     vérifie à chaque requête qu'il sait la relire — sinon 503 : aucune
 *     requête acceptée avec une clé absente ou différente ;
 *   · le WORKER la déchiffre au démarrage et à chaque balayage
 *     (`verifierTemoinCleWorker`) et en date le succès dans
 *     `battements_circuit.temoin_cle_ok_le` : la console montre la ligne rouge.
 *
 * Stockage : table `settings` existante (clé `visio.temoin-cle`), aucune
 * migration. Le témoin ne contient AUCUNE donnée : une phrase fixe, chiffrée.
 *
 * Module sans `server-only` : il est lu par le worker.
 */

import type { Prisma, PrismaClient } from "../../../prisma/generated/client";
import { chiffrerParole, dechiffrerParole } from "@/lib/chiffrer-parole";

export const CLE_REGLAGE_TEMOIN = "visio.temoin-cle";

/** La phrase fixe chiffrée. Changer ce texte invalide les témoins écrits. */
export const TEXTE_TEMOIN = "temoin-de-cle-visio-v1";

/** Nom de la ligne de `battements_circuit` tenue par le worker. */
export const BATTEMENT_TEMOIN = "temoin-cle";

export type EtatTemoin =
  | { readonly ok: true }
  | { readonly ok: false; readonly raison: "cle_absente" | "cle_differente" | "illisible" };

type DbReglage = Pick<PrismaClient, "setting">;

function lireChiffre(valeur: Prisma.JsonValue | undefined): string | null {
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) return null;
  const chiffre = (valeur as Record<string, unknown>)["chiffre"];
  return typeof chiffre === "string" ? chiffre : null;
}

/** Relit le témoin. Aucune écriture. */
export async function lireTemoinCle(db: DbReglage): Promise<EtatTemoin | "absent"> {
  const ligne = await db.setting.findUnique({ where: { key: CLE_REGLAGE_TEMOIN } });
  if (!ligne) return "absent";
  const chiffre = lireChiffre(ligne.value);
  if (chiffre === null) return { ok: false, raison: "illisible" };
  try {
    return dechiffrerParole(chiffre) === TEXTE_TEMOIN
      ? { ok: true }
      : { ok: false, raison: "cle_differente" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return {
      ok: false,
      raison: message.includes("PII_ENCRYPTION_KEY") ? "cle_absente" : "cle_differente",
    };
  }
}

// Le site vérifie le témoin à chaque requête ; un succès est gardé 10 minutes
// en mémoire (une requête de morceau toutes les 10 s n'a pas à relire la base).
const DUREE_CACHE_MS = 600_000;
let dernierSuccesLe = 0;

/** Pour les tests seulement. */
export function oublierTemoinEnCache(): void {
  dernierSuccesLe = 0;
}

/**
 * Côté SITE : le témoin existe et se relit avec la clé de ce conteneur. Écrit
 * le témoin s'il manque. Rend `ok: false` si la clé manque ou diffère.
 */
export async function assurerTemoinCle(
  db: DbReglage,
  maintenant: Date = new Date(),
): Promise<EtatTemoin> {
  if (maintenant.getTime() - dernierSuccesLe < DUREE_CACHE_MS) return { ok: true };

  const lu = await lireTemoinCle(db);
  if (lu !== "absent") {
    if (lu.ok) dernierSuccesLe = maintenant.getTime();
    return lu;
  }

  let chiffre: string;
  try {
    chiffre = chiffrerParole(TEXTE_TEMOIN);
  } catch {
    return { ok: false, raison: "cle_absente" };
  }
  // `upsert` sans mise à jour : deux requêtes simultanées n'écrasent pas un
  // témoin écrit entre-temps (le second relit le premier).
  await db.setting.upsert({
    where: { key: CLE_REGLAGE_TEMOIN },
    create: {
      key: CLE_REGLAGE_TEMOIN,
      value: { chiffre, ecritLe: maintenant.toISOString() },
      description: "Témoin de clé du circuit visio (aucune donnée : une phrase fixe chiffrée).",
    },
    update: {},
  });
  const relu = await lireTemoinCle(db);
  if (relu !== "absent" && relu.ok) {
    dernierSuccesLe = maintenant.getTime();
    return relu;
  }
  return relu === "absent" ? { ok: false, raison: "illisible" } : relu;
}

type DbWorker = Pick<PrismaClient, "setting" | "battementCircuit">;

/**
 * Côté WORKER : déchiffre le témoin et date le succès. Ne l'écrit jamais (seul
 * le site écrit : c'est SA clé qui sert de référence). Rend l'état, pour que
 * l'appelant n'ouvre pas la file de transcription sur une clé fausse.
 */
export async function verifierTemoinCleWorker(
  db: DbWorker,
  entree: { readonly maintenant: Date; readonly drapeauBrut: string; readonly version: string },
): Promise<EtatTemoin | "absent"> {
  const etat = await lireTemoinCle(db);
  const ok = etat !== "absent" && etat.ok;
  await db.battementCircuit.upsert({
    where: { nom: BATTEMENT_TEMOIN },
    create: {
      nom: BATTEMENT_TEMOIN,
      dernierLe: entree.maintenant,
      drapeauVuParWorker: entree.drapeauBrut.slice(0, 10),
      temoinCleOkLe: ok ? entree.maintenant : null,
      version: entree.version.slice(0, 40),
    },
    update: {
      dernierLe: entree.maintenant,
      drapeauVuParWorker: entree.drapeauBrut.slice(0, 10),
      version: entree.version.slice(0, 40),
      ...(ok ? { temoinCleOkLe: entree.maintenant } : {}),
    },
  });
  return etat;
}
