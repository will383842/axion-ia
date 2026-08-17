/**
 * Mesurer les fichiers d'un imprimé sur le disque du conteneur.
 *
 * `public/` est copié dans l'image Docker (cf. Dockerfile, `COPY /app/public
 * ./public`) : la taille lue ici est exactement l'octet servi au visiteur.
 *
 * Un fichier ABSENT n'est pas ignoré : le lien public renverrait 404, et mieux
 * vaut le voir dans la console que par un visiteur. C'est la même règle que
 * pour les images du catalogue — une absence n'est pas une conformité.
 */
import { stat } from "node:fs/promises";
import path from "node:path";

import type { Imprime } from "@/content/imprimes";
import type { FichierMesure } from "./FichiersImprime";

export function poidsLisible(octets: number): string {
  return octets >= 1_048_576
    ? `${(octets / 1_048_576).toFixed(1)} Mo`
    : `${Math.round(octets / 1024)} Ko`;
}

export async function mesurerImprime(imprime: Imprime): Promise<FichierMesure[]> {
  return Promise.all(
    imprime.fichiersPublics.map(async (f) => {
      try {
        const s = await stat(path.join(process.cwd(), "public", f.chemin));
        return { ...f, poids: poidsLisible(s.size), present: true };
      } catch {
        return { ...f, poids: "—", present: false };
      }
    }),
  );
}
