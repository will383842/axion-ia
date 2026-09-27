/**
 * Masque les LIENS PERSONNELS d'un e-mail rendu, avant d'en garder la copie.
 *
 * ## Pourquoi masquer, et pas « ne pas copier ces gabarits »
 *
 * La console montre désormais l'e-mail tel qu'il est parti (Emails › Envoyés).
 * Or une vingtaine de gabarits portent un lien qui VAUT un geste : signer une
 * convention (`/portail/signer/<jeton>`), émarger, se connecter (lien magique),
 * télécharger son export RGPD, confirmer une inscription, se désinscrire (le
 * lien d'opposition signé du pied de page, présent sur TOUTES les familles B,
 * C, D). Les laisser lisibles dans la console, c'est permettre à quiconque y a
 * accès — lecteur compris — de signer, émarger ou se connecter à la place du
 * destinataire. `_layout.tsx` le dit déjà du CTA (« L'URL du CTA est un
 * SECRET ») : on ne l'imprime même pas en texte brut dans l'e-mail.
 *
 * Une liste de gabarits « à ne pas copier » aurait deux défauts : elle perdrait
 * justement les e-mails qu'on veut relire (une convention envoyée, une
 * convocation), et elle vieillirait — le lien d'opposition, ajouté au châssis
 * en septembre, aurait échappé à toute liste écrite avant. On masque donc la
 * FORME du secret, où qu'il soit : c'est une règle, pas un inventaire.
 *
 * ## La règle
 *
 * Pour chaque URL `http(s)` du HTML ou du texte :
 *  · la valeur d'un paramètre de requête est masquée si son NOM dit un secret
 *    (`token`, `t`, `jeton`, `sig`, `code`, `pwd`…) ou si la VALEUR a la forme
 *    d'un jeton ;
 *  · un segment de chemin est masqué s'il a la forme d'un jeton ;
 *  · un fragment (`#…`) non trivial est masqué (Stripe y range sa session) ;
 *  · un lien de visioconférence (Meet, Zoom, Teams) perd son chemin : le code
 *    de réunion donne l'accès à la salle.
 *
 * « Forme d'un jeton » : au moins 16 caractères sûrs pour une URL, et PAS un
 * slug lisible (mots en minuscules de 14 caractères au plus, séparés par des
 * tirets). Un UUID est un jeton — il identifie une ressource nominative.
 *
 * ⚠️ Ce qui est gardé : le domaine et le chemin lisible
 * (`https://axion-ia.com/portail/signer/[masqué]`). On voit QUEL lien la
 * personne a reçu, pas le moyen de le rejouer.
 *
 * Module pur — aucun accès base, aucun import serveur : il tourne dans le
 * worker (`copie-envoi.ts`) et dans les tests.
 */

/** Ce qui remplace un secret. Crochets : ils ne sont jamais pris pour une URL. */
export const MASQUE_SECRET = "[masqué]";

/** Noms de paramètres dont la valeur est un secret, quelle que soit sa forme. */
const NOM_PARAM_SECRET =
  /^(t|k|p|s|token|jeton|key|cle|code|sig|signature|secret|hash|otp|auth|pwd|pass|password|nonce|state|email|e)$/i;
const NOM_PARAM_SECRET_PARTIEL = /token|jeton|secret|signature|passw|apikey|api_key/i;

/** Hôtes de visioconférence : le chemin EST la clé de la salle. */
const HOTES_VISIO = /(^|\.)(meet\.google\.com|zoom\.us|teams\.microsoft\.com|whereby\.com)$/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Un mot de slug est lisible s'il est fait de LETTRES (jusqu'à 24 :
 * « confidentialite », « intelligence »), ou s'il est court (12 au plus :
 * « 2026 », « v2 »). Un long mot qui mêle chiffres et lettres est un jeton.
 */
function motLisible(mot: string): boolean {
  return (/^[a-z]+$/.test(mot) && mot.length <= 24) || mot.length <= 12;
}

function estSlugLisible(brut: string): boolean {
  return SLUG.test(brut) && brut.split("-").every(motLisible);
}
const CARACTERES_JETON = /^[A-Za-z0-9._~%+=-]+$/;

