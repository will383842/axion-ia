/**
 * KB V4 (Sprint KB-15) — Parser Markdown → KB ingest payload.
 *
 * V1 : parser maison minimal (zéro dépendance) qui couvre :
 *  - Front-matter YAML simple : `--- key: value ---` ou ` key: "value with spaces" `
 *  - Headings h1..h3, paragraphes, listes ul/ol, blocks code, bold/italic, liens
 *
 * Limitations conscientes V1 :
 *  - Pas de tableaux, footnotes, ni HTML embed
 *  - Pas d'images (les MD `_AUDIT/` n'en contiennent quasiment pas)
 *
 * Pour des cas plus complexes : Sprint KB-15 V2 wire `marked` ou `remark`.
 */

export interface ParsedMarkdown {
  readonly frontMatter: Readonly<Record<string, string>>;
  readonly body: string; // markdown body sans front-matter
}

const FRONT_MATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/**
 * Sépare front-matter YAML simple et body markdown.
 * Si pas de front-matter, retourne `{}` et le contenu complet.
 */
export function parseFrontMatter(raw: string): ParsedMarkdown {
  const m = raw.match(FRONT_MATTER_REGEX);
  if (!m) return { frontMatter: {}, body: raw.trim() };

  const yamlBlock = m[1]!;
  const body = m[2]!.trim();
  const fm: Record<string, string> = {};

  for (const line of yamlBlock.split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$/);
    if (!kv) continue;
    const key = kv[1]!.trim();
    let value = kv[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fm[key] = value;
  }

  return { frontMatter: fm, body };
}

/**
 * Convertit du markdown body en HTML simple compatible Tiptap.
 * Supporte : h1-h3, p, ul, ol, code, strong, em, a, br.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let inCode = false;
  let codeLang = "";

  const closeList = () => {
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
  };

  const inlineFormat = (text: string): string => {
    let s = escapeHtml(text);
    // Liens [label](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
      const safeUrl = url.startsWith("https://") || url.startsWith("/") ? url : "#";
      return `<a href="${escapeHtml(safeUrl)}" rel="noopener">${label}</a>`;
    });
    // Bold **xxx** et italic *xxx*
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    // Code inline `xxx`
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    return s;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Code fence
    const codeOpen = line.match(/^```(\w*)$/);
    if (codeOpen) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
        codeLang = "";
      } else {
        closeList();
        codeLang = codeOpen[1] ?? "";
        out.push(`<pre><code${codeLang ? ` class="language-${codeLang}"` : ""}>`);
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(rawLine));
      continue;
    }

    if (line.length === 0) {
      closeList();
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      closeList();
      const level = h[1]!.length;
      out.push(`<h${level}>${inlineFormat(h[2]!)}</h${level}>`);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inList !== "ul") {
        closeList();
        out.push("<ul>");
        inList = "ul";
      }
      out.push(`<li>${inlineFormat(ul[1]!)}</li>`);
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inList !== "ol") {
        closeList();
        out.push("<ol>");
        inList = "ol";
      }
      out.push(`<li>${inlineFormat(ol[1]!)}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inlineFormat(line)}</p>`);
  }

  closeList();
  if (inCode) out.push("</code></pre>");

  return out.join("\n");
}

/**
 * Extrait du plain text depuis le body markdown (pour `bodyText` + word count).
 */
export function markdownToPlainText(md: string): string {
  return md
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "") // strip front-matter au cas où
    .replace(/```[\s\S]*?```/g, "") // strip code blocks
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
