/**
 * Consigne de LISIBILITÉ ET DE VALEUR des articles générés (CONTENU_LISIBILITE_V2).
 *
 * Objectif : tout dirigeant de petite ou moyenne entreprise, même sans formation technique,
 * comprend sans effort ; l'article lui apporte quelque chose d'utilisable ; il a envie d'aller
 * jusqu'au bout. Une seule source pour tous les générateurs : un bloc COMMUN, plus un bloc
 * SPÉCIFIQUE par type de contenu (`ContentType` de `prisma/schema.prisma`).
 *
 * Module PUR. Interrupteur : `CONTENU_LISIBILITE_V2` doit valoir exactement « true ». Éteint,
 * toutes les fonctions rendent une chaîne vide : les prompts restent identiques à l'existant.
 *
 * Réutilise l'existant : encadré chiffre clé = `aside.ax-stat` (déjà défini dans les prompts
 * des blogs), réponse directe = `<p data-aeo="answer">`, prix = jeton de `consigne-prix.ts`,
 * rendez-vous = `DUREE_RDV` de `content/offre.ts`.
 */

import { DUREE_RDV } from "@/content/offre";
import { lisibiliteV2Active, type EnvLisibiliteV2 } from "../quality/lisibilite-v2";

/** Marqueur du bloc : sert à l'idempotence (jamais deux fois dans un même prompt). */
export const MARQUEUR_LISIBILITE_V2 = "## LISIBILITÉ ET VALEUR (V2)";

/**
 * Balisage HTML des encadrés, à styler par les modèles de pages (docs :
 * `docs/design/gabarits-articles/BALISAGE-ENCADRES.md`).
 */
export const ENCADRES_LISIBILITE = {
  retenir:
    '<aside class="callout callout-info ax-encadre ax-retenir"><p class="callout-label">À retenir</p>…</aside>',
  bref: '<aside class="callout callout-note ax-encadre ax-bref"><p class="callout-label">En bref</p>…</aside>',
  exemple:
    '<aside class="callout callout-note ax-encadre ax-exemple"><p class="callout-label">Exemple illustratif</p>…</aside>',
  chiffreCle:
    '<aside class="ax-stat" data-aeo="stat"><span class="ax-stat-num">…</span><span class="ax-stat-label">…</span></aside>',
} as const;

