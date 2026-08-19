/**
 * Lecture des surcharges d'aperçu de partage.
 *
 * 🔴 POURQUOI — recensement OG du 2026-08-17. Rien n'était modifiable depuis la
 * console : l'aperçu de chaque page était entièrement calculé dans le code.
 *
 * 🔑 UNE REQUÊTE PAR RENDU, PAS PAR PAGE.
 *
 * `buildProductMetadata` est appelé par 146 pages, et le site en pré-rend
 * 17 629. Une lecture en base par page multiplierait ce nombre par autant.
 * Les surcharges se comptent en dizaines : on charge la table ENTIÈRE une fois
 * et on la garde en mémoire du process, avec une durée de vie courte. Le coût
 * marginal d'une page devient une recherche dans une Map.
 *
 * ⚠️ CONTRAT `stub.invalid` (AGENTS.md, ADR 0026). Sous le build GitHub
 * Actions, la base est injoignable. On sort AVANT toute instanciation du client
 * Prisma — même motif que `knowledge-rss.ts` et `knowledge-sitemap.ts` — et on
 * rend une table vide. Conséquence VOULUE : le build fige les pages SANS
 * surcharge, donc exactement ce qu'elles rendent aujourd'hui. C'est
 * l'enregistrement d'une surcharge qui régénère la page (`revalidateAndPurge`),
 * pas le build.
 */

import type { OgOverridePortee } from "../../../prisma/generated/client";

/** Ce qu'une surcharge peut dire de l'aperçu. Tous les champs sont optionnels. */
export interface SurchargeOg {
  readonly ogTitle: string | null;
  readonly ogDescription: string | null;
  readonly ogImage: string | null;
  readonly ogImageWidth: number | null;
  readonly ogImageHeight: number | null;
  readonly ogEyebrow: string | null;
}

interface LigneSurcharge extends SurchargeOg {
  readonly portee: OgOverridePortee;
  readonly cible: string;
}

/** Durée de vie du cache en mémoire. Court : une correction doit se voir vite. */
const DUREE_CACHE_MS = 30_000;

/**
 * Délai au-delà duquel on renonce à lire les surcharges.
 *
 * 🔴 SANS CETTE BORNE, UNE BASE LENTE FAIT ATTENDRE CHAQUE PAGE.
 *
 * Le `catch` plus bas rattrape une base qui REFUSE la connexion. Il ne rattrape
 * pas une base qui ne répond PAS : la promesse reste en suspens, et le rendu de
 * la page avec elle. Ce défaut a été trouvé par la garde de non-régression, qui
 * s'est mise à expirer dès que la fabrique a consulté la table — sur un
 * environnement sans base joignable, exactement le cas redouté.
 *
 * 🔑 Le pire cas acceptable est « pas de surcharge », jamais « page bloquée » :
 * la page rend alors ce qu'elle rendait avant, ce qui est correct.
 */
const DELAI_LECTURE_MS = 1_500;

let cache: { readonly a: number; readonly lignes: readonly LigneSurcharge[] } | null = null;

/** `true` quand on tourne sous les URLs stub du build (cf. AGENTS.md). */
function sousStubBuild(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") ?? false;
}

/**
 * Vide le cache en mémoire.
 *
 * Appelé après l'enregistrement d'une surcharge : sans ça, le process qui vient
 * d'écrire continuerait à servir l'ancienne valeur pendant 30 s, et l'aperçu
 * régénéré par `revalidatePath` reprendrait… l'ancienne surcharge. Le
 * correctif semblerait n'avoir aucun effet.
 */
export function oublierSurchargesOg(): void {
  cache = null;
}

