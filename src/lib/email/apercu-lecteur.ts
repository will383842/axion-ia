// Module pur du lecteur d'e-mail (lot I0b-1) : utilisable dans le navigateur, le
// serveur et le proxy. Aucune dépendance, aucun accès à la base ni au réseau.
//
// ⚠️ Ces fonctions ne remplacent PAS `masquerSecretsEmail` : un aperçu avant
// envoi passe d'abord par lui, puis par `rendreLiensInertes`. Ici, l'URL gardée
// dans `title` est tout de même repassée par `masquerSecretsTexte`, pour qu'un
// lien non masqué ne laisse jamais son jeton dans la page.

import { MASQUE_SECRET, masquerSecretsTexte } from "@/lib/email/masquer-secrets";

/** Une pièce jointe vue par l'aperçu : nom, poids, et lien « Ouvrir » (route admin protégée). */
export interface PieceJointeApercu {
  nom: string;
  /** Poids en octets du fichier que l'envoi joindra. */
  taille?: number | null | undefined;
  /** Adresse de la route admin qui sert ce fichier ; absente = pas de bouton « Ouvrir ». */
  href?: string | null | undefined;
  /** Précision à afficher (ex. « ne sera pas jointe : introuvable »). */
  remarque?: string | null | undefined;
}

export interface ApercuLecteur {
  html: string;
  texte?: string | null | undefined;
  objet?: string | null | undefined;
  de?: string | null | undefined;
  a?: string | null | undefined;
  repondreA?: string | null | undefined;
  preEntete?: string | null | undefined;
  /** Noms seuls (anciens appelants) ou pièces décrites. `[]` = « Aucune pièce jointe ». */
  piecesJointes?: readonly (string | PieceJointeApercu)[] | null | undefined;
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
export function rendreLiensInertes(
  html: string,
  options: { garder?: (adresse: string) => boolean } = {},
): string {
  return html.replace(BALISE, (balise, nom: string, attrs: string) => {
    const n = nom.toLowerCase();
    let reste = attrs.replace(ATTRIBUT_ACTION, "");
    let titre = "";
    let gardeUnLien = false;
    if (n === "a" || n === "area") {
      reste = reste.replace(
        ATTRIBUT_LIEN,
        (m, dbl: string | undefined, sgl: string | undefined, nu: string | undefined) => {
          const url = dbl ?? sgl ?? nu ?? "";
          // Lien ouvrable (aperçu) : seulement une balise <a>, jamais une zone d'image.
          if (n === "a" && options.garder?.(decoderEntites(url).trim()) === true) {
            gardeUnLien = true;
            return m;
          }
          if (titre === "" && url.trim() !== "") titre = masquerSecretsTexte(url.trim()).sortie;
          return "";
        },
      );
    }
    if (gardeUnLien) {
      // Nouvel onglet, sans rien transmettre à la page ouverte.
      reste = reste
        .replace(/\s(?:target|rel)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+)/gi, "")
        .replace(/\s*\/\s*$/, "");
      const fermeture = /\/\s*$/.test(attrs) ? " /" : "";
      return `<${nom}${reste} target="_blank" rel="noopener noreferrer"${fermeture}>`;
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

export function decoderEntites(s: string): string {
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

/** L'adresse est-elle un lien PUBLIC, ouvrable sans risque depuis l'aperçu ? `http(s)` et aucun secret masqué. */
export function estLienOuvrable(adresse: string): boolean {
  if (!/^https?:\/\//i.test(adresse)) return false;
  let lisible = adresse;
  try {
    lisible = decodeURIComponent(adresse);
  } catch {
    // adresse mal encodée : on garde la forme brute
  }
  return !lisible.includes(MASQUE_SECRET) && !adresse.includes(MASQUE_SECRET);
}

/**
 * Pour l'aperçu AVANT ENVOI, APRÈS `masquerSecretsEmail` : garde `href` sur les liens publics
 * (ouverts dans un nouvel onglet), retire-le sur tout le reste (lien personnel du destinataire :
 * son jeton est masqué ; `mailto:`, `tel:`…), formulaires compris. Le jeton n'atteint donc jamais le
 * navigateur : un lien à usage unique ne peut pas être consommé depuis l'aperçu.
 * `exclure` : préfixes d'adresses à ne jamais rendre ouvrables, ex. un lien fictif d'aperçu.
 */
export function rendreLiensOuvrables(html: string, options: { exclure?: readonly string[] } = {}) {
  const exclure = options.exclure ?? [];
  return rendreLiensInertes(html, {
    garder: (adresse) => estLienOuvrable(adresse) && !exclure.some((x) => adresse.startsWith(x)),
  });
}

export interface LienEmail {
  /** Texte du bouton ou du lien, tel que le lit le destinataire. */
  texte: string;
  /** Adresse complète (masquée si personnelle). */
  adresse: string;
  /** `ouvrable` : cliquable ; `personnel` : lien propre au destinataire, jamais cliquable ; `autre` : `mailto:`, `tel:`… */
  genre: "ouvrable" | "personnel" | "autre";
}

const LIEN_COMPLET = /<a\b((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/a\s*>/gi;
const ATTRIBUT_TITRE = /(?<=[\s"'/])title\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i;

function texteDuLien(interieur: string): string {
  const alt = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(interieur);
  const brut = decoderEntites(interieur.replace(/<[^>]*>/g, " "))
    .replace(INVISIBLES, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (brut !== "") return brut;
  const image = decoderEntites((alt?.[1] ?? alt?.[2] ?? "").trim());
  return image !== "" ? `(image : ${image})` : "(lien sans texte)";
}

/**
 * Les liens de l'e-mail, dans l'ordre : texte → adresse. À appeler sur le HTML déjà masqué (et
 * traité par `rendreLiensOuvrables`) : un lien dont `href` a été retiré garde son adresse masquée
 * dans `title` et sort `personnel`. Sans doublon (même texte, même adresse).
 */
export function extraireLiens(html: string): LienEmail[] {
  const vus = new Set<string>();
  const liens: LienEmail[] = [];
  for (const m of html.matchAll(LIEN_COMPLET)) {
    const attrs = m[1] ?? "";
    const href = new RegExp(ATTRIBUT_LIEN.source, "i").exec(attrs);
    const titre = ATTRIBUT_TITRE.exec(attrs);
    const adresseHref = decoderEntites((href?.[1] ?? href?.[2] ?? href?.[3] ?? "").trim());
    const adresseTitre = decoderEntites((titre?.[1] ?? titre?.[2] ?? titre?.[3] ?? "").trim());
    const adresse = adresseHref !== "" ? adresseHref : adresseTitre;
    if (adresse === "" || adresse.startsWith("#")) continue;
    let genre: LienEmail["genre"];
    if (adresseHref !== "") genre = estLienOuvrable(adresseHref) ? "ouvrable" : "autre";
    else genre = /^https?:\/\//i.test(adresse) ? "personnel" : "autre";
    const texte = texteDuLien(m[2] ?? "");
    const cle = `${texte}\u0000${adresse}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    liens.push({
      texte,
      adresse: genre === "ouvrable" ? adresse : masquerSecretsTexte(adresse).sortie,
      genre,
    });
  }
  return liens;
}

/** « 1,2 Mo », « 340 Ko », « 812 octets » : le poids d'un fichier en français. */
export function libelleTaille(octets: number): string {
  if (octets < 1024) return `${octets} octet${octets > 1 ? "s" : ""}`;
  const nombre = (n: number) => n.toFixed(1).replace(".", ",").replace(/,0$/, "");
  if (octets < 1_048_576) return `${nombre(octets / 1024)} Ko`;
  return `${nombre(octets / 1_048_576)} Mo`;
}
