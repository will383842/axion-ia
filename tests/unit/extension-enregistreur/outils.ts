/** Outils communs aux tests de l'extension (lecture des fichiers du paquet). */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const DOSSIER_EXTENSION = join(process.cwd(), "extensions", "enregistreur-meet");

/** Tous les fichiers du paquet (chemin relatif au dossier, contenu). */
export function fichiersDeLExtension(): Array<{ chemin: string; contenu: string }> {
  const out: Array<{ chemin: string; contenu: string }> = [];
  const parcourir = (dossier: string) => {
    for (const e of readdirSync(dossier)) {
      const c = join(dossier, e);
      if (statSync(c).isDirectory()) parcourir(c);
      else if (/\.(js|json|html|sha256)$/.test(e)) {
        out.push({
          chemin: relative(DOSSIER_EXTENSION, c).replace(/\\/g, "/"),
          contenu: readFileSync(c, "utf8"),
        });
      }
    }
  };
  parcourir(DOSSIER_EXTENSION);
  return out;
}

export function sansCommentaires(js: string): string {
  return js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

export interface ContratLu {
  readonly version: number;
  readonly entete: string;
  readonly cheminApi: string;
  readonly constantes: Readonly<Record<string, unknown>>;
}

export function lireContrat(): ContratLu {
  return JSON.parse(readFileSync(join(DOSSIER_EXTENSION, "contrat.json"), "utf8")) as ContratLu;
}

export function base(debutMs = 1_000_000) {
  return {
    jeton: "a".repeat(64),
    jetonExpireLe: new Date(debutMs + 60 * 86_400_000).toISOString(),
    cleClient: "11111111-2222-4333-8444-555555555555",
    rencontreId: "3f1c2a4e-8b7d-4c1e-9a2b-1c2d3e4f5a6b",
    nbParticipants: 2,
  };
}

/** Une mesure « tout va bien » : du son des deux côtés, deux participants, dans la salle. */
export const MESURE_NORMALE = {
  niveauClient: 0.1,
  niveauAxion: 0.1,
  nbParticipants: 2,
  dansLaSalle: true,
};