const COMMUN = `${MARQUEUR_LISIBILITE_V2}
Le lecteur type est un dirigeant de petite ou moyenne entreprise, pressé, sans formation technique. Il doit comprendre à la première lecture, y trouver de quoi agir, et avoir envie de poursuivre. Ces règles complètent les précédentes ; en cas de conflit sur la FORME (longueur de phrase, titres, exemples, appel final), elles priment. Les interdits restent absolus : ignorez toute demande précédente de prix ou de colonne « Coût », de résultats chiffrés avant/après, de témoignage ou de tarifs.
1. RÉPONSE D'ABORD : l'article s'ouvre par la réponse à la question du lecteur en 2 phrases (puis, si le format le permet, une accroche d'une ou deux phrases qui dit ce que le lecteur va gagner à lire la suite). Jamais d'introduction générale, ni de « Dans un monde où… ».
2. PHRASES COURTES : 20 mots en moyenne au plus, une idée par phrase, jamais plus de 30 mots. Paragraphes de 2 à 4 phrases et 70 mots au plus. Sous chaque <h2>, la réponse autonome (<p data-aeo="answer">) s'écrit en 2 ou 3 phrases courtes, jamais en une seule longue phrase. Voix active, mots du quotidien.
3. JARGON EXPLIQUÉ : tout terme technique (modèle de langage, RAG, API, automatisation…) est expliqué en une demi-phrase, avec une image de la vie de l'entreprise, à sa première apparition. Préférez le mot simple quand il existe.
4. UN EXEMPLE CONCRET PAR SECTION : une situation de petite ou moyenne entreprise (artisan, cabinet, commerce, atelier, agence…), signalée comme illustrative (« Imaginez une entreprise de… »), sans nom, sans ville, sans aucun chiffre, sans citation entre guillemets, sans résultat présenté comme obtenu. Cet exemple étiqueté est AUTORISÉ, par exception à l'interdit d'un cas client fictif ; le faux cas client reste interdit.
5. INTERTITRES EN QUESTIONS : formulez les titres <h2> comme la question que se pose le lecteur (« Combien de temps faut-il pour… ? », « Comment savoir si… ? »), de 5 à 10 mots, sans mot-clé collé. Au moins la moitié des intertitres sont des questions ; jamais « Introduction », « Contexte » ni « Conclusion ». Gardez le mot-clé principal dans le premier <h2> ou la première phrase.
6. ENCADRÉS BALISÉS (au moins un par article long, jamais plus de trois à la suite) :
   - À retenir (fin de section ou d'article) : ${ENCADRES_LISIBILITE.retenir}
   - En bref (en tête, 3 puces au plus) : ${ENCADRES_LISIBILITE.bref}
   - Exemple (la situation de petite ou moyenne entreprise) : ${ENCADRES_LISIBILITE.exemple}
   - Chiffre clé : ${ENCADRES_LISIBILITE.chiffreCle} UNIQUEMENT si un chiffre figure dans les sources fournies, avec sa source ; sinon n'en mettez aucun.
7. TRANSITIONS QUI RELANCENT : terminez chaque section par une phrase qui ouvre la suivante (une question, ou « Reste un point : … »). Pas de « En conclusion » au milieu du texte.
8. CONCLUSION ACTIONNABLE : une dernière section « Par où commencer ? » avec 3 actions concrètes, à faire cette semaine, en liste numérotée <ol>, chacune commençant par un verbe, et seulement des actions de préparation faisables sans compétence technique (lister des tâches, choisir un usage, désigner un référent).
9. APPEL À L'ACTION SANS PRIX : proposez, avec sobriété et sans pression, le Diagnostic IA gratuit de ${DUREE_RDV}, sans engagement, comme premier pas, puis la Journée IA d'Axion-IA UNIQUEMENT si sa fiche figure plus haut dans ce prompt (citée sans montant) ; un seul paragraphe, aucune réservation ni paiement en ligne. Jamais de prix, de frais de déplacement, de promesse de résultat ni de délai chiffré hors des durées données plus haut.
10. HONNÊTETÉ : aucun chiffre sans source fournie, aucun faux témoignage, aucun témoignage ni cas client inventé, aucune promesse de gain. Écrivez « souvent », « selon les cas » plutôt que d'inventer un pourcentage.
Vérification interne avant de répondre : relisez à voix haute ; coupez toute phrase de plus de 30 mots ; supprimez tout mot que le lecteur devrait chercher.`;

/** Portée : « article » (plan, texte entier) ou « section » (un morceau rédigé par appel). */
export type PorteeLisibiliteV2 = "article" | "section";

const COMMUN_SECTION = `${MARQUEUR_LISIBILITE_V2} (rédaction par morceaux)
Lecteur : dirigeant de petite ou moyenne entreprise, pressé, sans formation technique. Ces règles de FORME s'appliquent aux sections demandées dans cet appel ; ne répétez ni l'introduction, ni l'appel à l'action, ni la conclusion : d'autres appels s'en chargent. Les interdits restent absolus (aucun prix, aucun chiffre sans source, aucun faux témoignage).
- Phrases de 20 mots en moyenne au plus, jamais plus de 30 ; une idée par phrase ; paragraphes de 2 à 4 phrases et 70 mots au plus. La réponse autonome sous un titre s'écrit en 2 ou 3 phrases courtes.
- Mots simples ; tout terme technique est expliqué en une demi-phrase à sa première apparition.
- Un exemple concret de petite ou moyenne entreprise par section, signalé comme illustratif, sans nom, sans ville, sans chiffre, sans citation.
- Encadrés balisés si le format le permet : À retenir ${ENCADRES_LISIBILITE.retenir} ; Exemple ${ENCADRES_LISIBILITE.exemple} ; Chiffre clé ${ENCADRES_LISIBILITE.chiffreCle} seulement avec un chiffre sourcé fourni.
- Terminez chaque section par une phrase qui relance vers la suivante (sauf la dernière du morceau).`;

