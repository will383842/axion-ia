/* Convertisseur Markdown → .docx (OOXML via JSZip). Usage :
 *   node scripts/md-to-docx.cjs <dossier-md> <dossier-sortie>
 * Génère un .docx propre et professionnel par fichier .md (titres, tableaux
 * bordés à en-tête grisé, listes/cases à cocher, gras, citations, champs à
 * compléter). Normalise les échappements prettier (\_ , runs de * et _).
 */
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

// ---------- helpers XML ----------
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const FILL = "____________"; // ligne à compléter

function unescapeMd(s) {
  return s.replace(/\\([_#.\-()[\]>~|+*])/g, "$1");
}
// Normalise : déséchappe + transforme les runs mutilés par prettier (3+ de */_)
// en une ligne à compléter propre, AVANT le parsing du gras.
function normalizeText(s) {
  return unescapeMd(s).replace(/[*_]{3,}/g, FILL);
}
// Découpe en runs (gras via **...**), nettoie les champs résiduels.
function inlineRuns(text) {
  const norm = normalizeText(text);
  const runs = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m;
  const push = (str, bold) => {
    if (str === undefined || str === null) return;
    const s = str.replace(/_{2,}/g, FILL).replace(/\*/g, "");
    if (s) runs.push({ t: s, bold: !!bold });
  };
  while ((m = re.exec(norm)) !== null) {
    push(norm.slice(last, m.index), false);
    push(m[1], true);
    last = re.lastIndex;
  }
  push(norm.slice(last), false);
  return runs.length ? runs : [{ t: "", bold: false }];
}
function runsXml(runs) {
  return runs
    .map(
      (r) =>
        `<w:r>${r.bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(r.t)}</w:t></w:r>`,
    )
    .join("");
}
function para(text, opts = {}) {
  const pPr =
    (opts.style ? `<w:pStyle w:val="${opts.style}"/>` : "") +
    (opts.indent ? `<w:ind w:left="${opts.indent}"/>` : "");
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${runsXml(inlineRuns(text))}</w:p>`;
}
function quotePara(text) {
  return `<w:p><w:pPr><w:pStyle w:val="Quote"/><w:ind w:left="360"/></w:pPr>${runsXml(
    inlineRuns(text),
  )}</w:p>`;
}
function hr() {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C4B8A8"/></w:pBdr></w:pPr></w:p>`;
}
function tableXml(rows) {
  const cellW = Math.floor(9000 / rows[0].length);
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="C4B8A8"/>`)
    .join("");
  const rowXml = (cells, isHeader) =>
    `<w:tr>${cells
      .map((c) => {
        const shd = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="F2EBE3"/>` : "";
        const runs = inlineRuns(c).map((r) => ({ ...r, bold: isHeader || r.bold }));
        return `<w:tc><w:tcPr><w:tcW w:w="${cellW}" w:type="dxa"/>${shd}</w:tcPr><w:p>${runsXml(
          runs,
        )}</w:p></w:tc>`;
      })
      .join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>${rows
    .map((r, i) => rowXml(r, i === 0))
    .join("")}</w:tbl><w:p/>`;
}

// ---------- parse markdown → body XML ----------
function mdToBody(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const splitRow = (l) =>
    l
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === "") {
      i++;
      continue;
    }
    if (/^#{1,6}\s/.test(t)) {
      const lvl = t.match(/^(#{1,6})/)[1].length;
      const txt = t.replace(/^#{1,6}\s+/, "");
      const style = lvl === 1 ? "Title" : `Heading${Math.min(lvl - 1, 3)}`;
      out.push(para(txt, { style }));
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      out.push(hr());
      i++;
      continue;
    }
    if (t.startsWith(">")) {
      out.push(quotePara(t.replace(/^>\s?/, "")));
      i++;
      continue;
    }
    if (t.startsWith("|") && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
      const rows = [splitRow(t)];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(tableXml(rows));
      continue;
    }
    const cb = t.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (cb) {
      out.push(para(`${cb[1].trim() ? "☑" : "☐"} ${cb[2]}`, { indent: 360 }));
      i++;
      continue;
    }
    const bullet = t.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      out.push(para(`•  ${bullet[1]}`, { indent: 360 }));
      i++;
      continue;
    }
    const num = t.match(/^(\d+)\.\s+(.*)$/);
    if (num) {
      out.push(para(`${num[1]}.  ${num[2]}`, { indent: 360 }));
      i++;
      continue;
    }
    out.push(para(t));
    i++;
  }
  return out.join("");
}

// ---------- parties statiques ----------
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="120" w:after="240"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="C4623F"/></w:pBdr></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:color w:val="2A2520"/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="C4623F"/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2A2520"/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="6B5D4F"/><w:sz w:val="23"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="6B5D4F"/></w:rPr></w:style>
</w:styles>`;
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

function documentXml(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

async function convert(mdPath, outPath) {
  const md = fs.readFileSync(mdPath, "utf8");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels").file(".rels", RELS);
  const w = zip.folder("word");
  w.file("document.xml", documentXml(mdToBody(md)));
  w.file("styles.xml", STYLES);
  w.folder("_rels").file("document.xml.rels", DOC_RELS);
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

(async () => {
  const [, , srcDir, outDir] = process.argv;
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".md") && f !== "README.md");
  files.sort();
  for (const f of files) {
    const out = path.join(outDir, f.replace(/\.md$/, ".docx"));
    const size = await convert(path.join(srcDir, f), out);
    console.log(`✓ ${f} → ${path.basename(out)} (${size} o)`);
  }
  console.log(`\n${files.length} fichiers .docx générés dans ${outDir}`);
})().catch((e) => {
  console.error("ERREUR:", e);
  process.exit(1);
});
