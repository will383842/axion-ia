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
 * Ordre : l'objet d'abord, la ligne ensuite. Si le stockage ne répond pas, la
 * LIGNE RESTE (avec sa clé) : supprimer la ligne laisserait un objet que plus
 * rien ne permet de retrouver. La ligne ne se supprime que sous le drapeau
 * d'effacement posé par `rgpd-erase.ts` (trigger AXP01).
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

export async function effacerFichiersRenvoyesCandidature(
  applicationId: string,
): Promise<{ effaces: number; conserves: number }> {
  const c = configPartages();
  if (!c) return { effaces: 0, conserves: 0 };
  const cible = {
    accountId: c.accountId,
    bucket: c.bucket,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
  };
  const liens = await prisma.lienPartage.findMany({
    where: { applicationId },
    select: { id: true },
  });
  if (liens.length === 0) return { effaces: 0, conserves: 0 };
  const fichiers = await prisma.fichierPartage.findMany({
    where: { origine: "personne", lienDepotId: { in: liens.map((l) => l.id) } },
    select: { id: true, r2Cle: true, r2UploadId: true, etatDepot: true },
  });
  if (fichiers.length === 0) return { effaces: 0, conserves: 0 };

  const effacables: string[] = [];
  for (const f of fichiers) {
    if (f.etatDepot === "en_cours" && f.r2Cle && f.r2UploadId) {
      // Un envoi non terminé : R2 libère les morceaux déjà reçus.
      await arreterEnvoiR2(cible, f.r2Cle, f.r2UploadId).catch(() => undefined);
    }
    if (f.r2Cle) {
      try {
        await supprimerObjetCibleR2(cible, f.r2Cle);
      } catch {
        continue; // stockage injoignable : la ligne reste, l'objet reste retrouvable
      }
    }
    effacables.push(f.id);
  }
  if (effacables.length > 0) {
    await executerSousDrapeauEffacement(prisma, (tx) =>
      tx.fichierPartage.deleteMany({ where: { id: { in: effacables } } }),
    );
  }
  return { effaces: effacables.length, conserves: fichiers.length - effacables.length };
}