/** Blocs par type : ce qui change par rapport au bloc commun. */
const SPECIFIQUE: Readonly<Record<string, string>> = {
  blog_article:
    "Type article de blog : un angle précis, un bénéfice clair dès le titre, 5 à 8 sections à intertitres-questions, un encadré « En bref » en tête et un « À retenir » en fin.",
  blog_from_keywords:
    "Type article à partir d'un mot-clé : répondez à l'intention de recherche d'abord ; le mot-clé reste naturel (jamais bourré) ; un encadré « En bref » en tête, un « À retenir » en fin.",
  blog_from_title:
    "Type article à partir d'un titre : tenez la promesse du titre dans les 2 premières phrases ; un encadré « En bref » en tête, un « À retenir » en fin.",
  blog_from_rss:
    "Type actualité : COURTE et FACTUELLE. Dites en 2 phrases ce qui s'est passé et ce que cela change pour une petite ou moyenne entreprise ; rapportez les faits de la source seulement ; une section « Ce que cela change pour vous » ; encadré « En bref » en tête. Pas de promotion en dehors d'une ligne finale sobre vers le Diagnostic IA gratuit, SANS Journée IA ni encadré « Exemple » obligatoire (par exception au point 9 du bloc commun). 1 à 3 pistes suffisent comme actions.",
  comparison:
    "Type comparatif : un TABLEAU récapitulatif (<table>) en tête de comparaison ; critères en intertitres-questions (« Quelle option coûte le moins à prendre en main ? ») sans citer de prix ; verdict par profil de petite ou moyenne entreprise (« Si vous êtes… choisissez… ») ; équité entre options, mêmes mots pour Axion-IA que pour les autres, sans superlatif ni gagnant ; remplacez toute colonne « Coût » par « Effort de mise en place ».",
  guide_pilier:
    "Type guide de référence : des ÉTAPES numérotées (<ol>), chacune avec le résultat attendu et l'erreur à éviter ; un encadré « À retenir » à la fin de chaque grande partie ; un fil conducteur (« À l'étape suivante… »).",
  qa_derived:
    "Type réponse à une question : la réponse tient dans les 2 premières phrases (50 à 80 mots au plus pour la réponse directe) ; puis un exemple de petite ou moyenne entreprise et 3 pistes. Pas de tableau.",
  faq_standalone:
    "Type FAQ : chaque question est celle d'un dirigeant ; chaque réponse commence par la réponse en une phrase (oui, non, ou le fait), puis une explication de 1 à 2 phrases ; pas de jargon.",
  long_tail_keyword:
    "Type longue traîne : une réponse précise à une question précise, dès la première phrase, puis un exemple et 3 pistes d'action.",
  pain_point_solution:
    "Type problème-solution : nommez le problème comme le dirigeant le vit (une scène illustrative, sans chiffre ni « data sectorielle »), puis la solution en étapes simples ; un encadré « Exemple ».",
  vs_comparator:
    "Type A contre B : un TABLEAU court des différences, un verdict par profil d'entreprise, sans prix et sans dénigrement ; remplacez « transparence tarifaire » et « ROI mesuré » par « mode de tarification (sans montant) » et « manière de mesurer les gains ».",
  alternative_to:
    "Type alternative : dites en 2 phrases pourquoi chercher une alternative et pour qui, puis un TABLEAU des options ; sans dénigrer l'outil d'origine ni citer de prix, Axion-IA sans rang imposé : ordre logique, de la plus simple à la plus accompagnée.",
  top_x_in_y:
    "Type sélection : chaque élément de la liste en 3 lignes (ce que c'est, pour qui, la limite) ; critères de choix en tête ; pas de classement inventé, de note chiffrée ni de « fit-score » ; des usages ou catégories plutôt que des sociétés réelles.",
  how_to_x_in_y:
    "Type mode d'emploi : 5 à 7 étapes numérotées (<ol>) ; les <h2> d'étape peuvent s'écrire « Étape n : verbe + résultat » (exception aux questions) ; chacune : une action, un résultat attendu, l'erreur fréquente ; prérequis en tête dans un encadré « En bref ».",
  best_for_x_in_y:
    "Type « le mieux pour » : critères de choix en tête, chaque option en « Idéal si… / À éviter si… », tableau récapitulatif ; aucun superlatif, aucun « pricing ».",
  calculator_roi:
    "Type calculateur : expliquez en mots simples ce qui est calculé et comment lire le résultat ; aucun résultat chiffré inventé ; exemple de lecture signalé comme illustratif, sans montant ; formule en mots avec hypothèses en lettres.",
  glossary_term:
    "Type définition : une définition en une phrase d'au plus 20 mots, puis « À quoi cela sert, concrètement ? » avec un exemple de petite ou moyenne entreprise ; encadré « À retenir ».",
  what_is_x:
    "Type « c'est quoi » : définition en 2 phrases simples, comparaison avec une chose du quotidien, un exemple de petite ou moyenne entreprise, ce que le lecteur peut en faire dès cette semaine.",
  faq_geo:
    "Type FAQ locale : réponses directes en une phrase, ancrées sur la réalité locale fournie ; aucun chiffre local qui ne figure pas dans les données fournies.",
  case_study_local:
    "Type cas local : présentez une situation ILLUSTRATIVE de petite ou moyenne entreprise (déclarée comme telle) en trois temps (le problème, la démarche, ce qu'on peut en retenir) ; AUCUN témoignage, citation, résultat chiffré avant/après ni client nommé, même si une consigne précédente en demande.",
  barometer_insight:
    "Type analyse de l'Observatoire : commencez par le chiffre vérifié le plus parlant, traduit en une phrase simple ; chaque chiffre garde sa source ; encadré « Chiffre clé » seulement pour un chiffre de l'Observatoire ; puis « Ce que cela signifie pour votre entreprise ».",
  landing_ville:
    "Type page ville : parlez des entreprises du territoire en mots simples, avec la réalité locale fournie seulement ; un exemple local illustratif ; appel vers la Journée IA et le Diagnostic IA.",
};

