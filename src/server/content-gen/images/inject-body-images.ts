/**
 * Content Generator — injection d'images Unsplash DANS le corps (refonte
 * templates 2026-06-22). Complète la hero (cf. `select-hero-image.ts`) : casse
 * les « blocs de texte » avec 1-2 photos contextuelles intercalées.
 *
 * Doctrine Will : **Unsplash UNIQUEMENT** (photos réelles, 0 image IA générative,
 * cf. [[feedback_no_dalle_images]]). Réutilise le `unsplashProvider` (recherche
 * libre, filtre free-only, trigger download CGU §6, UTM). Attribution
 * photographe rendue dans le `<figcaption>` (obligation CGU §6) — comme la hero
 * via `<UnsplashCredit>`, mais ici en HTML inline car le corps est du HTML brut.
 *
 * Contextualisation : chaque requête est dérivée du TITRE H2 de la section où la
 * photo est insérée → image pertinente par section (pas une banque d'images
 * répétée). Les `<figure>`/`<img>` sont stylés par `.prose-axionia` (arrondi,
 * largeur, figcaption centré) et portent `loading="lazy"` + `width/height`
 * (ratio réservé → CLS = 0 ; jamais sur la hero qui, elle, reste prioritaire).
 *
 * BEST-EFFORT STRICT : aucune erreur ne remonte. Pas de clé Unsplash, provider
 * désactivé, rate-limit (45/h), 0 résultat, réseau → on saute l'image (ou on
 * retourne le corps inchangé). La publication n'est JAMAIS bloquée.
 *
 * ⚠️ À appeler sur le body APRÈS la détection des liens/citations
 * (`detectHallucinations`) : les liens d'attribution Unsplash du figcaption ne
 * doivent pas être comptés comme des citations de contenu.
 */

import { unsplashProvider, type UnsplashSelectedPhoto } from "../providers/unsplash";

export interface InjectBodyImagesInput {
  readonly jobId: string;
  readonly contentType: string;
  /** Thème de repli si un titre H2 est trop court pour une requête exploitable. */
  readonly topicHint?: string;
  /** Nombre max d'images injectées (défaut 2 — conservateur vs quota Unsplash). */
  readonly maxImages?: number;
}

const UNSPLASH_LINK = "https://unsplash.com/?utm_source=axion-ia&utm_medium=referral";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Décode/strip un titre H2 HTML en texte de requête (sans accents ni balises). */
const STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "en",
  "et",
  "ou",
  "au",
  "aux",
  "ce",
  "se",
  "sa",
  "ses",
  "nos",
  "vos",
  "pour",
  "avec",
  "sur",
  "par",
  "dans",
  "the",
  "and",
  "for",
  "with",
  "your",
  "pme",
  "tpe",
]);

// On garde les tokens >= 2 lettres (≠ hero) pour NE PAS perdre « ia »/« ai »,
// qui sont les termes les plus pertinents pour une recherche d'image IA.
function h2ToQuery(h2Inner: string, topicHint?: string): string | null {
  const text = h2Inner
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t))
    .slice(0, 4)
    .join(" ")
    .trim();
  if (text.length >= 3) return text;
  const hint = (topicHint ?? "").trim();
  return hint.length >= 3 ? hint : null;
}

/** Offsets (index de début) de chaque balise `<h2` dans le HTML. */
function h2Offsets(html: string): number[] {
  const offsets: number[] = [];
  const re = /<h2\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) offsets.push(m.index);
  return offsets;
}

/** Extrait le texte interne du h2 commençant à `offset`. */
function h2InnerAt(html: string, offset: number): string {
  const close = html.indexOf("</h2>", offset);
  if (close === -1) return "";
  const open = html.indexOf(">", offset);
  if (open === -1 || open > close) return "";
  return html.slice(open + 1, close);
}

function buildFigure(photo: UnsplashSelectedPhoto): string {
  const alt = escapeHtml(photo.alt || "Illustration");
  const photographer = escapeHtml(photo.attribution.photographer);
  const photographerUrl = escapeHtml(photo.attribution.photographerUrl);
  const w = Number.isFinite(photo.width) && photo.width > 0 ? photo.width : 1600;
  const h = Number.isFinite(photo.height) && photo.height > 0 ? photo.height : 1067;
  return (
    `<figure>` +
    `<img src="${escapeHtml(photo.hotlinkUrl)}" alt="${alt}" loading="lazy" width="${w}" height="${h}" />` +
    `<figcaption>Photo de <a href="${photographerUrl}" target="_blank" rel="noopener noreferrer">${photographer}</a>` +
    ` sur <a href="${UNSPLASH_LINK}" target="_blank" rel="noopener noreferrer">Unsplash</a></figcaption>` +
    `</figure>`
  );
}

async function fetchPhoto(
  query: string,
  input: InjectBodyImagesInput,
): Promise<UnsplashSelectedPhoto | null> {
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
    return selected;
  } catch {
    // provider désactivé / rate-limit / 0 résultat / réseau → on saute.
    return null;
  }
}

/**
 * Injecte jusqu'à `maxImages` photos Unsplash contextuelles dans le corps HTML,
 * chacune devant une section H2 (en sautant la première section pour ne pas
 * concurrencer la hero). Retourne le corps inchangé si Unsplash est
 * indisponible ou si le corps a moins de 2 titres H2.
 */
export async function injectBodyImages(
  bodyHtml: string,
  input: InjectBodyImagesInput,
): Promise<string> {
  if (!process.env.UNSPLASH_ACCESS_KEY) return bodyHtml;
  if (typeof bodyHtml !== "string" || bodyHtml.length === 0) return bodyHtml;

  const offsets = h2Offsets(bodyHtml);
  // Besoin d'au moins 2 sections : on n'illustre pas un article trop court.
  if (offsets.length < 2) return bodyHtml;

  const maxImages = Math.max(1, Math.min(input.maxImages ?? 2, 3));
  // Points d'insertion : devant le 2e H2 puis devant le 4e (espacés), jamais le 1er.
  const candidateIdx = [1, 3, 5].filter((i) => i < offsets.length).slice(0, maxImages);

  // Construit (offset, figure) pour chaque candidat retenu, en série pour
  // respecter le rate-limit et garder l'ordre des requêtes déterministe.
  const inserts: Array<{ offset: number; figure: string }> = [];
  const usedPhotoIds = new Set<string>();
  for (const idx of candidateIdx) {
    const offset = offsets[idx];
    if (offset === undefined) continue;
    const query = h2ToQuery(h2InnerAt(bodyHtml, offset), input.topicHint);
    if (!query) continue;
    const photo = await fetchPhoto(query, input);
    if (!photo || usedPhotoIds.has(photo.photoId)) continue;
    usedPhotoIds.add(photo.photoId);
    inserts.push({ offset, figure: buildFigure(photo) });
  }

  if (inserts.length === 0) return bodyHtml;

  // Insère de la fin vers le début pour ne pas décaler les offsets suivants.
  let out = bodyHtml;
  for (const { offset, figure } of inserts.sort((a, b) => b.offset - a.offset)) {
    out = `${out.slice(0, offset)}${figure}${out.slice(offset)}`;
  }
  return out;
}

/** Test-only — expose les helpers purs. */
export const __testInternals = { h2ToQuery, h2Offsets, h2InnerAt, buildFigure };
