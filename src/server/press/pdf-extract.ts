// Extraction texte PDF → texte structuré — communiqués de presse.
//
// Objectif SEO/AEO : un communiqué uploadé en PDF rend une landing
// `/presse/[slug]` MINCE (iframe seul). On extrait ici le texte du PDF à
// l'upload (mécanique, ZÉRO LLM, gratuit, déterministe) pour peupler
// `PressReleaseTranslation.body` → la landing devient une vraie page texte
// indexable (H1 + paragraphes + JSON-LD NewsArticle articleBody + Speakable),
// tout en gardant le PDF téléchargeable.
//
// Format de sortie = TEXTE BRUT, paragraphes séparés par une ligne vide
// (`\n\n`). C'est exactement ce qu'attend `/presse/[slug]/page.tsx` (qui split
// sur `\n{2,}` puis rend des <p> via React → échappement automatique, zéro
// dangerouslySetInnerHTML) et `articleBody` du JSON-LD NewsArticle.
//
// Robustesse : toute erreur d'extraction (PDF corrompu, scanné sans couche
// texte…) renvoie "" → l'upload n'est JAMAIS bloqué (la landing reste alors
// PDF-only via iframe, comme avant). L'extraction ne tourne qu'au RUNTIME
// (server action admin), jamais au build SSG (contrat stub.invalid respecté).

/**
 * Nettoie le texte brut extrait d'un PDF et le normalise en paragraphes séparés
 * par `\n\n`. Recolle les césures de fin de ligne (« déve-\nloppement » →
 * « développement ») et fusionne les retours à la ligne internes d'un paragraphe.
 */
export function cleanPdfText(raw: string): string {
  if (!raw) return "";

  const normalized = raw
    .replace(/\r\n?/g, "\n")
    // Césure : lettre + "-" en fin de ligne suivie d'une lettre → on recolle.
    .replace(/([A-Za-zÀ-ÿ])-\n([A-Za-zÀ-ÿ])/g, "$1$2")
    // Espaces insécables / multiples → espace simple.
    .replace(/[ \t ]+/g, " ");

  // Blocs = séparés par ≥1 ligne vide ; chaque bloc = lignes recollées par espace.
  const blocks = normalized
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .trim(),
    )
    // Filtre le bruit : blocs ultra-courts isolés (numéros de page, etc.).
    .filter((block) => block.length >= 2);

  return blocks.join("\n\n");
}

/**
 * Extrait le texte d'un PDF (buffer) puis le normalise en paragraphes.
 * Renvoie "" en cas d'échec (jamais de throw) — l'appelant continue sans body.
 */
export async function pdfBufferToText(buffer: Buffer): Promise<string> {
  try {
    // Import dynamique : unpdf est ESM (pdfjs serverless) et n'a pas à être
    // chargé tant qu'aucun communiqué n'est uploadé.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const raw = Array.isArray(text) ? text.join("\n\n") : text;
    return cleanPdfText(raw);
  } catch (err) {
    console.error("[pdfBufferToText] extraction échouée (landing restera PDF-only)", err);
    return "";
  }
}
