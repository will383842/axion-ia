/**
 * Relevé de l'aperçu de partage d'une page : ce qu'elle DÉCLARE, et ce que le
 * fichier MESURE.
 *
 * 🔴 POURQUOI — recensement OG du 2026-08-17. Les 1 667 URLs indexables de la
 * production annonçaient toutes `og:image:width=1200 / height=630`, pour des
 * fichiers qui faisaient 1200×675 (nos cartes) ou 1080×607 (les photos de
 * blog). Un relevé qui se contenterait de recopier les balises rangerait le
 * mensonge en base sans jamais permettre de le voir : il faut mesurer.
 *
 * 🔑 CE MODULE NE TÉLÉCHARGE JAMAIS NOS CARTES `/api/og`.
 *
 * Mesuré le 2026-08-17 : Cloudflare répond `cf-cache-status: DYNAMIC` sur ces
 * URLs — une adresse sans extension de fichier n'entre pas dans ses règles de
 * cache par défaut. Chaque requête déclenche donc un rendu Satori complet
 * (~2 s) à l'origine. Les télécharger pour « mesurer » reviendrait à infliger
 * 1 533 rendus au site à chaque passage de l'inspecteur : l'observabilité
 * fabriquerait la panne qu'elle prétend surveiller.
 *
 * Leur taille est connue sans les télécharger — c'est le renderer qui la fixe,
 * et il lit la même constante que nous (`@/lib/og-format`). On la reprend donc
 * de la constante, et le module le DIT (`mesuree: false`) plutôt que de faire
 * passer une déduction pour une mesure.
 */

import sharp from "sharp";

import { OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR } from "@/lib/og-format";

/** Poids maximal téléchargé pour mesurer une image (garde-fou anti-bombe). */
const POIDS_MAX_TELECHARGE = 8 * 1024 * 1024;

export interface BalisesOg {
  readonly image: string | null;
  readonly title: string | null;
  readonly description: string | null;
  readonly type: string | null;
  /** Ce que les balises ANNONCENT — souvent faux, c'est tout l'enjeu. */
  readonly declaredWidth: number | null;
  readonly declaredHeight: number | null;
}

export interface MesureImage {
  readonly status: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly bytes: number | null;
  readonly contentType: string | null;
  /**
   * `false` quand les dimensions viennent de la constante partagée et non d'un
   * fichier réellement téléchargé (cas de nos cartes générées). L'écran ne doit
   * pas présenter une déduction comme un relevé.
   */
  readonly mesuree: boolean;
}

function contenuMeta(html: string, propriete: string): string | null {
  // Les deux ordres d'attributs existent dans la nature ; Next émet
  // `property` avant `content`, mais on ne parie pas là-dessus.
  const motifs = [
    new RegExp(`<meta[^>]+property=["']${propriete}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${propriete}["']`, "i"),
  ];
  for (const motif of motifs) {
    const m = html.match(motif);
    if (m?.[1] !== undefined) return deshtml(m[1]);
  }
  return null;
}

function deshtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function entier(v: string | null): number | null {
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** Extrait les balises Open Graph d'un document HTML. Pur, sans réseau. */
export function extraireBalisesOg(html: string): BalisesOg {
  return {
    image: contenuMeta(html, "og:image"),
    title: contenuMeta(html, "og:title"),
    description: contenuMeta(html, "og:description"),
    type: contenuMeta(html, "og:type"),
    declaredWidth: entier(contenuMeta(html, "og:image:width")),
    declaredHeight: entier(contenuMeta(html, "og:image:height")),
  };
}

/**
 * `true` si l'URL est une de NOS cartes générées à la volée.
 *
 * Ces images n'ont pas de fichier : elles sont rendues à chaque requête par
 * Satori. Les mesurer coûterait un rendu — cf. l'en-tête de ce module.
 */
export function estCarteGeneree(urlImage: string, origine: string): boolean {
  try {
    const u = new URL(urlImage, origine);
    const o = new URL(origine);
    if (u.hostname !== o.hostname) return false;
    return u.pathname === "/api/og" || u.pathname === "/opengraph-image";
  } catch {
    return false;
  }
}

/** `true` si l'image est servie par un domaine qui n'est pas le nôtre. */
export function estImageTierce(urlImage: string, origine: string): boolean {
  try {
    return new URL(urlImage, origine).hostname !== new URL(origine).hostname;
  } catch {
    return false;
  }
}

/**
 * Mesure une image de partage.
 *
 * Nos cartes générées ne sont PAS téléchargées : leurs dimensions viennent de
 * la constante que le renderer applique, et `mesuree` vaut alors `false`.
 */
export async function mesurerImagePartage(
  urlImage: string,
  origine: string,
  options: { readonly fetchImpl?: typeof fetch; readonly timeoutMs?: number } = {},
): Promise<MesureImage> {
  if (estCarteGeneree(urlImage, origine)) {
    return {
      status: null,
      width: OG_IMAGE_LARGEUR,
      height: OG_IMAGE_HAUTEUR,
      bytes: null,
      contentType: "image/png",
      mesuree: false,
    };
  }

  const f = options.fetchImpl ?? fetch;
  const timeout = options.timeoutMs ?? 20_000;

  let reponse: Response;
  try {
    reponse = await f(new URL(urlImage, origine).toString(), {
      headers: { "User-Agent": "AxionIA-SiteExplorer/1.0 (+https://axion-ia.com/robots.txt)" },
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    // Injoignable : c'est un RÉSULTAT, pas une erreur du relevé. Une image qui
    // ne répond pas produit un aperçu vide, et c'est exactement ce qu'on veut
    // voir apparaître à l'écran.
    return {
      status: null,
      width: null,
      height: null,
      bytes: null,
      contentType: null,
      mesuree: true,
    };
  }

  const contentType = reponse.headers.get("content-type");
  if (!reponse.ok) {
    return {
      status: reponse.status,
      width: null,
      height: null,
      bytes: null,
      contentType,
      mesuree: true,
    };
  }

  const buffer = Buffer.from(await reponse.arrayBuffer());
  if (buffer.byteLength > POIDS_MAX_TELECHARGE) {
    return {
      status: reponse.status,
      width: null,
      height: null,
      bytes: buffer.byteLength,
      contentType,
      mesuree: true,
    };
  }

  try {
    const meta = await sharp(buffer).metadata();
    return {
      status: reponse.status,
      width: meta.width ?? null,
      height: meta.height ?? null,
      bytes: buffer.byteLength,
      contentType,
      mesuree: true,
    };
  } catch {
    // Répond 200 mais n'est pas une image décodable : aperçu vide aussi.
    return {
      status: reponse.status,
      width: null,
      height: null,
      bytes: buffer.byteLength,
      contentType,
      mesuree: true,
    };
  }
}
