/**
 * Réseau d'apporteurs — la PERSONNE QUI A RENCONTRÉ l'entreprise (contrat 2.7, art. 3.2 et 3.7).
 *
 * Facultative : quand ce n'est pas l'apporteur lui-même (un associé, un salarié), la déclaration la
 * nomme ; à défaut, le contrat tient que c'est l'apporteur. Son nom peut être communiqué au prospect
 * (art. 3.2) : la prise de contact le cite, sans jamais dire qu'on vérifie quoi que ce soit.
 *
 * C'est le nom d'une personne : donnée personnelle, CHIFFRÉE (`encryptPii`) comme les autres noms
 * du réseau, rendue par l'export de l'apporteur et effacée avec sa fiche. Table séparée
 * `presentation_rencontre` (fenêtre app/worker) ; absente ou vide = l'apporteur lui-même.
 *
 * ⚠️ Module sans `server-only` : lu par la console et le worker.
 */

import { prisma } from "@/lib/prisma";
import { decryptPii, encryptPii } from "@/lib/pii-crypto";

import { signalerErreurReseau } from "./signaler";

export const PERSONNE_RENCONTRE_MAX = 150;

/** La table n'existe pas encore (migration pas jouée) : Prisma P2021. */
function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** Enregistre le nom (déclaration). Ne lève jamais : un échec est signalé, la déclaration tient. */
export async function enregistrerPersonneRencontre(
  presentationId: string,
  personne: string,
): Promise<void> {
  const nom = personne.trim().slice(0, PERSONNE_RENCONTRE_MAX);
  if (!nom) return;
  try {
    await prisma.presentationRencontre.create({
      data: { presentationId, personne: encryptPii(nom) },
    });
  } catch (err) {
    signalerErreurReseau(
      tableAbsente(err)
        ? "personne rencontrée : table absente, nom non enregistré"
        : "personne rencontrée : enregistrement",
      err,
    );
  }
}

/** Les noms (déchiffrés) des personnes rencontrées, par présentation. Vide si aucune. */
export async function lirePersonnesRencontrees(
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  try {
    const ls = await prisma.presentationRencontre.findMany({
      where: { presentationId: { in: [...new Set(ids)] } },
      select: { presentationId: true, personne: true },
    });
    const out = new Map<string, string>();
    for (const l of ls) {
      const nom = decryptPii(l.personne);
      if (nom) out.set(l.presentationId, nom);
    }
    return out;
  } catch (err) {
    if (!tableAbsente(err)) signalerErreurReseau("personne rencontrée : lecture", err);
    return new Map();
  }
}