/** Vrai si la chaîne a la forme d'un jeton (et non d'un mot ou d'un slug). */
export function aFormeDeJeton(brut: string): boolean {
  if (brut.length < 16) return false;
  if (!CARACTERES_JETON.test(brut)) return false;
  if (UUID.test(brut)) return true;
  // Un slug lisible (`formation-ia-entreprise`) n'est pas un secret.
  if (estSlugLisible(brut)) return false;
  // Une extension de fichier courte sur un nom lisible (`catalogue-2026.pdf`).
  if (/^[a-z0-9-]+\.[a-z0-9]{2,4}$/.test(brut) && estSlugLisible(brut.split(".")[0] ?? "")) {
    return false;
  }
  return true;
}

/**
 * URL `http(s)` dans du HTML ou du texte : caractères ASCII d'URL SEULEMENT.
 *
 * 🔴 Mesuré sur `documents-nouvelle-version` : la version texte colle l'URL au
 * libellé suivant (`…/emarger/<jeton>Télécharger le PDF`). Avec « tout sauf
 * espace », le segment devenait `<jeton>Télécharger`, que l'accent faisait
 * passer pour un mot — et le jeton restait en clair. L'URL s'arrête donc au
 * premier caractère qui ne peut pas figurer dans une URL. Les crochets et les
 * guillemets en sont exclus aussi (idempotence du masque, fin d'attribut).
 */
const URL_DANS_TEXTE = /https?:\/\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%]+/g;

interface Compteur {
  n: number;
}

function masquerRequete(requete: string, c: Compteur): string {
  // Dans un attribut HTML, `&` est écrit `&amp;` : on garde le séparateur tel quel.
  return requete
    .split(/(&amp;|&)/)
    .map((morceau) => {
      if (morceau === "&" || morceau === "&amp;" || morceau === "") return morceau;
      const egal = morceau.indexOf("=");
      if (egal < 0) return morceau;
      const nom = morceau.slice(0, egal);
      const valeur = morceau.slice(egal + 1);
      if (valeur === "" || valeur === MASQUE_SECRET) return morceau;
      const secret =
        NOM_PARAM_SECRET.test(nom) || NOM_PARAM_SECRET_PARTIEL.test(nom) || aFormeDeJeton(valeur);
      if (!secret) return morceau;
      c.n += 1;
      return `${nom}=${MASQUE_SECRET}`;
    })
    .join("");
}

function masquerUneUrl(url: string, c: Compteur): string {
  const m = /^(https?:\/\/)([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(url);
  if (!m) return url;
  const [, schema, hote, chemin = "", requete = "", fragment = ""] = m;
  const hoteSeul = (hote ?? "").replace(/:\d+$/, "");

  let cheminMasque: string;
  if (HOTES_VISIO.test(hoteSeul) && chemin.replace(/\//g, "") !== "") {
    c.n += 1;
    cheminMasque = `/${MASQUE_SECRET}`;
  } else {
    cheminMasque = chemin
      .split("/")
      .map((seg) => {
        if (seg === "" || seg === MASQUE_SECRET) return seg;
        let decode = seg;
        try {
          decode = decodeURIComponent(seg);
        } catch {
          decode = seg;
        }
        if (aFormeDeJeton(seg) || aFormeDeJeton(decode)) {
          c.n += 1;
          return MASQUE_SECRET;
        }
        return seg;
      })
      .join("/");
  }

  const requeteMasquee = requete ? `?${masquerRequete(requete.slice(1), c)}` : "";

  let fragmentMasque = fragment;
  if (fragment.length > 8 && fragment !== `#${MASQUE_SECRET}`) {
    c.n += 1;
    fragmentMasque = `#${MASQUE_SECRET}`;
  }

  return `${schema}${hote}${cheminMasque}${requeteMasquee}${fragmentMasque}`;
}

/** Masque les liens personnels d'une chaîne (HTML ou texte). */
export function masquerSecretsTexte(entree: string): { sortie: string; masques: number } {
  const c: Compteur = { n: 0 };
  const sortie = entree.replace(URL_DANS_TEXTE, (url) => masquerUneUrl(url, c));
  return { sortie, masques: c.n };
}

export interface EmailAMasquer {
  subject: string;
  html: string;
  text: string;
}

/**
 * Masque objet, HTML et texte d'un e-mail rendu. `masques` compte les secrets
 * du HTML et du texte (un même lien y figure souvent deux fois).
 */
export function masquerSecretsEmail(e: EmailAMasquer): EmailAMasquer & { masques: number } {
  const objet = masquerSecretsTexte(e.subject);
  const html = masquerSecretsTexte(e.html);
  const texte = masquerSecretsTexte(e.text);
  return {
    subject: objet.sortie,
    html: html.sortie,
    text: texte.sortie,
    masques: objet.masques + html.masques + texte.masques,
  };
}
