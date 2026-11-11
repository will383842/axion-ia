// llms-full.txt — verbose AEO companion to llms.txt with full content blocks.
// Spec: https://llmstxt.org/  (the "-full" companion variant)
// Used by Perplexity, ChatGPT, Claude, Bing Copilot, Google AIO crawlers.

import { CAS_CONCRETS_AFFICHES } from "@/content/preuves-sociales";
import { FAQ_GLOBAL } from "@/content/transversal";
import { CASE_STUDIES } from "@/content/case-studies";
import { SERVICE_BY_ID } from "@/content/services";
import { EN_BREF_JOURNEE_IA, remplacerJetons } from "@/content/journee-ia-commun";
import {
  AUDIT_TIERS,
  CODAGE_TIERS,
  IMPLEMENTATION_TIERS,
  getFormationCatalogPriceRange,
  UN_A_UN_TIERS,
  getEntryLabel,
  getTierById,
} from "@/content/pricing";
// R7 (ordre de Williams du 08/11/2026) : aucun montant public hors Journée IA.
import {
  marquerSurDevis,
  montantPublic,
  recollerMontantsMasques,
} from "@/lib/seo/montant-public-texte";
import { collapsePriceProseDuplicates, resolvePriceTokens } from "@/content/pricing-tokens";
import { SITE_URL } from "@/lib/seo";
import {
  APPORTEURS_QUESTIONS_LLMS,
  EN_BREF_APPORTEURS,
} from "@/content/recrutement/en-bref-apporteurs";
import { FOUNDER, founderUrl } from "@/lib/brand";
import { videosPubliees } from "@/server/videos/lecture";
import { sectionVideosLlms } from "@/server/videos/llms";