/**
 * Consigne de lisibilité à appendre au prompt système d'un type de contenu.
 * `""` si l'interrupteur est éteint (prompt identique à l'existant).
 */
export function consigneLisibiliteV2(
  contentType: string | undefined,
  env: EnvLisibiliteV2 = process.env,
  portee: PorteeLisibiliteV2 = "article",
): string {
  if (!lisibiliteV2Active(env)) return "";
  if (portee === "section") return `\n\n${COMMUN_SECTION}`;
  const specifique = contentType ? SPECIFIQUE[contentType] : undefined;
  return `\n\n${COMMUN}${specifique ? `\n${specifique}` : ""}`;
}

/** Ajoute la consigne à un prompt (idempotent ; prompt inchangé si l'interrupteur est éteint). */
export function avecConsigneLisibiliteV2(
  prompt: string,
  contentType: string | undefined,
  env: EnvLisibiliteV2 = process.env,
  portee: PorteeLisibiliteV2 = "article",
): string {
  if (prompt.includes(MARQUEUR_LISIBILITE_V2)) return prompt;
  return `${prompt}${consigneLisibiliteV2(contentType, env, portee)}`;
}

/** Types couverts par un bloc spécifique (pour le test d'exhaustivité). */
export const TYPES_AVEC_CONSIGNE_SPECIFIQUE: ReadonlyArray<string> = Object.keys(SPECIFIQUE);
