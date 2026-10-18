/**
 * VÉRIFICATION DES FICHIERS D'UNE PUBLICATION (plan PLAN-W1-W4 §3.3 étape 9).
 *
 * Le studio dépose les fichiers dans le compartiment public AVANT d'appeler le
 * site. Le site en vérifie l'existence par `HEAD` sur `/medias/...` : 200,
 * `Content-Length` égal aux octets annoncés, `Content-Type` attendu et, pour la
 * vidéo, `Accept-Ranges: bytes` (sans les requêtes `Range`, Safari iOS ne lit
 * pas la vidéo et l'avance rapide est impossible).
 *
 * L'hôte est FIXE (`MEDIAS_ORIGINE`, défaut `https://axion-ia.com`) : seul le
 * chemin vient du studio, et il est déjà contraint par le contrat à
 * `/medias/videos/<slug>/v<n>/<fichier>`. On passe quand même par
 * `ssrfSafeFetch`. Écart assumé : une origine de BOUCLAGE (studio factice des
 * tests, développement) ne passe pas ce garde-fou par construction ; elle n'est
 * acceptée que hors production.
 */
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import type { PublicationVideo } from "./contrat";

export const MEDIAS_ORIGINE_DEFAUT = "https://axion-ia.com";
const DELAI_MS = 10_000;

export interface FauteFichier {
  readonly champ: string;
  readonly raison: string;
}

export type VerdictFichiers =
  { readonly ok: true } | { readonly ok: false; readonly fautes: FauteFichier[] };

export function origineMedias(env: Record<string, string | undefined> = process.env): string {
  const brute = env.MEDIAS_ORIGINE?.trim();
  return (brute && brute.length > 0 ? brute : MEDIAS_ORIGINE_DEFAUT).replace(/\/+$/, "");
}

function estBouclage(origine: string): boolean {
  try {
    const h = new URL(origine).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
  } catch {
    return false;
  }
}

type Chercheur = (url: string, init: RequestInit) => Promise<Response>;

function chercheurPour(origine: string): Chercheur {
  if (estBouclage(origine) && process.env.NODE_ENV !== "production") {
    return (url, init) => fetch(url, init);
  }
  return (url, init) => ssrfSafeFetch(url, init);
}

export async function verifierFichiers(
  fichiers: PublicationVideo["fichiers"],
  options: { origine?: string; chercheur?: Chercheur } = {},
): Promise<VerdictFichiers> {
  const origine = options.origine ?? origineMedias();
  const chercher = options.chercheur ?? chercheurPour(origine);
  const fautes: FauteFichier[] = [];

  await Promise.all(
    Object.entries(fichiers).map(async ([nom, f]) => {
      const champ = `fichiers.${nom}`;
      let reponse: Response;
      try {
        reponse = await chercher(`${origine}${f.chemin}`, {
          method: "HEAD",
          signal: AbortSignal.timeout(DELAI_MS),
        });
      } catch {
        fautes.push({ champ, raison: "injoignable" });
        return;
      }
      if (reponse.status !== 200) {
        fautes.push({ champ, raison: `http_${reponse.status}` });
        return;
      }
      if (Number(reponse.headers.get("content-length")) !== f.octets) {
        fautes.push({ champ, raison: "octets_differents" });
      }
      const type = (reponse.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
      if (type !== f.type) fautes.push({ champ, raison: "type_different" });
      if (nom === "video" && !/bytes/i.test(reponse.headers.get("accept-ranges") ?? "")) {
        fautes.push({ champ, raison: "range_non_supporte" });
      }
    }),
  );

  return fautes.length === 0 ? { ok: true } : { ok: false, fautes };
}
