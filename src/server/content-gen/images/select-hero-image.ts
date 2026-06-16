/**
 * Content Generator — Sélection de l'image hero (Option A : Unsplash primaire).
 *
 * Décision Will 2026-06-16 : les articles content-gen doivent porter une PHOTO
 * Unsplash fraîche, plus seulement une image-bank. Unsplash = photos réelles
 * (PAS de l'IA générative) → compatible avec la doctrine [[feedback_no_dalle_images]]
 * (0 image IA). On garde l'image-bank en FALLBACK robuste.
 *
 * Pipeline :
 *   1. Unsplash (si clé + provider activé) : recherche par mot-clé → meilleure
 *      photo libre (orientation paysage, content_filter high). On hotlinke l'URL
 *      `images.unsplash.com` (déjà whitelistée dans next.config remotePatterns ;
 *      hotlink = recommandé par les CGU Unsplash pour le comptage des vues).
 *      L'attribution photographe (CGU §6) est portée par `photographerName/Url`
 *      et persistée sur l'Article (cf. content-publish-worker), rendue par
 *      <UnsplashCredit/>.
 *   2. Fallback image-bank (`assignHeroImage`) : si Unsplash indisponible
 *      (clé absente, provider désactivé, 0 résultat libre, erreur réseau).
 *   3. null : aucune source → le worker logue `hero_image_pending`.
 *
 * Le worker ne dépend QUE de ce module pour la hero ; il n'appelle plus
 * `assignHeroImage` directement.
 */

import { assignHeroImage, type AssignHeroImageInput } from "./assign-hero-image";
import { unsplashProvider, type UnsplashSelectedPhoto } from "../providers/unsplash";

export interface SelectHeroImageInput extends AssignHeroImageInput {
  /** Pour la traçabilité cost/audit du provider Unsplash. */
  readonly jobId: string;
  readonly contentType: string;
}

export interface SelectedHero {
  readonly source: "unsplash" | "image-bank";
  /** URL/chemin posé sur Article.featuredImage (hotlink Unsplash ou filePath bank). */
  readonly url: string;
  readonly alt: string;
  /** image-bank uniquement (traçabilité ImageAsset). */
  readonly assetId: string | null;
  /** Unsplash uniquement — attribution CGU §6 (null pour image-bank). */
  readonly photographerName: string | null;
  readonly photographerUrl: string | null;
}

/**
 * Construit la requête de recherche Unsplash à partir du mot-clé primaire.
 * On retire les tokens trop spécifiques (nom de ville, "pme") qui dégradent la
 * pertinence des photos de stock, pour garder un thème visuel exploitable.
 */
function buildUnsplashQuery(input: SelectHeroImageInput): string | null {
  const kw = (input.primaryKeyword ?? "").trim();
  if (!kw) return null;
  const cityTokens = new Set(
    (input.anchorVilleSlug ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const cleaned = kw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !cityTokens.has(t) && t !== "pme" && t !== "tpe")
    .join(" ")
    .trim();
  return cleaned.length > 0 ? cleaned : kw;
}

/**
 * Tente une photo Unsplash. Retourne null (jamais throw) si la clé est absente,
 * le provider est désactivé, aucune photo libre, ou erreur réseau/parse — le
 * caller bascule alors sur l'image-bank.
 */
async function tryUnsplash(input: SelectHeroImageInput): Promise<SelectedHero | null> {
  if (!process.env.UNSPLASH_ACCESS_KEY) return null;
  const query = buildUnsplashQuery(input);
  if (!query) return null;
  try {
    const res = await unsplashProvider.generate({
      jobId: input.jobId,
      contentType: input.contentType,
      role: "stock_image",
      systemPrompt: "",
      userPrompt: query,
    });
    const selected = JSON.parse(res.output) as UnsplashSelectedPhoto;
    if (!selected.hotlinkUrl || !selected.attribution?.photographer) return null;
    return {
      source: "unsplash",
      url: selected.hotlinkUrl,
      alt: selected.alt || query,
      assetId: null,
      photographerName: selected.attribution.photographer,
      photographerUrl: selected.attribution.photographerUrl,
    };
  } catch {
    // Provider désactivé / rate-limit / 0 résultat / réseau → fallback bank.
    return null;
  }
}

/**
 * Sélectionne la hero : Unsplash d'abord, image-bank en fallback, null sinon.
 */
export async function selectHeroImage(input: SelectHeroImageInput): Promise<SelectedHero | null> {
  const unsplash = await tryUnsplash(input);
  if (unsplash) return unsplash;

  const bank = await assignHeroImage(input);
  if (!bank) return null;
  return {
    source: "image-bank",
    url: bank.filePath,
    alt: bank.alt,
    assetId: bank.assetId,
    photographerName: null,
    photographerUrl: null,
  };
}

/** Test-only — expose les helpers internes pour les specs. */
export const __testInternals = { buildUnsplashQuery };
