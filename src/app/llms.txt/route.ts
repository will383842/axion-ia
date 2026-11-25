// llms.txt — la fiche d'identité d'Axion-IA pour les IA et les agents (norme : llmstxt.org).
//
// Refonte du 20/11/2026 (audit `geo/llms/AUDIT-ET-PLAN-LLMS-TXT.md`). Le fichier suit la norme :
// un titre, la présentation officielle en citation, des faits clés, puis des sections de liens
// « - [titre](url): description », et une section « Optional » pour ce qu'une IA peut sauter.
// L'ordre des sections, l'absence de doublon et de mot interdit, et la validité de chaque lien
// sont verrouillés par `src/app/_llms/llms-cible.spec.ts`.
//
// 🔑 Rien n'est écrit en dur qui puisse diverger du site : présentation, prix, garantie,
// déduction, rendez-vous gratuit et réponses de référence sont IMPORTÉS. Ce fichier ne dit rien
// du déplacement ni des conditions de règlement (décisions en cours chez le dirigeant).
// `llms-full.txt` reprend le même en-tête et développe chaque section.

import {
  ACCESSIBILITE_LLMS,
  anglaisServi,
  auFormatNorme,
  enteteLlms,
  ficheFondateurLlms,
  parOuCommencerLlms,
} from "@/app/_llms/faits-communs";
import {
  ligneGlossaireLlms,
  ligneObservatoireLlms,
  offresLlms,
  sectionPrestationsLlms,
  sectionQuestionsCourtesLlms,
} from "@/app/_llms/reference";
import { AI_ACT_NAV } from "@/components/nav/prestations-nav";
import { GUIDE_IA_PAGES } from "@/content/guide-ia";
import {
  CONDITION_GARANTIE,
  DEDUCTION_JOURNEE_IA,
  GARANTIE_PHRASE,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { CAS_CONCRETS_AFFICHES } from "@/content/preuves-sociales";
import { TOUR_PREFIX, TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";
import { FOUNDER } from "@/lib/brand";
import { COORDONNEES_PUBLIQUES } from "@/lib/identite-legale-ssot";
import { SITE_URL } from "@/lib/seo";
// R7 (ordre de Williams du 08/11/2026) : aucun montant public hors Journée IA.
import { recollerMontantsMasques } from "@/lib/seo/montant-public-texte";
import { avisPublies } from "@/server/reviews/presence";
import { videosPubliees } from "@/server/videos/lecture";
import { sectionVideosLlms } from "@/server/videos/llms";

// 🔁 `nodejs` et non `edge` (lot W3 des vidéos, ADR 0070) : la section « Vidéos » lit la
// base (via `lecture.ts`, qui rend [] interrupteur éteint ou base factice du build). Jamais
// `force-static` : le build stub y figerait « aucune vidéo ». ISR 1 h, et la publication /
// le retrait revalident la route (cf. `server/videos/apres-publication.ts`).
export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const [videos, avisEnLigne] = await Promise.all([videosPubliees(), avisPublies()]);

  // La Journée IA : sa description (nœud Service), puis la garantie et la déduction, mot pour mot.
  const [journee, ...autourDeLaJournee] = offresLlms(SITE_URL, "journee");
  const lignesJournee = [
    ...(journee
      ? [
          `- [${journee.nom}](${journee.url}): ${journee.definition} Garantie : ${GARANTIE_PHRASE} ${CONDITION_GARANTIE} ${remplacerJetons(DEDUCTION_JOURNEE_IA)}`,
        ]
      : []),
    ...autourDeLaJournee.map((o) => `- [${o.nom}](${o.url}): ${o.definition}`),
  ].join("\n");

  // Avis clients : même règle que les pages /avis (404 tant qu'aucun avis n'est publié).
  // Annoncer /fr/avis et son flux sans avis publié, c'était envoyer les moteurs sur des 404.
  const ligneAvis = avisEnLigne
    ? `- [Avis clients](${SITE_URL}/fr/avis): chaque avis est déposé par un client puis contrôlé à la main avant publication ; les avis positifs comme négatifs sont publiés. Flux RSS : ${SITE_URL}/fr/avis/feed.xml.\n`
    : "";
  // Les cas concrets sont éteints (retrait du 2026-11-08) : la ligne ne revient qu'avec l'interrupteur.
  const ligneCasConcrets = CAS_CONCRETS_AFFICHES
    ? `- [Cas concrets](${SITE_URL}/fr/cas-concrets): exemples de missions.\n`
    : "";

  // Vidéos : la section et son plan du site n'existent que s'il y a des vidéos publiées.
  const videosListe = auFormatNorme(sectionVideosLlms(videos, SITE_URL));
  const sectionVideos =
    videosListe &&
    `${videosListe}- [Plan du site des vidéos](${SITE_URL}/sitemap-videos.xml): liste des vidéos publiées.\n`;

  // Tour France IA (2026-10-25 ; modèle « 5 journées offertes par ville, sur sélection, en
  // échange d'un podcast » le 2026-10-27) : ligne visible SEULEMENT quand la landing est ouverte
  // (`TOUR_PUBLIC`). Refermée, elle répond 404 : la citer ici l'exposerait. Son texte est celui
  // de `main`, inchangé, en attente de la décision du dirigeant ; elle est rangée en « Optional ».
  const sectionTour = TOUR_PUBLIC
    ? `- [Tour France IA](${SITE_URL}${TOUR_PREFIX}) — organisé par Axion-IA, fondé par Williams Jullin. Une journée offerte dans l'entreprise, de la TPE à l'ETI, tous secteurs : un audit de son activité, qui chiffre ce que l'IA peut lui apporter, puis une formation de 4 h de son équipe, en intra-entreprise et en présentiel, qui est l'une des mesures possibles au titre de l'article 4 de l'AI Act. Le Tour va de ville en ville : une ville s'ouvre dès 5 demandes, puis une semaine, une entreprise par jour. La journée est offerte aux 5 entreprises retenues par ville, en échange d'un podcast tourné chez elles ; la sélection se fait sur une visio de 30 minutes, sans engagement, puis un court questionnaire. Sinon, la même journée est proposée à un tarif Tour. Le vendredi soir, un dîner des dirigeants, facultatif et non compris dans la journée offerte. Conditions générales : ${SITE_URL}${TOUR_PREFIX}/conditions-generales. Aucun lien avec le Tour de France cycliste.
`
    : "";

  const body = `${enteteLlms(SITE_URL)}

${parOuCommencerLlms(SITE_URL)}

## La Journée IA, offre phare

${lignesJournee}

${sectionPrestationsLlms(SITE_URL)}

${sectionQuestionsCourtesLlms(SITE_URL)}

## Ressources de référence

${ligneGlossaireLlms(SITE_URL)}
- [${AI_ACT_NAV.labelFr}](${SITE_URL}/fr${AI_ACT_NAV.href}): ${AI_ACT_NAV.descriptionFr}
- [FAQ](${SITE_URL}/fr/faq): les questions fréquentes des dirigeants de PME, classées par thème.
- [Base de connaissances](${SITE_URL}/fr/connaissances): fiches sourcées (méthodes, comparatifs, cas d’usage par secteur, définitions).
- [Guide IA entreprise 2026](${SITE_URL}/fr/guide-ia): guide PDF gratuit de ${GUIDE_IA_PAGES} pages : usages, coûts, données, AI Act, retour sur investissement.
- [Actualités IA](${SITE_URL}/fr/actualites): veille pour dirigeants de PME, chaque article daté. Version texte : ${SITE_URL}/api/markdown/actualites/{slug}.
${ligneCasConcrets}${ligneAvis}
## Qui sommes-nous, contact

- [À propos](${SITE_URL}/fr/a-propos): Axion-IA, sa fondation et sa façon de travailler.
- [${FOUNDER.fullName}, fondateur et dirigeant](${ficheFondateurLlms(SITE_URL)}): fiche du fondateur. Profil LinkedIn : ${FOUNDER.linkedin}. Page LinkedIn de l’entreprise : ${COORDONNEES_PUBLIQUES.linkedinEntreprise}.
- [Contact](${SITE_URL}/fr/contact): ${COORDONNEES_PUBLIQUES.contactEmail}.
- [Presse](${SITE_URL}/fr/presse): dossier de presse et contact dédié.
- [Accessibilité](${SITE_URL}/fr/accessibilite): ${ACCESSIBILITE_LLMS}
${sectionVideos}
## Optional

- [Version complète](${SITE_URL}/llms-full.txt): les réponses développées, le glossaire complet et la FAQ.
- [Comparaisons](${SITE_URL}/fr/comparaisons): Axion-IA face aux autres options (consultants, agences, logiciels prêts à l’emploi).
${ligneObservatoireLlms(SITE_URL)}
- [Devenir apporteur d’affaires](${SITE_URL}/fr/devenir-commercial-ia): réseau d’indépendants qui présentent la Journée IA à des dirigeants qu’ils connaissent.
${sectionTour}- [Banque d’images](${SITE_URL}/fr/galerie): visuels Axion-IA sous licence CC BY 4.0.
- [Plan du site](${SITE_URL}/sitemap-index.xml): la liste de tous les plans du site.
- [Plan de la base de connaissances](${SITE_URL}/sitemap-knowledge.xml): les fiches publiées, avec leur date de dernière révision.
- [Plan des images](${SITE_URL}/sitemaps/images-fr.xml): les images du site, version française.
${anglaisServi() ? `- [Plan des images, version anglaise](${SITE_URL}/sitemaps/images-en.xml): les images du site, version anglaise.\n` : ""}`;

  return new Response(recollerMontantsMasques(body), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800",
      // Lisible par tous, mais sans intérêt dans les résultats de recherche.
      "X-Robots-Tag": "noindex",
    },
  });
}
