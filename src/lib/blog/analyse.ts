/**
 * Gabarit « Analyse » (G1) : préparation du corps HTML, fonctions pures et serveur.
 *
 * Le corps arrive déjà nettoyé (sanitizer) avec un `id` sur chaque H2 (`buildToc`). On y pose
 * seulement des repères tirés de sa propre structure, jamais de contenu inventé :
 *  - un numéro « 04 / 07 » et une ancre partageable AVANT chaque H2 (le texte du H2 reste propre) ;
 *  - une relance « Dans la suite : <titre du 4e H2> » quand il y a au moins cinq sections ;
 *  - « Revenir au sommaire » avant chaque H2 sauf le premier, au-delà de 2 500 mots ;
 *  - la coupe juste avant la 4e section, là où le gabarit insère l'encart du milieu.
 * Idempotent : les repères déjà posés sont retirés puis reposés.
 */

export const SEUIL_MOTS_RETOUR_SOMMAIRE = 2500;
/** L'encart du milieu s'insère après cette section (la 3e). */
export const SECTIONS_AVANT_ENCART = 3;
/** Nombre minimal de sections pour poser une relance. */
const SECTIONS_MIN_RELANCE = 5;

export interface LibellesAnalyse {
  /** « Lien vers la section « {titre} » » (titre en texte brut, échappé ici). */
  readonly ancreLabel: (titre: string) => string;
  readonly relanceLibelle: string;
  /** `null` quand le sommaire n'est pas rendu : aucun lien de retour (cible absente). */
  readonly retourLibelle: string | null;
  /** `id` de la cible « sommaire » posée par le gabarit. */
  readonly ancreSommaire: string;
}

const ENTITES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": "\u00a0",
  "&#8239;": "\u202f",
};

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function texteBrut(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|nbsp|#39|#8239);/g, (e) => ENTITES[e] ?? e)
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

export function compterMots(html: string): number {
  const t = texteBrut(html.replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi, ""));
  return t === "" ? 0 : t.split(/[ \u00a0\u202f]+/).length;
}

const RE_H2 = /<h2\b[^>]*?\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g;
const RE_REPERES =
  /<div class="num-section">[\s\S]*?<\/div>|<p class="(?:relance|retour-sommaire)">[\s\S]*?<\/p>/g;

export function preparerCorpsAnalyse(
  htmlBrut: string,
  l: LibellesAnalyse,
): { avant: string; apres: string } {
  const html = htmlBrut.replace(RE_REPERES, "");
  const h2 = [...html.matchAll(RE_H2)].map((m) => ({
    debut: m.index ?? 0,
    id: m[1] ?? "",
    titre: texteBrut(m[2] ?? ""),
  }));
  if (h2.length === 0) return { avant: html, apres: "" };

  const total = h2.length;
  const avecRetour = l.retourLibelle !== null && compterMots(html) > SEUIL_MOTS_RETOUR_SOMMAIRE;
  const largeur = (n: number) => String(n).padStart(2, "0");
  let coupe = -1;
  let sortie = html.slice(0, h2[0]?.debut ?? 0);

  h2.forEach((s, i) => {
    const fin = h2[i + 1]?.debut ?? html.length;
    let repere = "";
    // Relance et retour closent la section précédente : ils précèdent le numéro de celle-ci.
    if (i === SECTIONS_AVANT_ENCART && total >= SECTIONS_MIN_RELANCE) {
      repere += `<p class="relance"><span><strong>${echapper(l.relanceLibelle)}</strong> <a href="#${echapper(s.id)}">${echapper(s.titre)}</a></span></p>`;
    }
    if (avecRetour && i > 0) {
      repere += `<p class="retour-sommaire"><a href="#${echapper(l.ancreSommaire)}">${echapper(l.retourLibelle ?? "")}</a></p>`;
    }
    if (i === SECTIONS_AVANT_ENCART) coupe = sortie.length + repere.length;
    repere += `<div class="num-section"><span aria-hidden="true">${largeur(i + 1)} / ${largeur(total)}</span><a class="ancre" href="#${echapper(s.id)}" aria-label="${echapper(l.ancreLabel(s.titre))}">#</a></div>`;
    sortie += repere + html.slice(s.debut, fin);
  });

  return coupe < 0
    ? { avant: sortie, apres: "" }
    : { avant: sortie.slice(0, coupe), apres: sortie.slice(coupe) };
}
