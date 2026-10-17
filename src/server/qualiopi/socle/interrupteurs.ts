/**
 * 🔴 CHANTIER QNC, LOT L00 — LE MODULE D'INTERRUPTEURS UNIQUE `qualiopi.*`.
 *
 * Chaque lot du chantier se livre éteint derrière SA clé `qualiopi.<lot>.actif`
 * (table `settings`, calque des interrupteurs formateurs). Trois valeurs :
 *   - `eteint` : le lot ne fait rien. Clé ABSENTE = éteint, valeur inconnue ou
 *     mal formée = éteint, base injoignable = éteint ;
 *   - `essai`  : le lot n'agit que sur les sessions (ou inscriptions) marquées
 *     `estTestInterne` — le banc d'essai (ADR 0061) ;
 *   - `actif`  : le lot agit pour tous.
 *
 * ⚠️ Ces clés ne vont PAS dans `QUALIOPI_CONFIG_REGISTRY` (site_settings) : le
 * seed de démarrage y écrit une valeur par défaut pour chaque clé déclarée, et
 * aurait donc posé l'interrupteur à la place d'une personne.
 *
 * Chaque bascule écrit, dans la MÊME transaction, le réglage et sa ligne
 * `activity_logs` (qui, quand, avant, après) — `exiger: true` : sans trace,
 * pas de bascule. La forme stockée, `{"etat": …}`, est aussi celle que lit la
 * fonction SQL `qualiopi_interrupteur_etat` (migration du socle) : les deux
 * lecteurs ne doivent jamais diverger.
 *
 * Aucune interface ici : ce lot ne pose que le mécanisme. Le lot qui ajoute
 * une console de bascule appellera `basculerInterrupteurQualiopi`.
 */

import { prisma } from "@/lib/prisma";
import { journaliser, type ClientJournal } from "@/server/journal/journaliser";

export const ETATS_INTERRUPTEUR = ["eteint", "essai", "actif"] as const;

export type EtatInterrupteur = (typeof ETATS_INTERRUPTEUR)[number];

export const PREFIXE_INTERRUPTEURS_QUALIOPI = "qualiopi." as const;

/** Un lot : minuscules, chiffres, soulignés (`l03`, `veille`, `amelioration`). */
const LOT_VALIDE = /^[a-z0-9_]{1,40}$/;

/** `qualiopi.<lot>.actif`. Lève pour un lot mal formé : une faute de frappe n'invente pas de clé. */
export function cleInterrupteurQualiopi(lot: string): string {
  if (!LOT_VALIDE.test(lot)) {
    throw new TypeError(`Interrupteur qualiopi : lot invalide « ${lot} ».`);
  }
  return `${PREFIXE_INTERRUPTEURS_QUALIOPI}${lot}.actif`;
}

export function estEtatInterrupteur(v: unknown): v is EtatInterrupteur {
  return typeof v === "string" && (ETATS_INTERRUPTEUR as ReadonlyArray<string>).includes(v);
}

/** Pure : la valeur stockée → l'état. Tout ce qui n'est pas reconnu vaut `eteint`. */
export function etatDepuisValeur(valeur: unknown): EtatInterrupteur {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) return "eteint";
  const etat = (valeur as { etat?: unknown }).etat;
  return estEtatInterrupteur(etat) ? etat : "eteint";
}

/** Pure : l'état → la valeur stockée. */
export function valeurDepuisEtat(etat: EtatInterrupteur): { etat: EtatInterrupteur } {
  return { etat };
}

/**
 * Pure : le lot agit-il sur CETTE cible ? En `essai`, seulement sur une cible
 * du banc d'essai ; sans cible (traitement qui ne porte sur aucune session),
 * `essai` n'agit pas.
 */
export function estActifPour(
  etat: EtatInterrupteur,
  cible: { readonly estTestInterne: boolean } | null,
): boolean {
  if (etat === "actif") return true;
  if (etat === "essai") return cible?.estTestInterne === true;
  return false;
}

type ClientLecture = { setting: Pick<typeof prisma.setting, "findUnique"> };

/**
 * L'état d'un interrupteur. Ne lève jamais : une erreur de lecture (table
 * absente, base injoignable, build `stub.invalid` qui rend `null`) vaut `eteint`.
 */
export async function lireInterrupteurQualiopi(
  lot: string,
  client: ClientLecture = prisma,
): Promise<EtatInterrupteur> {
  const key = cleInterrupteurQualiopi(lot);
  try {
    const ligne = await client.setting.findUnique({ where: { key }, select: { value: true } });
    return etatDepuisValeur(ligne?.value);
  } catch {
    return "eteint";
  }
}

export interface Bascule {
  readonly cle: string;
  readonly avant: EtatInterrupteur;
  readonly apres: EtatInterrupteur;
}

type ClientBascule = ClientJournal & {
  $executeRaw: typeof prisma.$executeRaw;
  setting: Pick<typeof prisma.setting, "findUnique" | "upsert">;
};

/**
 * Bascule un interrupteur : réglage ET journal dans une seule transaction.
 * Le verrou consultatif sérialise deux bascules croisées : la seconde relit
 * l'état laissé par la première, et son « avant » est juste.
 */
export async function basculerInterrupteurQualiopi(
  entree: { readonly lot: string; readonly etat: EtatInterrupteur; readonly adminUserId: string },
  client: {
    $transaction: <T>(fn: (tx: ClientBascule) => Promise<T>) => Promise<T>;
  } = prisma as never,
): Promise<Bascule> {
  const key = cleInterrupteurQualiopi(entree.lot);
  if (!estEtatInterrupteur(entree.etat)) {
    throw new TypeError(`Interrupteur qualiopi : état invalide « ${String(entree.etat)} ».`);
  }
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('qualiopi.interrupteurs'))`;
    const actuelle = await tx.setting.findUnique({ where: { key }, select: { value: true } });
    const avant = etatDepuisValeur(actuelle?.value);
    const value = valeurDepuisEtat(entree.etat) as never;
    await tx.setting.upsert({
      where: { key },
      create: {
        key,
        value,
        description: `Chantier QNC › Interrupteur du lot « ${entree.lot} » (eteint / essai / actif)`,
        updatedBy: entree.adminUserId,
      },
      update: { value, updatedBy: entree.adminUserId },
    });
    await journaliser(
      tx,
      {
        action: "qualiopi.interrupteur_bascule",
        // ⚠️ Pas de `targetId` : colonne `uuid`, la clé est du texte (cf. le
        // défaut des interrupteurs formateurs, prod 2026-10-10).
        targetType: "setting",
        changes: { cle: key, avant, apres: entree.etat },
        session: { userId: entree.adminUserId },
      },
      { exiger: true },
    );
    return { cle: key, avant, apres: entree.etat };
  });
}
