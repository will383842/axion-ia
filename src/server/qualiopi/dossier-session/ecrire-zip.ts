/**
 * 🔴 CHANTIER QNC, LOT L11 — LE DOSSIER COMPLET, ÉCRIT DANS LE ZIP.
 *
 * Écrit `dossier-complet/` à partir du MÊME rendu que l'écran
 * (`rendreDossier`) : l'index y liste chaque entrée dans l'ordre de l'écran,
 * chaque copie d'e-mail y est jointe (HTML et texte), et chaque ORIGINAL
 * REMPLACÉ y est joint sous `documents/remplacees/`, étiqueté.
 *
 * Les pièces EN VIGUEUR sont déjà jointes par `genererDossierSessionZip` sous
 * `documents/<type>/` : on ne les duplique pas, l'index renvoie à leur chemin.
 *
 * Rend la liste des chemins écrits — le témoin du test « écran = ZIP ».
 */

import type JSZip from "jszip";

import {
  RACINE_DOSSIER_COMPLET,
  lignesIndexDossier,
  rendreDossier,
  texteCopieEmail,
  type DossierRendu,
  type ModeleDossierSession,
} from "./rendu";

export interface ResultatEcritureDossier {
  readonly rendu: DossierRendu;
  /** Chemins ajoutés au ZIP par cette écriture. */
  readonly ecrits: readonly string[];
  /** Fichiers désignés par le rendu et ABSENTS du ZIP (PDF introuvable). */
  readonly absents: readonly string[];
}

export async function ecrireDossierComplet(
  zip: JSZip,
  modele: ModeleDossierSession,
  lirePdf: (cle: string) => Promise<Buffer | null>,
): Promise<ResultatEcritureDossier> {
  const rendu = rendreDossier(modele);
  const ecrits: string[] = [];
  const absents: string[] = [];
  const elementParCle = new Map(modele.elements.map((e) => [e.cle, e]));

  for (const g of rendu.groupes) {
    for (const c of g.canaux) {
      for (const entree of c.entrees) {
        const element = elementParCle.get(entree.cle);
        if (element === undefined) continue;
        for (const f of entree.fichiers) {
          if (f.sorte === "html" && element.copie) {
            zip.file(f.chemin, element.copie.html);
            ecrits.push(f.chemin);
          } else if (f.sorte === "texte" && element.copie) {
            zip.file(f.chemin, texteCopieEmail(entree, element.copie));
            ecrits.push(f.chemin);
          } else if (f.sorte === "pdf") {
            // Déjà joint par l'appelant (pièce en vigueur) : rien à refaire.
            // Sinon (original remplacé, ou PDF que l'appelant n'a pas trouvé),
            // on le cherche ; introuvable, il est DÉCLARÉ absent.
            if (zip.file(f.chemin) !== null) continue;
            const cle = element.cleStockage ?? null;
            const buffer = cle === null ? null : await lirePdf(cle);
            if (buffer === null) {
              absents.push(f.chemin);
              continue;
            }
            zip.file(f.chemin, buffer);
            ecrits.push(f.chemin);
          }
        }
      }
    }
  }

  const index = lignesIndexDossier(rendu);
  if (absents.length > 0) {
    index.push(
      "",
      "FICHIERS DÉSIGNÉS MAIS ABSENTS DU ZIP (stockage injoignable ou objet manquant) :",
      ...absents.map((a) => `   ${a}`),
    );
  }
  const cheminIndex = `${RACINE_DOSSIER_COMPLET}/index.txt`;
  zip.file(cheminIndex, index.join("\n"));
  ecrits.push(cheminIndex);

  return { rendu, ecrits, absents };
}
