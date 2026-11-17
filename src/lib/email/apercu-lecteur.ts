// Module pur du lecteur d'e-mail (lot I0b-1) : utilisable dans le navigateur, le
// serveur et le proxy. Aucune dépendance, aucun accès à la base ni au réseau.
//
// ⚠️ Ces fonctions ne remplacent PAS `masquerSecretsEmail` : un aperçu avant
// envoi passe d'abord par lui, puis par `rendreLiensInertes`. Ici, l'URL gardée
// dans `title` est tout de même repassée par `masquerSecretsTexte`, pour qu'un
// lien non masqué ne laisse jamais son jeton dans la page.

import { masquerSecretsTexte } from "@/lib/email/masquer-secrets";

export interface ApercuLecteur {
  html: string;
  texte?: string | null | undefined;
  objet?: string | null | undefined;
  de?: string | null | undefined;
  a?: string | null | undefined;
  repondreA?: string | null | undefined;
  preEntete?: string | null | undefined;
  piecesJointes?: readonly string[] | null | undefined;
}

const ORIGINE_SITE = "https://axion-ia.com";

/** Origines d'images autorisées dans le corps d'un e-mail : le site, et l'origine
 *  configurée du châssis. Liste UNIQUE, reprise par le lecteur, la route plein
 *  écran et la CSP. */
export function originesImagesCorpsEmail(): string[] {
  const liste = [ORIGINE_SITE];
  try {
    const configuree = process.env.NEXT_PUBLIC_SITE_URL;
    if (configuree) {
      const o = new URL(configuree).origin;
      if (o !== "null" && !liste.includes(o)) liste.push(o);
    }
  } catch {
    // URL invalide : on garde le seul domaine du site.
  }
  return liste;
}

/** Valeur de `img-src` d'un corps d'e-mail, sans `data:` : les origines, séparées par une espace. */
export function cspCorpsEmail(): string {
  return originesImagesCorpsEmail().join(" ");
}

// Une balise ouvrante : les valeurs entre guillemets peuvent contenir `>`.
const BALISE = /<([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const ATTRIBUT_LIEN = /(?<=[\s"'/])(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi;
const ATTRIBUT_ACTION = /(?<=[\s"'/])(?:form)?action\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+)/gi;

function echapperAttribut(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/**
 * Rend les liens inertes : retire `href` des `<a>` et `<area>`, `action` et
 * `formaction` de toute balise. L'URL (masquée) reste lisible dans `title`.
 * Le texte du lien n'est pas touché.
 */
export function rendreLiensInertes(html: string): string {
  return html.replace(BALISE, (balise, nom: string, attrs: string) => {
    const n = nom.toLowerCase();
    let reste = attrs.replace(ATTRIBUT_ACTION, "");
    let titre = "";
    if (n === "a" || n === "area") {
      reste = reste.replace(
        ATTRIBUT_LIEN,
        (_m, dbl: string | undefined, sgl: string | undefined, nu: string | undefined) => {
          const url = dbl ?? sgl ?? nu ?? "";
          if (titre === "" && url.trim() !== "") titre = masquerSecretsTexte(url.trim()).sortie;
          return "";
        },
      );
    }
    if (reste === attrs) return balise;
    const fermeture = /\/\s*$/.test(reste) ? " /" : "";
    const sansFin = fermeture ? reste.replace(/\s*\/\s*$/, "") : reste;
    const aTitre = /\stitle\s*=/i.test(sansFin);
    const ajout = titre !== "" && !aTitre ? ` title="${echapperAttribut(titre)}"` : "";
    return `<${nom}${sansFin}${ajout}${fermeture}>`;
  });
}

// Remplissage de react-email : espace insécable, joncteurs et marques invisibles, BOM.
const INVISIBLES = /[\u00a0\u200b-\u200f\u2028-\u202f\u2060\u034f\ufeff]/g;

function decoderEntites(s: string): string {
  return s
    .replaceAll("&nbsp;", " ")
    .replaceAll("&zwnj;", "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

/** Texte du bloc caché `<Preview>` de react-email, sans les caractères de remplissage. */
export function extrairePreEntete(html: string): string {
  const m = /<div\b[^>]*data-skip-in-text="true"[^>]*>([\s\S]*?)(?:<div\b|<\/div>)/i.exec(html);
  if (!m) return "";
  const brut = (m[1] ?? "").replace(/<[^>]*>/g, "");
  return decoderEntites(brut).replace(INVISIBLES, "").replace(/\s+/g, " ").trim();
}

/** Nombre d'images du corps hébergées hors des origines autorisées (bloquées par la CSP du cadre). */
export function compterImagesBloquees(html: string): number {
  const autorisees = originesImagesCorpsEmail();
  let n = 0;
  for (const m of html.matchAll(/<img\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi)) {
    const src = /\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i.exec(m[0]);
    const url = (src?.[1] ?? src?.[2] ?? src?.[3] ?? "").trim();
    if (!/^(?:https?:)?\/\//i.test(url)) continue; // data:, cid:, relatif : pas distant
    const absolu = url.startsWith("//") ? `https:${url}` : url;
    let origine = "";
    try {
      origine = new URL(absolu).origin;
    } catch {
      origine = "";
    }
    if (!autorisees.includes(origine)) n++;
  }
  return n;
}
