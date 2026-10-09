/**
 * EFFACEMENT MANUEL d'un dossier candidat — les fichiers qu'il a RENVOYÉS
 * par son lien (Candidatures unifiées L5b, RGPD art. 17).
 *
 * Un fichier renvoyé (`origine = personne`) est rattaché à son lien par
 * `lien_depot_id`, SANS clé étrangère : la cascade qui emporte les liens à la
 * suppression du dossier ne l'atteint pas. Cette fonction l'efface, objet du
 * stockage compris, et doit être appelée AVANT la suppression du dossier (après,
 * ses liens n'existent plus et le fichier serait introuvable).
 *
 * ⛔ Ce n'est PAS une purge : seuls les deux chemins d'effacement MANUEL
 * l'appellent — la suppression d'une candidature depuis la console et la
 * demande d'effacement de la personne (`candidature-rgpd.ts`). Aucune tâche
 * automatique.
 *
 * Ordre : l'objet d'abord, la ligne ensuite. Un objet ou un envoi DÉJÀ absent
 * du stockage (`NoSuchUpload`, `NoSuchKey`, 404) compte comme effacé. Si le
 * stockage ne répond pas, la LIGNE RESTE (avec sa clé) : supprimer la ligne
 * laisserait un objet que plus rien ne permet de retrouver. La ligne ne se supprime que sous le drapeau
 * d'effacement posé par `rgpd-erase.ts` (trigger AXP01).
 *
 * 🔴 UN EFFACEMENT INCOMPLET SE DIT (relecture sécurité, 2026-10-08). Si un seul
 * fichier renvoyé n'a pas pu être effacé — stockage injoignable, ou
 * bibliothèque éteinte alors que des fichiers renvoyés existent — la fonction
 * rend `ok: false` avec `MSG_FICHIERS_NON_EFFACES`. Les appelants NE
 * SUPPRIMENT PAS le dossier (sinon les fichiers deviendraient introuvables) et
 * n'annoncent jamais « effacé » : la console affiche l'erreur, la demande
 * art. 17 compte la candidature comme conservée.
 *
 * Les fichiers envoyés PAR L'ÉQUIPE ne sont pas des données de la personne : ils
 * restent dans la bibliothèque.
 *
 * Pas de `import "server-only"` : appelé depuis le même chemin que
 * `supprimerVideosCandidature`.
 */

import { prisma } from "@/lib/prisma";
import { arreterEnvoiR2, supprimerObjetCibleR2 } from "@/lib/r2-storage";
import { executerSousDrapeauEffacement } from "@/lib/rgpd-erase";

import { configPartages } from "./config";

export const MSG_FICHIERS_NON_EFFACES =
  "Les fichiers renvoyés par le candidat n'ont pas pu être effacés du stockage ; réessayez.";

export type IssueEffacementFichiers =
  | { readonly ok: true; readonly effaces: number; readonly conserves: 0 }
  | {
      readonly ok: false;
      readonly effaces: number;
      readonly conserves: number;
      readonly erreur: string;
    };

export async function effacerFichiersRenvoyesCandidature(
  applicationId: string,
): Promise<IssueEffacementFichiers> {
  const rien = { ok: true, effaces: 0, conserves: 0 } as const;
  // Les fichiers renvoyés se cherchent MÊME bibliothèque éteinte : s'il en
  // existe, le dossier ne doit pas être supprimé sans eux.
  const liens = await prisma.lienPartage.findMany({
    where: { applicationId },
    select: { id: true },
  });
  if (liens.length === 0) return rien;
  const fichiers = await prisma.fichierPartage.findMany({
    where: { origine: "personne", lienDepotId: { in: liens.map((l) => l.id) } },
    select: { id: true, r2Cle: true, r2UploadId: true, etatDepot: true },
  });
  if (fichiers.length === 0) return rien;

  const c = configPartages();
  if (!c) {
    return { ok: false, effaces: 0, conserves: fichiers.length, erreur: MSG_FICHIERS_NON_EFFACES };
  }
  const cible = {
    accountId: c.accountId,
    bucket: c.bucket,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
  };

  const effacables: string[] = [];
  for (const f of fichiers) {
    try {
      if (f.etatDepot === "en_cours" && f.r2Cle && f.r2UploadId) {
        // Un envoi non terminé : R2 libère les morceaux déjà reçus.
        await sansErreurSiDejaParti(arreterEnvoiR2(cible, f.r2Cle, f.r2UploadId));
      }
      if (f.r2Cle) await sansErreurSiDejaParti(supprimerObjetCibleR2(cible, f.r2Cle));
    } catch {
      continue; // stockage injoignable : la ligne reste, l'objet reste retrouvable
    }
    effacables.push(f.id);
  }
  if (effacables.length > 0) {
    await executerSousDrapeauEffacement(prisma, (tx) =>
      tx.fichierPartage.deleteMany({ where: { id: { in: effacables } } }),
    );
  }
  const conserves = fichiers.length - effacables.length;
  if (conserves > 0) {
    return { ok: false, effaces: effacables.length, conserves, erreur: MSG_FICHIERS_NON_EFFACES };
  }
  return { ok: true, effaces: effacables.length, conserves: 0 };
}

/**
 * 🔴 VETO relecture 2026-10-09 : « déjà parti » est un SUCCÈS. Un envoi déjà
 * abandonné ou expiré chez R2 répond `NoSuchUpload`, un objet absent
 * `NoSuchKey` / `NotFound` — ou un 404 nu. Il n'y a alors plus rien à effacer
 * côté stockage ; compter ce cas comme un échec bloquerait POUR TOUJOURS
 * l'effacement art. 17 du dossier. Seuls les vrais échecs (réseau, 5xx, accès
 * refusé…) remontent et gardent le dossier.
 */
const DEJA_PARTI = new Set(["NoSuchUpload", "NoSuchKey", "NotFound"]);

export function estDejaPartiDuStockage(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; Code?: unknown; $metadata?: { httpStatusCode?: unknown } };
  if (typeof e.name === "string" && DEJA_PARTI.has(e.name)) return true;
  if (typeof e.Code === "string" && DEJA_PARTI.has(e.Code)) return true;
  return e.$metadata?.httpStatusCode === 404;
}

async function sansErreurSiDejaParti(p: Promise<void>): Promise<void> {
  try {
    await p;
  } catch (err) {
    if (!estDejaPartiDuStockage(err)) throw err;
  }
}