async function chargerLignes(): Promise<readonly LigneSurcharge[]> {
  if (sousStubBuild()) return [];

  const maintenant = Date.now();
  if (cache && maintenant - cache.a < DUREE_CACHE_MS) return cache.lignes;

  try {
    // ⚠️ LA COURSE ENGLOBE AUSSI LA CONSTRUCTION DU CLIENT, PAS SEULEMENT LA
    // REQUÊTE. Première version de ce correctif : la course ne couvrait que
    // `findMany`. Elle ne servait à rien — mesuré, 6 726 ms passés dans l'accès
    // au singleton `prisma` AVANT que la moindre promesse de requête n'existe
    // (le client valide son schéma et son URL de connexion à la construction).
    // Le rendu restait donc bloqué presque sept secondes. Tout ce qui peut
    // durer doit être DANS la course.
    const lecture = (async () => {
      // Import dynamique : sous stub on n'a même pas instancié le client.
      const { prisma } = await import("@/lib/prisma");
      return prisma.ogOverride.findMany({
        where: { actif: true },
        select: {
          portee: true,
          cible: true,
          ogTitle: true,
          ogDescription: true,
          ogImage: true,
          ogImageWidth: true,
          ogImageHeight: true,
          ogEyebrow: true,
        },
      });
    })();
    // `Promise.race` ne coupe pas le travail en cours — il finira ou échouera
    // dans son coin — mais elle rend la main au rendu, et c'est ce qui compte.
    // La promesse perdante est neutralisée pour éviter un rejet non capturé.
    lecture.catch(() => undefined);
    const lignes = await Promise.race([
      lecture,
      new Promise<null>((r) => setTimeout(() => r(null), DELAI_LECTURE_MS)),
    ]);
    if (lignes === null) {
      // Expiration : on met en cache le résultat VIDE pour ne pas relancer une
      // lecture lente à chaque page pendant les 30 s qui suivent.
      console.warn(
        `[og-overrides] lecture des surcharges abandonnée après ${DELAI_LECTURE_MS} ms — ` +
          "les pages rendent leur aperçu calculé.",
      );
      cache = { a: maintenant, lignes: [] };
      return [];
    }
    cache = { a: maintenant, lignes };
    return lignes;
  } catch {
    // 🔑 Une base indisponible ne doit pas faire tomber le rendu d'une page
    // publique. Sans surcharge, la page rend ce qu'elle rendait avant — le
    // pire cas est donc « pas de surcharge », jamais « page en erreur ».
    cache = { a: maintenant, lignes: [] };
    return [];
  }
}

/**
 * Un `cible` de portée `modele` matche-t-il un chemin réel ?
 *
 * Les segments entre crochets valent joker, segment par segment — même règle
 * que `resolveLocalizedPath` dans `seo.ts`, et que les `pathPattern` stockés
 * dans `site_routes`. Le nombre de segments doit correspondre : sans ça,
 * `/fr/audit/[x]` avalerait `/fr/audit/par-ville/lyon`.
 */
export function modeleMatche(cible: string, chemin: string): boolean {
  const c = cible.split("/").filter(Boolean);
  const p = chemin.split("/").filter(Boolean);
  if (c.length !== p.length) return false;
  return c.every((seg, i) => (seg.startsWith("[") && seg.endsWith("]")) || seg === p[i]);
}

/**
 * La surcharge applicable à un chemin, ou `null`.
 *
 * 🔑 La portée `route` l'emporte sur `modele`. Sans cette règle, poser une
 * exception sur une ville précise serait impossible dès lors qu'un modèle
 * couvre la famille.
 */
export function choisirSurcharge(
  lignes: readonly LigneSurcharge[],
  chemin: string,
): SurchargeOg | null {
  const exacte = lignes.find((l) => l.portee === "route" && l.cible === chemin);
  if (exacte) return exacte;
  const parModele = lignes.find((l) => l.portee === "modele" && modeleMatche(l.cible, chemin));
  return parModele ?? null;
}

/**
 * Surcharge applicable à un chemin complet (préfixe de locale inclus).
 *
 * @param chemin ex. `/fr/audit` ou `/fr/audit/par-ville/lyon`
 */
export async function surchargeOgPour(chemin: string): Promise<SurchargeOg | null> {
  const lignes = await chargerLignes();
  if (lignes.length === 0) return null;
  return choisirSurcharge(lignes, chemin);
}