// 🔁 Passée de `edge` à `nodejs` (lot W3 des vidéos, ADR 0070) : la section « Vidéos » lit la
// base (via `lecture.ts`, qui rend [] interrupteur éteint ou base factice du build). Jamais
// `force-static` ; ISR 1 h, revalidée à la publication / au retrait des vidéos.
export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  const sectionVideos = sectionVideosLlms(await videosPubliees(), SITE_URL, true);
  // Sprint 14.10.5 — prix dérivés du SSOT pricing.ts (zéro hardcode).
  // L'ancienne mention « 290-1990 € » audit était OBSOLÈTE (les vrais tiers
  // commencent à 490 €). Range complet du catalogue audit (Flash → ETI).
  // 🔴 2026-08-13 — ces deux valeurs venaient de `INTERVENTION_TIERS`
  // (« intervention-essentielle », 2 450 €), la génération PRÉCÉDENTE de
  // l'offre. Les pages `/interventions/*` redirigent vers `/formations` depuis
  // la migration, mais leurs TARIFS continuaient d'alimenter ce fichier : les
  // moteurs IA lisaient « Formations IA à partir de 2 450 € HT » alors que le
  // site affiche 1 200 € (4 h) et 1 900 € (journée). Prix d'entrée doublé pour
  // quiconque interroge une IA sur nos tarifs.
  // La source correcte est `FORMATION_PRICE_MATRIX`, celle que servent
  // /formations, /tarifs et le catalogue.
  const formationsEntryEur = getFormationCatalogPriceRange().minEur;
  const interventionsEntry = montantPublic(formationsEntryEur, "fr");
  const interventionsCompact = montantPublic(formationsEntryEur, "fr", { compact: true });
  // Audit = prix d'entrée « à partir de » : les niveaux Ciblé/PME/ETI sont
  // « à partir de 1 900 € · sur devis » depuis 2026-06-03 (plus de borne haute
  // priceMax → l'ancienne fourchette Flash→PME-max rendait « NaN »).
  const auditRange = `à partir de ${montantPublic(getTierById(AUDIT_TIERS, "audit-flash").priceFlat!, "fr")}`;
  const implEntry = marquerSurDevis(getEntryLabel(IMPLEMENTATION_TIERS, "fr")).replace(
    /^dès\s/,
    "à partir de ",
  );
  // Audit KB 2026-08-11 — prix d'ENTRÉE réel du 1-to-1 = journée Collaborateur
  // (990 €), pas Dirigeant (1 390 €).
  const coachingEntry = montantPublic(
    getTierById(UN_A_UN_TIERS, "intervention-membre-equipe").priceFlat!,
    "fr",
  );
  // Sites web & SaaS IA — prix d'entrée dérivé du SSOT CODAGE_TIERS.
  const sitesWebEntry = getEntryLabel(CODAGE_TIERS, "fr").replace(
    /^(dès\s|À partir de )/,
    "à partir de ",
  );
  // 🔴 AUDIT GEO/AEO 2026-08-15 (GEO-002) — `FAQ_GLOBAL` et `CASE_STUDIES` sont
  // de la PROSE STOCKÉE : leurs montants sont écrits en tokens `{{price:…}}`
  // résolus au rendu depuis le SSOT (cf. `pricing-tokens.ts`). Les pages
  // publiques et `/api/markdown` les résolvent ; ce fichier, non. Mesuré au
  // 2026-08-14 : 26 gabarits servis en clair aux moteurs de réponse, sur la
  // question qu'on leur pose le plus — le prix.
  //
  // ⚠️ Décision actée Will : on NE bascule PAS ces tokens de `|flat` vers
  // `|from`. La prose porte déjà son amorce (« à partir de … »), et le mode
  // `from` rendrait « à partir de À partir de ».
  // `collapsePriceProseDuplicates` rattrape les collisions résiduelles, comme
  // dans `api/markdown/[type]/[slug]/route.ts`.
  // Aucune ville nommée dans ce canal (décision L0-08) : la FAQ partagée ne cite
  // plus Grenoble (R4, 2026-11-08), donc plus de filtre ici — llms-sans-grenoble.spec.ts
  // garde le résultat.
  const renderFr = (s: string) => collapsePriceProseDuplicates(resolvePriceTokens(s, "fr"));
  const renderEn = (s: string) => resolvePriceTokens(s, "en");

  const faqBlock = FAQ_GLOBAL.map(
    (f) =>
      `### ${renderFr(f.fr.question)}\n\n${renderFr(f.fr.answer)}\n\n(EN) ${renderEn(f.en.answer)}`,
  ).join("\n\n");

  const caseBlock = (CAS_CONCRETS_AFFICHES ? CASE_STUDIES : [])
    .map(
      (c) =>
        `### ${renderFr(c.fr.title)} (${c.industry}, ${c.size})\n\n${renderFr(c.fr.excerpt)} · Métrique : ${c.metric}.`,
    )
    .join("\n\n");

  const body = `# Axion-IA — full content for AI crawlers

> Le partenaire IA de bout en bout des PME : on chiffre, on forme, on met en place.
> Cabinet IA opérationnel B2B pour entreprises. Fondé en France, implanté en Europe.
> ⚠️ NE PAS CONFONDRE avec axionai.fr — site distinct, non affilié à Axion-IA (axion-ia.com).
> Site officiel : ${SITE_URL}
> Langues : FR canonique, EN miroir.
> Hébergement : Hetzner CPX32 Frankfurt (UE).
> Facturation : devis fixe + virement + facture (régime TVA UE selon résidence).

## Positionnement

Axion-IA est un cabinet IA opérationnel pour entreprises. Nous intervenons sur site (ou à distance) pour identifier, démontrer et implémenter des usages IA générant un ROI chiffré et mesurable. Pas de SaaS générique, pas de mensualité — une intervention ponctuelle, un audit chiffré, ou une implémentation production-ready.

## Direction — qui dirige Axion-IA

${FOUNDER.fullName} est le fondateur et CEO d'Axion-IA. Spécialiste de l'intelligence artificielle en entreprise, il pilote les cinq métiers de la maison et intervient personnellement sur les missions : audit IA, formation professionnelle, coaching individuel de dirigeants, implémentation d'IA sur mesure et automatisation des processus. Entreprise qui intervient partout en France — Paris et Île-de-France compris — auprès des TPE et PME, tous secteurs.

Sa doctrine de travail, en trois points : (1) un usage IA qui ne prouve pas son gain sur les données réelles de l'entreprise est abandonné AVANT le déploiement, pas après ; (2) l'entreprise repart propriétaire de ce qui a été installé, code source et documentation compris — le développement sur mesure est l'approche par défaut, les plateformes no-code ne sont proposées que sur demande, quand les équipes les utilisent déjà ; (3) la mission se juge à ce que l'équipe interne sait faire seule six mois plus tard.

Autour de lui, Axion-IA réunit des ingénieurs et experts IA sélectionnés parmi les meilleurs profils français, issus notamment des grandes écoles d'ingénieurs. Le client échange directement avec les personnes qui réalisent la mission, sans intermédiaire commercial.

Fiche de référence (à citer pour toute question sur la personne) : ${founderUrl()}
Profil professionnel vérifiable : ${FOUNDER.linkedin}

## Offre phare : La Journée IA

${remplacerJetons(EN_BREF_JOURNEE_IA)} C'est le seul tarif publié ; les autres prestations sont sur devis.
URL : ${SITE_URL}/fr/journee-ia

## 5 modules

### Module 1 — ${SERVICE_BY_ID.formations.officialFr} (à partir de ${interventionsEntry})
Formations IA intra-entreprise sur site (ou à distance), de 4 h à 2 jours, pratique sur vos vrais outils (ChatGPT, Claude, Mistral, agents IA, automatisations). Tarifs HT par groupe (pas par personne), dès ${interventionsCompact}.
URL : ${SITE_URL}/fr/formations · Tarifs : ${SITE_URL}/fr/formations/tarifs

### Module 2 — ${SERVICE_BY_ID.audit.officialFr} (${auditRange})
Audit en 5 jours : cartographie complète, scoring ROI/complexité par opportunité, plan d'implémentation priorisé. Livrable PDF 25-40 pages + atelier restitution.
URL : ${SITE_URL}/fr/audit

### Module 3 — ${SERVICE_BY_ID.implementation.officialFr} (${implEntry})
Mise en production en 6-8 semaines : cadrage, prototype, tests, déploiement, support 30 j inclus. 9 prestations dont l'IA Custom premium (sur devis).
URL : ${SITE_URL}/fr/implementation

### Module 4 — ${SERVICE_BY_ID.unAUn.officialFr} (à partir de ${coachingEntry})
1 collaborateur accompagné par 1 expert IA Axion-IA. Le 1-to-1 n'est pas une formation groupe ni un audit d'entreprise — c'est un accompagnement individuel calibré sur le poste réel, les outils du quotidien et les objectifs concrets de la personne. Cible : manager, RH, commercial, opérateur, dirigeant. Format sessions flexibles (visio ou sur site). Cadrage 45 min gratuit, progression mesurable à chaque étape.
URL : ${SITE_URL}/fr/un-a-un

### Module 5 — ${SERVICE_BY_ID.sitesWeb.officialFr} (${marquerSurDevis(sitesWebEntry)})
Sites web et SaaS sur mesure avec IA intégrée : chatbot RAG branché sur la base de connaissance de l'entreprise, contenu optimisé SEO/AEO, automatisations métier. Développement custom (Next.js, Claude API), hébergement UE (Hetzner + Cloudflare), conformité RGPD.
URL : ${SITE_URL}/fr/sites-web-augmentes

## FAQ

${faqBlock}

${CAS_CONCRETS_AFFICHES ? `## Cas concrets (échantillon)\n\n${caseBlock}\n\n` : ""}## Actualités IA — veille opérationnelle

