// llms-full.txt — la version longue de `llms.txt`, pour l'agent ou l'outil qui veut tout lire en
// une fois (usage répandu, hors de la norme llmstxt.org elle-même).
//
// Refonte du 20/11/2026 (audit `geo/llms/AUDIT-ET-PLAN-LLMS-TXT.md`, § 3.3) : même en-tête que
// `llms.txt`, au caractère près, puis le détail de chaque section. En français seulement : la
// version anglaise du site est désactivée.
//
// 🔑 Ce fichier rend aussi des textes PARTAGÉS avec des pages du site (FAQ de `transversal.ts`,
// glossaire). Une entrée qui porte un mot ou un sujet hors de ce canal (`propreLlms`) est
// écartée d'ici, sans toucher à sa source : elle reste servie par sa page.

import {
  ACCESSIBILITE_LLMS,
  auFormatNorme,
  enteteLlms,
  ficheFondateurLlms,
  parOuCommencerLlms,
  propreLlms,
} from "@/app/_llms/faits-communs";
import {
  ligneObservatoireLlms,
  offresLlms,
  sectionGlossaireLlms,
  sectionPrestationsCompleteLlms,
  sectionQuestionsCompletesLlms,
} from "@/app/_llms/reference";
import { CASE_STUDIES } from "@/content/case-studies";
import {
  CONDITION_GARANTIE,
  DEDUCTION_JOURNEE_IA,
  GARANTIE_PHRASE,
  RAPPORT_COMPLET,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { CAS_CONCRETS_AFFICHES } from "@/content/preuves-sociales";
import { collapsePriceProseDuplicates, resolvePriceTokens } from "@/content/pricing-tokens";
import { QUESTIONS_REFERENCE } from "@/content/questions-reference";
import {
  APPORTEURS_QUESTIONS_LLMS,
  EN_BREF_APPORTEURS,
} from "@/content/recrutement/en-bref-apporteurs";
import { FAQ_GLOBAL } from "@/content/transversal";
import { FOUNDER } from "@/lib/brand";
import { COORDONNEES_PUBLIQUES } from "@/lib/identite-legale-ssot";
import { SITE_URL } from "@/lib/seo";
// R7 (ordre de Williams du 08/11/2026) : aucun montant public hors Journée IA.
import { recollerMontantsMasques } from "@/lib/seo/montant-public-texte";
import { videosPubliees } from "@/server/videos/lecture";
import { sectionVideosLlms } from "@/server/videos/llms";

// 🔁 `nodejs` et non `edge` (lot W3 des vidéos, ADR 0070) : la section « Vidéos » lit la
// base (via `lecture.ts`, qui rend [] interrupteur éteint ou base factice du build). Jamais
// `force-static` ; ISR 1 h, revalidée à la publication / au retrait des vidéos.
export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * Ce que la FAQ partagée affirme et que ce canal ne relaie pas, en plus de `propreLlms` :
 * chiffres de résultat, délais de réponse ou de livraison, noms de villes, qualificatifs sur
 * les intervenants. Aucun n'est prouvé par le code.
 */
const FAQ_HORS_CANAL =
  /%|\d\s?×|×\s?\d|\bROI\b|senior|constaté|\d+\s?h(?:eures)?\s(?:ouvrées|par (?:jour|semaine))|sous \d+\s?(?:h|heures|jours)\b|en \d+ (?:jours|semaines|mois)|\bParis\b|Lyon|Marseille|garanti|international|étranger/i;

/** Compare deux questions sans tenir compte de la casse ni du dessin de l'apostrophe. */
const cleQuestion = (q: string) =>
  q.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

export async function GET() {
  const sectionVideos = auFormatNorme(sectionVideosLlms(await videosPubliees(), SITE_URL, true));

  // `FAQ_GLOBAL` et `CASE_STUDIES` sont de la PROSE STOCKÉE : leurs montants sont écrits en
  // jetons `{{price:…}}`, résolus au rendu depuis `pricing.ts` (cf. `pricing-tokens.ts`).
  const renderFr = (s: string) => collapsePriceProseDuplicates(resolvePriceTokens(s, "fr"));

  // La FAQ partagée (`transversal.ts`) : ses RÉPONSES ne sont plus recopiées ici. Elles portent
  // des affirmations que le code ne prouve pas (chiffres de résultat, délais, frais), et les
  // corriger relève de leur source, pas de ce fichier. On liste donc les questions, chacune avec
  // le lien de sa page ; sont écartées celles dont la question ou la réponse est hors canal, et
  // celles qui doublonnent une question de référence (servie plus haut).
  const questionsDeReference = new Set(
    Object.values(QUESTIONS_REFERENCE).map((q) => cleQuestion(q.question)),
  );
  const faqBlock = FAQ_GLOBAL.filter((f) => {
    const texte = renderFr(`${f.fr.question} ${f.fr.answer}`);
    return (
      propreLlms(texte) &&
      !FAQ_HORS_CANAL.test(texte) &&
      !questionsDeReference.has(cleQuestion(f.fr.question))
    );
  })
    .map((f) => `- [${renderFr(f.fr.question)}](${SITE_URL}/fr/faq/${f.id})`)
    .join("\n");

  const caseBlock = (CAS_CONCRETS_AFFICHES ? CASE_STUDIES : [])
    .map(
      (c) =>
        `### ${renderFr(c.fr.title)} (${c.industry}, ${c.size})\n\n${renderFr(c.fr.excerpt)} · Métrique : ${c.metric}.`,
    )
    .join("\n\n");

  const [journee, ...autourDeLaJournee] = offresLlms(SITE_URL, "journee");
  const sectionJournee = [
    "## La Journée IA, offre phare",
    "",
    ...(journee
      ? [
          journee.definition,
          "",
          RAPPORT_COMPLET,
          "",
          `Garantie : ${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`,
          "",
          remplacerJetons(DEDUCTION_JOURNEE_IA),
          "",
          `Page : ${journee.url}`,
        ]
      : []),
    ...autourDeLaJournee.flatMap((o) => [
      "",
      `### ${o.nom}`,
      "",
      o.definition,
      "",
      `Page : ${o.url}`,
    ]),
  ].join("\n");

  const body = `${enteteLlms(SITE_URL)}

${parOuCommencerLlms(SITE_URL)}

${sectionJournee}

${sectionPrestationsCompleteLlms(SITE_URL)}

${sectionQuestionsCompletesLlms(SITE_URL)}

${sectionGlossaireLlms(SITE_URL)}

## FAQ

Les questions fréquentes des dirigeants de PME, chacune sur sa page. Toutes les questions : ${SITE_URL}/fr/faq

${faqBlock}

${CAS_CONCRETS_AFFICHES ? `## Cas concrets\n\n${caseBlock}\n\n` : ""}## Qui sommes-nous, contact

${FOUNDER.fullName} est le fondateur et dirigeant d’Axion-IA.

- [À propos](${SITE_URL}/fr/a-propos): Axion-IA, sa fondation et sa façon de travailler.
- [${FOUNDER.fullName}, fondateur et dirigeant](${ficheFondateurLlms(SITE_URL)}): fiche du fondateur. Profil LinkedIn : ${FOUNDER.linkedin}. Page LinkedIn de l’entreprise : ${COORDONNEES_PUBLIQUES.linkedinEntreprise}.
- [Contact](${SITE_URL}/fr/contact): ${COORDONNEES_PUBLIQUES.contactEmail}.
- [Presse](${SITE_URL}/fr/presse): dossier de presse et contact dédié.
- [Accessibilité](${SITE_URL}/fr/accessibilite): ${ACCESSIBILITE_LLMS}

## Actualités IA

Axion-IA publie une veille sur l’IA pour les dirigeants de PME : chaque article est daté, et sa date fait foi. Aucune cadence de publication n’est promise.

- [Actualités IA](${SITE_URL}/fr/actualites): tous les articles.
- [Flux RSS des actualités](${SITE_URL}/fr/actualites/feed.xml): les derniers articles.
- Version texte de chaque article : ${SITE_URL}/api/markdown/actualites/{slug}

## Réseau d'apporteurs d'affaires indépendants

${EN_BREF_APPORTEURS}

${APPORTEURS_QUESTIONS_LLMS.map((q) => `**${q.question}** ${q.reponse}`).join("\n\n")}

Pages : ${SITE_URL}/fr/devenir-commercial-ia · dossier de 3 minutes : ${SITE_URL}/fr/devenir-commercial-ia/candidature
${sectionVideos}
## Observatoire

${ligneObservatoireLlms(SITE_URL)}
`;

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
