/**
 * Content Generator — contrôle simple du vouvoiement (lot R6, audit d'harmonie
 * du 08/11/2026).
 *
 * Axion-IA vouvoie ses lecteurs. Les prompts l'imposent (`brand-voice.ts`) ;
 * ce contrôle PUR vérifie que le texte généré n'est pas au tutoiement.
 *
 * Volontairement étroit, pour ne pas crier au loup :
 *  - seuls les mots entiers « tu », « toi », « tes » et les formes élidées « t'es »,
 *    « t'as »… comptent. « ton » et « ta » sont exclus (« le ton de l'étude ») ;
 *  - les citations « entre guillemets français », les blocs <pre>, <code>,
 *    <blockquote> et <q> sont ignorés (un article sur les prompts cite des
 *    consignes écrites au tutoiement : ce n'est pas la voix de l'article).
 *
 * Fonction pure : ni base, ni Next.
 */

export interface ResultatTutoiement {
  readonly tutoie: boolean;
  readonly occurrences: number;
  /** Court extrait autour de la première occurrence (vide si aucune). */
  readonly extrait: string;
}

const AUCUN: ResultatTutoiement = { tutoie: false, occurrences: 0, extrait: "" };

/** Début de mot : ni lettre ni chiffre juste avant (le trait d'union reste permis : « peux-tu »). */
const DEBUT = "(?<![\\p{L}\\p{N}])";
/** Fin de mot : ni lettre ni chiffre juste après. */
const FIN = "(?![\\p{L}\\p{N}])";

const MOTIF_TUTOIEMENT = new RegExp(
  `${DEBUT}(?:tu${FIN}|toi${FIN}|tes${FIN}|t'(?=[\\p{L}]))`,
  "giu",
);

/** Retire ce qui n'est pas la voix de l'article : code, citations, balises. */
function texteDeLaVoix(html: string): string {
  return html
    .replace(/<(pre|code|blockquote|q)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/&laquo;|&#171;/gi, "«")
    .replace(/&raquo;|&#187;/gi, "»")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&rsquo;|&#8217;|&#39;|&apos;/gi, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/[’ʼ]/g, "'")
    .replace(/«[^»]*»/g, " ")
    .replace(/“[^”]*”/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cherche le tutoiement dans un texte (HTML accepté). */
export function detecterTutoiement(texte: string): ResultatTutoiement {
  if (!texte) return AUCUN;
  const voix = texteDeLaVoix(texte);
  const occ = [...voix.matchAll(MOTIF_TUTOIEMENT)];
  if (occ.length === 0) return AUCUN;
  const premiere = occ[0]!;
  const debut = premiere.index ?? 0;
  return {
    tutoie: true,
    occurrences: occ.length,
    extrait: voix.slice(Math.max(0, debut - 25), debut + premiere[0].length + 25).trim(),
  };
}
