/**
 * Filtre de sujets hors cible — avant génération d'un article de blog.
 *
 * Audit blog/RAG du 24/10/2026 : des articles sortaient sur des sujets qui ne
 * visent pas la cible d'Axion-IA (dirigeant de TPE/PME qui entend parler d'IA
 * sans savoir par où commencer) : ETI et grands groupes, luxe, « devenir
 * formateur », sujets sans rapport avec l'IA.
 *
 * Module PUR (aucun import, aucune base, aucun réseau) : il ne fait que rendre un
 * verdict sur un mot-clé. Il n'écrit, ne supprime et ne déplace rien ; c'est
 * `selectKeywordRich` qui décide quoi faire d'un sujet écarté (passer au suivant).
 *
 * Ce n'est PAS la dédup des sujets : le blog a déjà la sienne
 * (`quality/dedup-guard`, `dedup/`, `paires-similaires`, `anti-duplicate-check`).
 */

export type RaisonSujetEcarte =
  "eti_hors_cible" | "grand_groupe" | "luxe" | "devenir_formateur" | "grenoble" | "sans_lien_ia";

export type VerdictSujet =
  { readonly accepte: true } | { readonly accepte: false; readonly raison: RaisonSujetEcarte };

/**
 * Minuscules, accents retirés, apostrophes et ponctuation ramenées à des espaces.
 * Les motifs ci-dessous sont écrits en ASCII sur ce texte normalisé : en
 * JavaScript sans drapeau `u`, `é` n'est pas une lettre de mot, donc `\b` ne
 * marche pas sur les mots accentués.
 */
function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Borne de mot explicite, valable sur du texte normalisé. */
function mots(alternatives: string): RegExp {
  return new RegExp(`(?<![a-z0-9])(?:${alternatives})(?![a-z0-9])`);
}

// Le sujet vise bien une petite structure : un mot « ETI » à côté ne le rend pas
// hors cible (« formation IA pour TPE, PME et ETI » reste un sujet TPE/PME).
const VISE_PETITE_STRUCTURE = mots(
  "tpe|pme|tpe pme|petites? entreprises?|tres petites? entreprises?|artisans?|commercants?|independants?|freelances?|auto entrepreneurs?|dirigeants? de (?:tpe|pme|petite entreprise)",
);

const ETI = mots("eti|etis|entreprises? de taille intermediaire");

const GRAND_GROUPE = mots(
  "grands? groupes?|grands? comptes?|grandes? entreprises?|grandes? organisations?|cac 40|cac40|sbf 120|fortune 500|multinationales?|groupes? internationaux|comex de grands? groupes?",
);

const LUXE = mots("luxe|haute couture|joaillerie|haute joaillerie|yachts?|jets? prives?");

const DEVENIR_FORMATEUR = mots(
  "devenir (?:un |une )?(?:formateur|formatrice|consultant|consultante|coach|prompt engineer|expert en ia|expert ia)|" +
    "(?:creer|ouvrir|monter|lancer) (?:son|un|une) (?:organisme|centre) de formation|" +
    "(?:metier|carriere) de (?:formateur|formatrice)|" +
    "reconversion (?:en )?(?:formateur|formatrice)",
);

const GRENOBLE = mots("grenoble");

/**
 * Lien avec l'IA ou l'automatisation. Volontairement large : le vivier contient
 * légitimement des sujets de la verticale « site web augmenté » (SEO, AEO,
 * schema.org), de conformité (AI Act, RGPD) et d'outils nommés, sans le mot
 * « IA ». On écarte ce qui n'a vraiment aucun rapport, pas ce qui est voisin.
 */
const LIEN_IA = mots(
  "ia|ai|ia generative|intelligence artificielle|ai act|ai literacy|chatgpt|gpt|gpt ?\\d+|openai|claude|anthropic|copilot|gemini|mistral|perplexity|midjourney|llm|llms|rag|chatbots?|agents?|prompts?|prompting|" +
    "automatis\\w*|automatiser|automation|workflows?|no code|nocode|n8n|zapier|robots?|rpa|" +
    "aeo|geo|answer engine\\w*|generative engine\\w*|seo|referencement|schema org|json ld|ai overviews?|" +
    "semantique|personnalisation|augmenter l existant|nlp|computer vision|vision par ordinateur|langage naturel|featured snippets?|position 0|position zero|web vitals|google|moteurs? de recherche|" +
    "machine learning|apprentissage automatique|deep learning|algorithmes?|vector\\w*|embeddings?|" +
    "numerique|digital\\w*|saas|api|site web|sites web|productivite|rgpd|cnil|donnees",
);

/**
 * Évalue un mot-clé candidat. Ordre des contrôles = ordre de gravité ; la
 * première raison trouvée est rendue (utile pour le journal).
 */
export function evaluerSujetCible(mot: string): VerdictSujet {
  const t = normaliser(mot);
  if (t.length === 0) return { accepte: false, raison: "sans_lien_ia" };

  if (GRENOBLE.test(t)) return { accepte: false, raison: "grenoble" };
  if (DEVENIR_FORMATEUR.test(t)) return { accepte: false, raison: "devenir_formateur" };
  if (LUXE.test(t)) return { accepte: false, raison: "luxe" };

  const vise = VISE_PETITE_STRUCTURE.test(t);
  if (!vise && GRAND_GROUPE.test(t)) return { accepte: false, raison: "grand_groupe" };
  if (!vise && ETI.test(t)) return { accepte: false, raison: "eti_hors_cible" };

  if (!LIEN_IA.test(t)) return { accepte: false, raison: "sans_lien_ia" };
  return { accepte: true };
}
