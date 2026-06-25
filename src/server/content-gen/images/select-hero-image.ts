/**
 * Content Generator — Sélection de l'image hero (Option A : Unsplash primaire).
 *
 * Décision Will 2026-06-16 : les articles content-gen doivent porter une PHOTO
 * Unsplash fraîche, plus seulement une image-bank. Unsplash = photos réelles
 * (PAS de l'IA générative) → compatible avec la doctrine [[feedback_no_dalle_images]]
 * (0 image IA).
 *
 * MAJ Will 2026-06-21 : « Unsplash UNIQUEMENT ». Le fallback image-bank est
 * désormais DÉSACTIVÉ par défaut (les héros publiés ne doivent plus venir de la
 * banque interne). Il reste réactivable via `HERO_IMAGE_BANK_FALLBACK=true`.
 *
 * Pipeline :
 *   1. Unsplash (si clé + provider activé) : recherche par mot-clé → meilleure
 *      photo libre (orientation paysage, content_filter high). On hotlinke l'URL
 *      `images.unsplash.com` (déjà whitelistée dans next.config remotePatterns ;
 *      hotlink = recommandé par les CGU Unsplash pour le comptage des vues).
 *      L'attribution photographe (CGU §6) est portée par `photographerName/Url`
 *      et persistée sur l'Article (cf. content-publish-worker), rendue par
 *      <UnsplashCredit/>.
 *   2. Fallback image-bank (`assignHeroImage`) : UNIQUEMENT si
 *      `HERO_IMAGE_BANK_FALLBACK=true` (désactivé par défaut — Unsplash only).
 *   3. null : aucune source (ou Unsplash indisponible) → le worker logue
 *      `hero_image_pending`.
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
 * Requête générique de dernier recours. Unsplash renvoie toujours des photos
 * pertinentes pour ce thème → garantit qu'un article a (quasi) TOUJOURS une
 * illustration, même quand le mot-clé spécifique ne matche rien (Will 2026-06-24,
 * « tous les articles doivent avoir une photo Unsplash »).
 */
const GENERIC_FALLBACK_QUERY = "artificial intelligence business";

/**
 * Réduit une requête à ses 2 premiers tokens significatifs. Les requêtes trop
 * longues/spécifiques (titre complet, nom de région…) renvoient souvent 0 photo
 * Unsplash ; un thème court en retrouve. Retourne null si la requête est déjà
 * courte (≤ 2 tokens → pas de variante utile).
 */
function broadenQuery(query: string): string | null {
  const tokens = query.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length <= 2) return null;
  return tokens.slice(0, 2).join(" ");
}

/**
 * Tente une photo Unsplash pour une requête donnée. Retourne null (jamais throw)
 * si la clé est absente, le provider est désactivé, aucune photo libre, ou erreur
 * réseau/parse — le caller tente alors la requête suivante de la cascade.
 */
async function tryUnsplash(
  input: SelectHeroImageInput,
  query: string,
): Promise<SelectedHero | null> {
  if (!process.env.UNSPLASH_ACCESS_KEY) return null;
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
    // Provider désactivé / rate-limit / 0 résultat / réseau → requête suivante.
    return null;
  }
}

/**
 * Sélectionne la hero : Unsplash d'abord (cascade de requêtes), image-bank en
 * fallback opt-in, null sinon.
 *
 * Cascade Unsplash (Will 2026-06-24) : requête spécifique → thème court (2 tokens)
 * → requête générique. Garantit qu'un article a quasi toujours une photo (le
 * mot-clé brut échouait sur ~1 article/lot, ex. titre avec nom de région).
 */
export async function selectHeroImage(input: SelectHeroImageInput): Promise<SelectedHero | null> {
  const base = buildUnsplashQuery(input);
  const candidates: string[] = [];
  if (base) {
    candidates.push(base);
    const broad = broadenQuery(base);
    if (broad) candidates.push(broad);
  }
  candidates.push(GENERIC_FALLBACK_QUERY);

  const tried = new Set<string>();
  for (const query of candidates) {
    if (tried.has(query)) continue;
    tried.add(query);
    const unsplash = await tryUnsplash(input, query);
    if (unsplash) return unsplash;
  }

  // Doctrine « Unsplash uniquement » (Will 2026-06-21) : par défaut, PAS de
  // fallback image-bank. Si Unsplash est indisponible (clé absente, rate-limit,
  // 0 résultat, réseau), on laisse la hero vide → le worker logue
  // `hero_image_pending` (assignation manuelle) et la page rend simplement sans
  // image (pas de régression). Le fallback image-bank reste réactivable sans
  // redéploiement via `HERO_IMAGE_BANK_FALLBACK=true` (réversibilité).
  if (process.env.HERO_IMAGE_BANK_FALLBACK !== "true") return null;

  const bank = await assignHeroImage(input);
  if (!bank) return null;
  return {
    source: "image-bank",
    url: normalizeBankPath(bank.filePath),
    alt: bank.alt,
    assetId: bank.assetId,
    photographerName: null,
    photographerUrl: null,
  };
}

/**
 * L'image-bank stocke `filePath` SANS slash de tête (ex. `images/xxx.webp`,
 * cf. seed-images.ts). Posé tel quel dans `Article.featuredImage`, il casse le
 * rendu : `<Image src="images/xxx.webp">` throw (next/image exige un chemin
 * local commençant par `/`) et og:image/JSON-LD produisent `${SITE_URL}` +
 * `images/...` = URL malformée sans séparateur. On garantit donc un `/` de tête
 * pour les chemins locaux (les URLs Unsplash `http(s)://` passent intactes).
 */
function normalizeBankPath(filePath: string): string {
  if (/^https?:\/\//.test(filePath)) return filePath;
  return `/${filePath.replace(/^\/+/, "")}`;
}

/** Test-only — expose les helpers internes pour les specs. */
export const __testInternals = { buildUnsplashQuery, broadenQuery, GENERIC_FALLBACK_QUERY };
