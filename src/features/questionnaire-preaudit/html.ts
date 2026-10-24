/**
 * Le HTML de Will, servi TEL QUEL (2026-10-24) — module PUR.
 *
 * On ne réécrit pas le questionnaire : on valide le fichier déposé, puis on insère, juste après
 * la déclaration `const CONFIG = {…};`, une instruction qui règle `endpoint`, `client` et la
 * notice RGPD. Le script de Will n'est pas modifié. En mode ESSAI, un bandeau est ajouté avant
 * `</body>`.
 */

/** 800 Ko : le fichier de Will en fait 131 Ko. */
export const HTML_MAX_OCTETS = 800_000;

const DECLARATION_CONFIG = /const CONFIG = \{[\s\S]*?\n\};/;

export type ValidationHtml = { readonly ok: true } | { readonly ok: false; readonly motif: string };

/** Le fichier déposé est-il bien une copie du questionnaire de Will ? */
export function validerHtml(html: string): ValidationHtml {
  if (Buffer.byteLength(html, "utf8") > HTML_MAX_OCTETS) {
    return { ok: false, motif: "Le fichier est trop gros (800 Ko au plus)." };
  }
  if (!/<html[\s>]/i.test(html) || !html.includes("</body>")) {
    return { ok: false, motif: "Ce fichier n'est pas une page HTML complète." };
  }
  if (!DECLARATION_CONFIG.test(html)) {
    return {
      ok: false,
      motif: "Le bloc « const CONFIG = {…}; » du questionnaire est introuvable.",
    };
  }
  if (!/schema:\s*3\b/.test(html)) {
    return { ok: false, motif: "Ce questionnaire n'envoie pas le « schéma 3 » attendu." };
  }
  return { ok: true };
}

/** JSON sûr dans un `<script>` : aucun `</script>` ni séparateur de ligne Unicode. */
function jsonSur(valeur: unknown): string {
  return JSON.stringify(valeur)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(new RegExp("\u2028", "g"), "\\u2028")
    .replace(new RegExp("\u2029", "g"), "\\u2029");
}

export interface OptionsPage {
  readonly endpoint: string;
  readonly client: string;
  readonly contact: string;
  readonly conservation: string;
  readonly essai: boolean;
}

const BANDEAU_ESSAI =
  '<div role="status" style="position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#b45309;' +
  'color:#fff;font:600 14px/1.4 system-ui,sans-serif;padding:10px 16px;text-align:center">' +
  "ESSAI — rien n&rsquo;est enregistr&eacute;, personne n&rsquo;est pr&eacute;venu. " +
  "Vous pouvez tout remplir et envoyer pour tester le parcours.</div>";

/** La page à servir : le HTML de Will + la configuration (+ le bandeau d'essai). */
export function pagePourClient(html: string, o: OptionsPage): string {
  const config = {
    endpoint: o.endpoint,
    client: o.client,
    rgpd: { contact: o.contact, conservation: o.conservation },
  };
  const injection =
    `\n/* — configuration du site — */\nObject.assign(CONFIG, { endpoint: ${jsonSur(config.endpoint)}, client: ${jsonSur(config.client)} });\n` +
    `Object.assign(CONFIG.rgpd, ${jsonSur(config.rgpd)});\n`;
  let page = html.replace(DECLARATION_CONFIG, (m) => m + injection);
  if (o.essai) page = page.replace("</body>", `${BANDEAU_ESSAI}</body>`);
  return page;
}
