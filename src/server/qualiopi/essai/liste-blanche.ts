/**
 * CHANTIER QNC, LOT L02 — LA LISTE BLANCHE DES ADRESSES D'ESSAI.
 *
 * Un e-mail qui concerne une session d'essai ne part QUE vers une adresse de
 * cette liste. Tout autre destinataire est bloqué et journalisé
 * (`sorties.ts`) : un essai joué avec l'adresse d'un vrai client ne doit pas
 * lui envoyer une convocation fictive.
 *
 * ## Où vit la liste
 *
 * Réglage `settings["qualiopi.essai.adresses_test"] = {"adresses": [...]}`,
 * modifiable depuis la console (`definirAdressesDEssai`, journalisé). Jamais
 * dans le dépôt, qui est public. Pas dans `QUALIOPI_CONFIG_REGISTRY` : le seed
 * y poserait une valeur à la place d'une personne.
 *
 * Absente, vide, mal formée ou illisible : la liste est VIDE, donc tout e-mail
 * d'essai est bloqué. L'échec se fait du côté qui ne sort rien.
 */

import { prisma } from "@/lib/prisma";
import { journaliser, type ClientJournal } from "@/server/journal/journaliser";

export const CLE_ADRESSES_ESSAI = "qualiopi.essai.adresses_test" as const;

/** Plafond : une liste blanche de test, pas un carnet d'adresses. */
export const MAX_ADRESSES_ESSAI = 20;

const ADRESSE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/** Forme comparable d'une adresse : sans espaces, en minuscules. */
export function normaliserAdresse(adresse: string): string {
  return adresse.trim().toLowerCase();
}

/** PURE — la valeur stockée → la liste (vide si mal formée). */
export function adressesDepuisValeur(valeur: unknown): ReadonlyArray<string> {
  if (valeur === null || typeof valeur !== "object" || Array.isArray(valeur)) return [];
  const brut = (valeur as { adresses?: unknown }).adresses;
  if (!Array.isArray(brut)) return [];
  const out = new Set<string>();
  for (const a of brut) {
    if (typeof a !== "string") continue;
    const n = normaliserAdresse(a);
    if (ADRESSE.test(n)) out.add(n);
  }
  return [...out];
}

/**
 * PURE — tous les destinataires sont-ils dans la liste ? Un seul hors liste
 * suffit à bloquer l'envoi entier : on ne découpe pas un e-mail.
 */
export function destinatairesAutorises(
  destinataires: ReadonlyArray<string>,
  liste: ReadonlyArray<string>,
): boolean {
  if (destinataires.length === 0) return false;
  const permis = new Set(liste.map(normaliserAdresse));
  return destinataires.every((d) => permis.has(normaliserAdresse(d)));
}

type ClientLecture = { setting: Pick<typeof prisma.setting, "findUnique"> };

/** La liste blanche. Ne lève jamais : illisible = vide = tout est bloqué. */
export async function lireAdressesDEssai(
  client: ClientLecture = prisma,
): Promise<ReadonlyArray<string>> {
  try {
    const ligne = await client.setting.findUnique({
      where: { key: CLE_ADRESSES_ESSAI },
      select: { value: true },
    });
    return adressesDepuisValeur(ligne?.value);
  } catch {
    return [];
  }
}

/** Erreur de saisie de la liste, à montrer telle quelle. */
export class ListeBlancheInvalide extends Error {}

/** PURE — valide une saisie (une adresse par ligne, virgule ou point-virgule). */
export function analyserSaisieAdresses(saisie: string): ReadonlyArray<string> {
  const entrees = saisie
    .split(/[\s,;]+/)
    .map(normaliserAdresse)
    .filter((a) => a !== "");
  const invalides = entrees.filter((a) => !ADRESSE.test(a));
  if (invalides.length > 0) {
    throw new ListeBlancheInvalide(`Adresse invalide : ${invalides.join(", ")}`);
  }
  const uniques = [...new Set(entrees)];
  if (uniques.length > MAX_ADRESSES_ESSAI) {
    throw new ListeBlancheInvalide(`Au plus ${MAX_ADRESSES_ESSAI} adresses d'essai.`);
  }
  return uniques;
}

type ClientEcriture = ClientJournal & {
  setting: Pick<typeof prisma.setting, "upsert">;
};

/**
 * Remplace la liste : réglage ET journal dans la même transaction, sans trace
 * pas de changement. Le journal ne porte que le NOMBRE d'adresses, jamais les
 * adresses elles-mêmes.
 */
export async function definirAdressesDEssai(
  entree: { readonly adresses: ReadonlyArray<string>; readonly adminUserId: string },
  client: {
    $transaction: <T>(fn: (tx: ClientEcriture) => Promise<T>) => Promise<T>;
  } = prisma as never,
): Promise<ReadonlyArray<string>> {
  const adresses = analyserSaisieAdresses(entree.adresses.join("\n"));
  return client.$transaction(async (tx) => {
    const value = { adresses: [...adresses] } as never;
    await tx.setting.upsert({
      where: { key: CLE_ADRESSES_ESSAI },
      create: {
        key: CLE_ADRESSES_ESSAI,
        value,
        description: "Chantier QNC › Mode essai : adresses autorisées pour les e-mails d'essai",
        updatedBy: entree.adminUserId,
      },
      update: { value, updatedBy: entree.adminUserId },
    });
    await journaliser(
      tx,
      {
        action: "qualiopi.essai.liste_blanche",
        targetType: "setting",
        changes: { cle: CLE_ADRESSES_ESSAI, nombre: adresses.length },
        session: { userId: entree.adminUserId },
      },
      { exiger: true },
    );
    return adresses;
  });
}