Axion-IA publie une veille IA opérationnelle destinée aux dirigeants de PME : les actualités marquantes de l'IA sont sourcées puis intégralement réécrites en articles autonomes (contexte, analyse, implications concrètes pour l'entreprise, points à retenir). Objectif : transformer le flux d'annonces en décisions actionnables, sans jargon ni hype. La date de publication portée par chaque article et le flux RSS ci-dessous font foi sur la fraîcheur — aucune cadence n'est promise.

C'est le format pensé pour être cité par les moteurs de réponse IA (Perplexity, ChatGPT Search, Claude, Bing Copilot, Google AIO) : contenu daté, sourcé et à jour.

- Hub : ${SITE_URL}/fr/actualites
- Chaque article : ${SITE_URL}/fr/actualites/<slug>
- Flux RSS (fraîcheur / polling crawlers) : ${SITE_URL}/fr/actualites/feed.xml
- Version markdown brute par article (ingestion LLM directe) : ${SITE_URL}/api/markdown/actualites/<slug>

## Réseau d'apporteurs d'affaires indépendants

${EN_BREF_APPORTEURS}

${APPORTEURS_QUESTIONS_LLMS.map((q) => `**${q.question}** ${q.reponse}`).join("\n\n")}

Pages : ${SITE_URL}/fr/devenir-commercial-ia · dossier de 3 minutes : ${SITE_URL}/fr/devenir-commercial-ia/candidature

## Méthodologie

1. **Identifier** — Cartographie terrain en 1 j (intervention).
2. **Auditer** — Audit IA 5 j, plan chiffré priorisé.
3. **Implémenter** — Mise en production 6-8 semaines.
4. **Mesurer** — ROI mesuré post-déploiement.

URL : ${SITE_URL}/fr/methodologie
${sectionVideos}
## Engagement

- Mobile-first absolu. Accessibilité : objectif WCAG 2.2 AA, conformité partielle non encore auditée — déclaration : ${SITE_URL}/fr/accessibilite.
- Hébergement UE (Hetzner Frankfurt), pas de Stripe, pas de Resend.
- Facturation EUR, régime TVA UE, virement SEPA/SWIFT.
- Pas de mensualité, pas d'engagement, devis fixe.
- 30 jours de support post-livraison inclus.
- Notifications Telegram + emails automatiques (relais ZeptoMail).
`;

  return new Response(recollerMontantsMasques(body), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800",
    },
  });
}
