/**
 * Content Generator — mémoire des photos Unsplash déjà utilisées (SANS migration).
 *
 * Sources (clé = `photo-<ts>-<hash>` lue dans l'URL, cf. `photoKeyFromUrl`) :
 *   1. `Article.featuredImage` — image principale, TOUS statuts (publié, brouillon,
 *      en attente) ;
 *   2. `ArticleTranslation.body` — images du corps (HTML `<img src=…>`) ;
 *   3. réservations Redis (7 j) — photos choisies mais pas encore persistées
 *      (article en cours de génération / publication), pour deux jobs concurrents.
 *
 * Base indisponible → on LÈVE (échec fermé) : mieux vaut une image en attente
 * qu'un doublon. Redis indisponible → échec ouvert (la base reste la vérité).
 * Imports relatifs : résolvables aussi sous `tsx` (script CLI).
 */

import { prisma } from "../../../lib/prisma";
import { redis } from "../../../lib/redis";
import { PHOTO_KEY_REGEX_SOURCE, photoKeyFromUrl } from "./photo-quality";

const RESERVED_SET_KEY = "cg:img:reserved";
const RESERVED_TTL_SEC = 7 * 24 * 60 * 60;

export async function loadUsedPhotoKeys(): Promise<Set<string>> {
  const used = new Set<string>();

  const heroes = await prisma.article.findMany({
    where: { featuredImage: { contains: "unsplash.com" } },
    select: { featuredImage: true },
  });
  for (const h of heroes) {
    const k = photoKeyFromUrl(h.featuredImage);
    if (k) used.add(k);
  }

  // Extraction côté base : on ne rapatrie que les clés, pas les corps d'articles.
  const rows = await prisma.$queryRaw<Array<{ key: string }>>`
    SELECT DISTINCT m[1] AS key
    FROM article_translations t, regexp_matches(t.body, ${PHOTO_KEY_REGEX_SOURCE}, 'g') AS m
    WHERE t.body LIKE '%images.unsplash.com%'`;
  for (const r of rows ?? []) if (r.key) used.add(r.key);

  try {
    const reserved = (await redis.smembers(RESERVED_SET_KEY)) as string[] | null;
    if (Array.isArray(reserved)) for (const k of reserved) used.add(k);
  } catch {
    // Redis indisponible → la base fait foi.
  }
  return used;
}

/**
 * Fabrique le « portier » passé au provider : accepte une photo seulement si sa
 * clé n'est ni dans `used` ni déjà réservée par un autre job, puis la réserve.
 * `used` est mis à jour : une même photo n'est jamais reprise dans un même article.
 */
export function makePhotoGate(used: Set<string>): (urlRegular: string) => Promise<boolean> {
  return async (urlRegular: string): Promise<boolean> => {
    const key = photoKeyFromUrl(urlRegular);
    if (!key) return false; // URL non reconnue → impossible de dédoublonner → refus
    if (used.has(key)) return false;
    try {
      const added = await redis.sadd(RESERVED_SET_KEY, key);
      if (added === 0) {
        used.add(key); // déjà réservée ailleurs
        return false;
      }
      await redis.expire(RESERVED_SET_KEY, RESERVED_TTL_SEC);
    } catch {
      // Redis indisponible → échec ouvert sur la réservation seulement.
    }
    used.add(key);
    return true;
  };
}
