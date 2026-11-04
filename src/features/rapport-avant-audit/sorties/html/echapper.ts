/**
 * Gabarit HTML des documents INTERNES (2026-11) — PUR, sans dépendance.
 *
 * Règle unique : toute valeur insérée dans une page passe par l'étiquette `html`, qui échappe
 * & < > " '. `brut()` ne sert qu'à insérer un morceau DÉJÀ rendu par `html` (jamais du texte venu
 * d'une réponse, d'un modèle ou d'une base). La page n'a ni script, ni URL externe, ni image
 * distante : sa politique `Content-Security-Policy` interdit tout sauf le style en ligne.
 */

const ECHAPPEMENTS: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function echapper(valeur: unknown): string {
  return String(valeur ?? "").replace(/[&<>"']/g, (c) => ECHAPPEMENTS[c] ?? c);
}

/** Un morceau de HTML déjà rendu (donc déjà échappé). */
export class Brut {
  constructor(readonly valeur: string) {}
  toString(): string {
    return this.valeur;
  }
}

/** À réserver aux morceaux produits par `html` ou par du code de ce dossier. */
export const brut = (valeur: string): Brut => new Brut(valeur);

function inserer(v: unknown): string {
  if (v instanceof Brut) return v.valeur;
  if (Array.isArray(v)) return v.map(inserer).join("");
  if (v === null || v === undefined || v === false) return "";
  return echapper(v);
}

/** Étiquette de gabarit : `html\`<p>${texte}</p>\`` échappe `texte`. Rend un morceau `Brut`. */
export function html(chaines: TemplateStringsArray, ...valeurs: unknown[]): Brut {
  let sortie = "";
  chaines.forEach((c, i) => {
    sortie += c;
    if (i < valeurs.length) sortie += inserer(valeurs[i]);
  });
  return new Brut(sortie);
}

export const POLITIQUE_SECURITE = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

export const BANDEAU_INTERNE = "INTERNE : ne jamais transmettre au client";

const CSS = `
:root{--fond:#faf8f3;--carte:#fff;--texte:#2a2520;--discret:#6b625a;--trait:#e2dccf;--accent:#c24a1b;--bleu:#1a4dd9;--alerte:#fdf0e3;--citation:#f3efe6}
@media (prefers-color-scheme:dark){:root{--fond:#1d1a17;--carte:#26221e;--texte:#f1ece4;--discret:#b3aa9e;--trait:#3b3631;--accent:#ee8a5b;--bleu:#8fa9ff;--alerte:#3a2a1c;--citation:#2f2a25}}
*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--texte);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:980px;margin:0 auto;padding:16px 20px 56px}
.bandeau{position:sticky;top:0;z-index:2;background:var(--accent);color:#fff;font-weight:700;text-align:center;padding:8px 12px;letter-spacing:.02em}
h1{font-size:1.7rem;margin:24px 0 4px}
h2{font-size:1.25rem;margin:32px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--trait)}
h3{font-size:1.05rem;margin:18px 0 6px}
p{margin:6px 0}
.discret{color:var(--discret);font-size:.9rem}
.carte{background:var(--carte);border:1px solid var(--trait);border-radius:8px;padding:14px 16px;margin:12px 0}
.alerte{background:var(--alerte);border:1px solid var(--accent);border-radius:8px;padding:10px 14px;margin:12px 0}
blockquote.citation{margin:6px 0;padding:6px 12px;background:var(--citation);border-left:4px solid var(--accent);border-radius:4px}
blockquote.citation cite{display:block;color:var(--discret);font-size:.85rem;font-style:normal}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:.92rem}
th,td{border:1px solid var(--trait);padding:6px 8px;text-align:left;vertical-align:top}
th{background:var(--citation)}
.etiquette{display:inline-block;border:1px solid var(--trait);background:var(--citation);border-radius:999px;padding:1px 10px;margin:0 4px 4px 0;font-size:.82rem}
.etiquette.fort{border-color:var(--accent);color:var(--accent);font-weight:600}
.vide{color:var(--discret);font-style:italic}
ul{margin:6px 0;padding-left:22px}
svg{max-width:100%;height:auto}
`;

/** La page complète : doctype, politique de sécurité, style en ligne, bandeau « interne », aucun script. */
export function pageInterne(e: { titre: string; corps: Brut }): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${POLITIQUE_SECURITE}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${echapper(e.titre)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="bandeau" role="note">${BANDEAU_INTERNE}</div>
<main>
${e.corps.valeur}
</main>
</body>
</html>
`;
}
