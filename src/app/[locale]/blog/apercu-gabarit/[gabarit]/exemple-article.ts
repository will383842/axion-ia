/**
 * Article d'exemple figé pour la page d'aperçu des gabarits. Contenu volontairement
 * « pire cas » pour un téléphone : tableau large, mot très long, liste, citation,
 * sous-titres, image. Texte neutre : aucun chiffre ni client réel.
 */
import type { Locale } from "@/i18n/routing";
import type { GabaritArticle } from "@/server/content-gen/blog/gabarits";
import type { ArticleGabaritProps } from "@/components/article-v2/types";
import type { BlogArticleView } from "@/server/content-gen/blog/loader";

const PARAGRAPHE =
  "Une petite équipe gagne du temps quand chaque tâche répétitive a un responsable, un outil et une règle simple. Cet exemple sert uniquement à contrôler la mise en page : il ne décrit aucun client réel.";

const CORPS = `
<h2 id="contexte">Le contexte</h2>
<p>${PARAGRAPHE}</p>
<p>${PARAGRAPHE} Lien long : <a href="https://exemple.test/un/chemin/tres/long/pour/verifier/le/retour/a/la/ligne/sur/telephone">https://exemple.test/un/chemin/tres/long/pour/verifier/le/retour/a/la/ligne/sur/telephone</a>.</p>
<h2 id="la-demarche">La démarche</h2>
<p>${PARAGRAPHE}</p>
<h3 id="etapes">Les étapes</h3>
<ol><li>Lister les tâches qui se répètent chaque semaine.</li><li>Choisir une tâche et un responsable.</li><li>Mesurer le temps gagné après un mois.</li></ol>
<ul><li>Premier point de liste, assez long pour passer à la ligne sur un écran de 320 pixels de large.</li><li>Deuxième point de liste.</li></ul>
<blockquote><p>Une citation courte, mise en avant, pour vérifier les marges.</p></blockquote>
<h2 id="les-donnees">Les données</h2>
<table><caption>Comparaison de trois approches</caption><thead><tr><th scope="col">Approche</th><th scope="col">Délai de mise en place</th><th scope="col">Effort de l'équipe</th><th scope="col">Coût de départ</th><th scope="col">Risque principal</th><th scope="col">Pour qui</th></tr></thead><tbody><tr><th scope="row">Tout automatiser</th><td>Plusieurs semaines</td><td>Élevé</td><td>Élevé</td><td>Outil mal adopté</td><td>Équipes déjà outillées</td></tr><tr><th scope="row">Pas à pas</th><td>Quelques jours</td><td>Modéré</td><td>Faible</td><td>Progrès lent</td><td>Petites équipes</td></tr><tr><th scope="row">Ne rien changer</th><td>Aucun</td><td>Nul</td><td>Nul</td><td>Temps perdu</td><td>Personne</td></tr></tbody></table>
<p>Mot très long pour contrôler la coupure : Anticonstitutionnellementetinterminablementlongpourverifierlescoupuresdelignesurtelephone.</p>
<h2 id="conclusion">Ce qu'il faut retenir</h2>
<p>${PARAGRAPHE}</p>
`;

export function propsExempleArticle(gabarit: GabaritArticle, locale: Locale): ArticleGabaritProps {
  const pageUrl = `https://exemple.test/${locale}/blog/exemple-gabarit`;
  const view = {
    slug: "exemple-gabarit",
    title: "Comment une petite équipe gagne du temps avec l'IA",
    metaTitle: null,
    metaDescription: null,
    excerpt: "Un exemple d'article pour contrôler la mise en page.",
    body: CORPS,
    publishedAt: "2026-03-10",
    updatedAt: "2026-04-02",
    readingTime: "6 min",
    author: "Manon",
    category: "Cas d'usage",
    categorySlug: null,
    villeSlug: null,
    tags: [],
    tier: "tier-3-noindex-nofollow",
    source: "fs",
    isNews: false,
    featuredImage:
      "/images/axion-ia-5-heures-saisie-supprimees-gain-temps-entreprise-ia-banniere.webp",
    ogImage: null,
    ogImageWidth: null,
    ogImageHeight: null,
    featuredImageAlt: "Illustration : une équipe gagne du temps sur la saisie",
    featuredImageWidth: null,
    featuredImageHeight: null,
    directAnswer: null,
    photographerName: null,
    photographerUrl: null,
    citations: [],
    faqItems: [
      { question: "Par où commencer ?", answer: "Par la tâche la plus répétitive de la semaine." },
      {
        question: "Faut-il changer d'outil ?",
        answer: "Pas forcément : on commence avec ceux qu'on a.",
      },
    ],
    keyTakeaway: "Une tâche, un responsable, un outil : on commence petit.",
    expertQuote: null,
  } as unknown as BlogArticleView;

  return {
    gabarit,
    view,
    locale,
    html: CORPS,
    blocs: null,
    tocItems: [
      { anchor: "contexte", title: "Le contexte", level: 2 },
      { anchor: "la-demarche", title: "La démarche", level: 2 },
      { anchor: "etapes", title: "Les étapes", level: 3 },
      { anchor: "les-donnees", title: "Les données", level: 2 },
      { anchor: "conclusion", title: "Ce qu'il faut retenir", level: 2 },
    ],
    pageUrl,
    chapo: "Un article d'exemple, figé, pour contrôler la mise en page sur téléphone.",
    titre: { lead: "Comment une petite équipe gagne du temps", em: "avec l'IA" },
    tldr: "Une tâche, un responsable, un outil : on commence petit et on mesure.",
    filAriane: [
      { href: "/", label: "Accueil" },
      { href: "/blog", label: "Blog" },
    ],
    auteurHref: "/equipe",
    bylineManon: null,
    emettreJsonLdAuteur: false,
    sourcesVerifiees: null,
    villeAncree: null,
    precedentSuivant: {
      prev: null,
      next: null,
    } as unknown as ArticleGabaritProps["precedentSuivant"],
    questionsAssociees: [],
    suggestions: [],
    themeEncart: null,
    jsonLd: [],
  };
}
