/**
 * Content Generator — Hub ville auto-généré (Sprint VilleCopy 2026-05-24).
 *
 * Architecture : génère les champs `VilleCopy` (page hub ville `/implantations/[region]/[ville]`).
 * Persiste dans `GeneratedVilleCopy` DB (≠ Article — c'est de la copy de site, pas un article).
 *
 * Doctrine anti-duplicate :
 *   - Le hub parle de la ville TRANSVERSALEMENT (pitch + écosystème + FAQ géo).
 *   - Les 5 verticales (`/[verticale]`) parlent CHACUNE d'un service en profondeur.
 *   - Le hub introduit BRIÈVEMENT chaque service (servicesContext ≤ 40 mots) et renvoie aux verticales.
 *   - INTERDIT : re-traiter en détail audit/interventions/impl dans le hub (sinon duplicate vs verticales).
 *
 * Concision (vs verbosité actuelle pages clientes) :
 *   - Strict word caps par champ (cf. prompt § CONTRAINTES).
 *   - Hard cap `maxTokens=1500` → impossible d'exploser.
 *
 * FR-only (EN locale désactivé cf AGENTS.md).
 */

import { z } from "zod";
import { generate as routerGenerate } from "../providers/provider-router";
import { hashPrompt } from "../provenance/provenance-logger";
import { retrieve as kbRetrieve } from "../kb-client";
import { parseLlmJson } from "../shared/parse-llm-json";
import { escapeSlugInput } from "../shared/prompt-input-escape";
import { getBrandVoiceForContentType } from "../brand/brand-voice";
import { evaluateSoft404 } from "../quality/soft-404-gate";
import { checkHubVsVerticalesDuplicate } from "./anti-duplicate-check";
import { prisma } from "@/lib/prisma";
import { getVille } from "@/content/villes";
import { ECONOMIC_DATA_BY_SLUG } from "@/content/villes/economic-data";
import type { VilleEconomicData } from "@/content/villes/economic-data/types";
// Prix : le prompt demande désormais au LLM d'émettre des tokens {{price:…}}
// (résolus depuis pricing.ts au rendu) — plus d'injection de montants en dur.

/** Output JSON attendu du LLM. Doit matcher `VilleCopy` shape (FR-only). */
/**
 * Zod : validation de SHAPE (présence + bornes larges).
 * Validation de QUALITÉ fine = `computeQualityScore()` (score décrémenté
 * field par field si word counts hors cible). Permet au LLM d'avoir un
 * peu de marge sans throw, mais score < threshold → pas auto-approve.
 */
const VilleHubCopySchema = z.object({
  pitchFr: z.string().min(80).max(550),
  directAnswerFr: z.string().min(150).max(850),
  ecosystemFr: z.string().min(120).max(750),
  distancesFr: z.string().min(30).max(380),
  topSectorsNaf: z.array(z.string().min(2).max(60)).min(3).max(8),
  servicesContext: z.object({
    audit: z.object({ fr: z.string().min(60).max(280) }),
    interventions: z.object({ fr: z.string().min(60).max(280) }),
    implementation: z.object({ fr: z.string().min(60).max(280) }),
    unAUn: z.object({ fr: z.string().min(60).max(280) }),
  }),
  faqGeolocalisee: z
    .array(
      z.object({
        q: z.string().min(15).max(160),
        a: z.string().min(80).max(480),
      }),
    )
    .min(4)
    .max(6),
});

export type VilleHubCopyOutput = z.infer<typeof VilleHubCopySchema>;

export interface VilleHubCopyResult {
  readonly villeSlug: string;
  readonly output: VilleHubCopyOutput;
  readonly qualityScore: number;
  readonly modelUsed: string;
  readonly totalCostUsd: number;
  readonly tokensInput: number;
  readonly tokensOutput: number;
  readonly promptHash: string;
  readonly kbContextUsed: ReadonlyArray<string>;
}

// ===========================================================================
// KB context builder — extrait les ~10 faits les plus saillants du KB.
// Garde le prompt compact (< 2K tokens) pour rester rapide + pas cher.
// ===========================================================================

interface KbFact {
  readonly label: string;
  readonly value: string;
}

function buildKbContext(eco: VilleEconomicData | undefined): {
  readonly facts: ReadonlyArray<KbFact>;
  readonly markdown: string;
} {
  if (!eco) {
    return { facts: [], markdown: "(Aucune donnée économique structurée disponible.)" };
  }
  const facts: KbFact[] = [];

  if (eco.topSectorsNaf?.length) {
    facts.push({
      label: "Secteurs NAF dominants",
      value: eco.topSectorsNaf
        .slice(0, 5)
        .map((s) => s.label)
        .join(", "),
    });
  }
  if (eco.polesCompetitivite?.length) {
    facts.push({
      label: "Pôles de compétitivité",
      value: eco.polesCompetitivite
        .slice(0, 3)
        .map((p) => `${p.nom} (${p.secteur})`)
        .join(", "),
    });
  }
  if (eco.grandsGroupesImplantes?.length) {
    facts.push({
      label: "Grands groupes implantés",
      value: eco.grandsGroupesImplantes
        .slice(0, 5)
        .map((g) => g.nom)
        .join(", "),
    });
  }
  if (eco.zonesActivitesParcs?.length) {
    facts.push({
      label: "Zones / technopôles",
      value: eco.zonesActivitesParcs
        .slice(0, 3)
        .map((z) => z.nom)
        .join(", "),
    });
  }
  if (eco.grandesEcolesEtUniversites?.length) {
    facts.push({
      label: "Écoles & universités",
      value: eco.grandesEcolesEtUniversites
        .slice(0, 4)
        .map((e) => e.nom)
        .join(", "),
    });
  }
  if (eco.polesRechercheRD?.length) {
    facts.push({
      label: "Pôles recherche publique",
      value: eco.polesRechercheRD
        .slice(0, 3)
        .map((p) => p.nom)
        .join(", "),
    });
  }
  if (eco.incubateursAccelerateurs?.length) {
    facts.push({
      label: "Incubateurs/accélérateurs",
      value: eco.incubateursAccelerateurs
        .slice(0, 3)
        .map((i) => i.nom)
        .join(", "),
    });
  }
  if (eco.distances) {
    const d: string[] = [];
    if (eco.distances.gareTgv) {
      d.push(`Gare TGV ${eco.distances.gareTgv.nom} (${eco.distances.gareTgv.distanceKm} km)`);
    }
    if (eco.distances.aeroportPrincipal) {
      d.push(
        `Aéroport ${eco.distances.aeroportPrincipal.nom} (${eco.distances.aeroportPrincipal.distanceKm} km)`,
      );
    }
    if (eco.distances.metroOuTram) {
      d.push(`${eco.distances.metroOuTram.lignes} lignes métro/tram`);
    }
    if (d.length > 0) facts.push({ label: "Transport", value: d.join(" / ") });
  }
  if (eco.statsInsee) {
    const s = eco.statsInsee;
    const parts: string[] = [];
    if (s.etablissementsActifs)
      parts.push(`${s.etablissementsActifs.toLocaleString("fr")} établissements actifs`);
    if (s.creationsEntreprises)
      parts.push(`${s.creationsEntreprises.toLocaleString("fr")} créations/an`);
    if (parts.length > 0)
      facts.push({ label: `INSEE ${s.anneeReference}`, value: parts.join(", ") });
  }
  if (eco.capitaleFrenchTech?.statut) {
    facts.push({ label: "French Tech", value: String(eco.capitaleFrenchTech.statut) });
  }
  if (eco.communesBassin?.length) {
    facts.push({
      label: "Communes bassin",
      value: eco.communesBassin
        .slice(0, 5)
        .map((c) => c.nameFr)
        .join(", "),
    });
  }

  const markdown =
    facts.length === 0
      ? "(Aucune donnée structurée trouvée.)"
      : facts.map((f) => `- **${f.label}** : ${f.value}`).join("\n");

  return { facts, markdown };
}

// ===========================================================================
// Quality gate — vérifie word counts + banned phrases + JSON shape.
// ===========================================================================

const BANNED_PHRASES = [
  "lorem ipsum",
  "axion ia", // toujours "Axion-IA" avec tiret
  "TODO",
  "[à compléter]",
  "à compléter",
  // Doctrine Will 2026-05-24 : NE JAMAIS impliquer qu'Axion-IA est implanté dans la ville.
  // Axion-IA est un cabinet national qui se DÉPLACE dans toutes les villes.
  "expertise locale",
  "notre équipe locale",
  "nos équipes locales",
  "présence locale",
  "implantation locale",
  "notre antenne",
  "nous sommes basés",
  "nous sommes implantés",
  "notre bureau",
  "nos bureaux",
  "à proximité",
  "proximité géographique",
  // Anti-doctrine tarifs publics
  "contactez-nous pour plus de détails",
  "contactez-nous pour un devis",
  "n'hésitez pas à nous contacter",
  "selon vos besoins",
  "selon la complexité",
  // Anti-marketing-speak (audit Will 2026-05-24) — formulations creuses bannies
  "transformation digitale efficace",
  "gain de compétitivité",
  "solutions sur mesure",
  "expertise dédiée",
  "acteurs majeurs",
  "centre névralgique",
  "dynamique et innovant",
  "développement personnalisé",
  "écosystème dynamique",
  "renforçant son rôle",
  "optimiser l'usage",
  "tirer parti",
  "leviers IA",
  // 🚨 P0 CRITIQUE Will 2026-05-25 — Anti brand-fabrication (juridiquement risqué)
  // Patterns qui sous-entendent un partenariat/relation commerciale avec les
  // grandes marques mentionnées dans le KB économique.
  "axion-ia collabore avec",
  "nous collaborons avec",
  "en collaboration avec",
  "en partenariat avec",
  "nos clients comme",
  "nos clients tels que",
  "notamment chez",
  "notamment avec",
  "auprès de groupes",
  "auprès d'entités",
  "au sein de pôles",
  "au sein des pôles",
  "avec l'appui de",
  "grâce à station f",
  "grâce à cap digital",
  "grâce à lvmh",
  "grâce à inria",
  "des dirigeants de groupes tels que",
  "avec des entités telles que",
];

function countWords(s: string): number {
  return s
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function computeQualityScore(output: VilleHubCopyOutput): {
  readonly score: number;
  readonly issues: ReadonlyArray<string>;
  /** Feedback structuré pour la boucle de re-prompt (concis, exploitable). */
  readonly retryFeedback: string;
} {
  const issues: string[] = [];
  const tooShortFields: string[] = [];
  const tooLongFields: string[] = [];
  const bannedFound: string[] = [];
  let score = 100;

  // Word counts cap-by-cap — minimums plus stricts (cible 600-800 mots uniques/ville)
  const checks: ReadonlyArray<{ field: string; text: string; min: number; max: number }> = [
    { field: "pitchFr", text: output.pitchFr, min: 35, max: 60 },
    { field: "directAnswerFr", text: output.directAnswerFr, min: 55, max: 95 },
    { field: "ecosystemFr", text: output.ecosystemFr, min: 40, max: 70 },
    { field: "distancesFr", text: output.distancesFr, min: 15, max: 35 },
    { field: "servicesContext.audit.fr", text: output.servicesContext.audit.fr, min: 22, max: 45 },
    {
      field: "servicesContext.interventions.fr",
      text: output.servicesContext.interventions.fr,
      min: 22,
      max: 45,
    },
    {
      field: "servicesContext.implementation.fr",
      text: output.servicesContext.implementation.fr,
      min: 22,
      max: 45,
    },
    { field: "servicesContext.unAUn.fr", text: output.servicesContext.unAUn.fr, min: 22, max: 45 },
  ];
  for (const { field, text, min, max } of checks) {
    const wc = countWords(text);
    if (wc < min) {
      issues.push(`${field} trop court (${wc} < ${min} mots)`);
      tooShortFields.push(`${field} (${wc}/${min} mots min)`);
      score -= 5;
    } else if (wc > max) {
      issues.push(`${field} trop long (${wc} > ${max} mots)`);
      tooLongFields.push(`${field} (${wc}/${max} mots max)`);
      score -= 5;
    }
  }

  // FAQ answers word caps
  for (let i = 0; i < output.faqGeolocalisee.length; i++) {
    const faq = output.faqGeolocalisee[i]!;
    const wc = countWords(faq.a);
    if (wc < 35) {
      issues.push(`faq[${i}].a trop court (${wc} < 35 mots)`);
      tooShortFields.push(`faq[${i}].a (${wc}/35 mots min)`);
      score -= 3;
    } else if (wc > 70) {
      issues.push(`faq[${i}].a trop long (${wc} > 70 mots)`);
      tooLongFields.push(`faq[${i}].a (${wc}/70 mots max)`);
      score -= 3;
    }
  }

  // Banned phrases (insensible casse) — pénalité plus dure pour forcer le LLM à les éviter
  const allText = [
    output.pitchFr,
    output.directAnswerFr,
    output.ecosystemFr,
    output.distancesFr,
    output.servicesContext.audit.fr,
    output.servicesContext.interventions.fr,
    output.servicesContext.implementation.fr,
    output.servicesContext.unAUn.fr,
    ...output.faqGeolocalisee.flatMap((f) => [f.q, f.a]),
  ]
    .join(" ")
    .toLowerCase();
  for (const banned of BANNED_PHRASES) {
    if (allText.includes(banned.toLowerCase())) {
      issues.push(`Banned phrase détectée : "${banned}"`);
      bannedFound.push(`"${banned}"`);
      score -= 10;
    }
  }

  // Hard floors
  if (score < 0) score = 0;

  // Build retry feedback — concis, exploitable par le LLM en passe suivante
  const fbParts: string[] = [];
  if (tooShortFields.length > 0) {
    fbParts.push(
      `Champs TROP COURTS — il FAUT ATTEINDRE les minimums : ${tooShortFields.join(" / ")}.`,
    );
  }
  if (tooLongFields.length > 0) {
    fbParts.push(
      `Champs TROP LONGS — il FAUT RESTER sous les maximums : ${tooLongFields.join(" / ")}.`,
    );
  }
  if (bannedFound.length > 0) {
    // 2026-05-26 — feedback étendu avec alternatives concrètes (GPT-4o tend à
    // re-utiliser les mêmes banned phrases si on ne propose pas d'alternative).
    fbParts.push(
      `🚨 PHRASES BANNIES DÉTECTÉES — interdites : ${bannedFound.join(", ")}.\n` +
        `ALTERNATIVES OBLIGATOIRES :\n` +
        `  - "transformation digitale efficace" → "déploiement IA concret"\n` +
        `  - "gain de compétitivité" → "réduction des coûts opérationnels mesurés"\n` +
        `  - "solutions sur mesure" → "interventions adaptées à votre stack"\n` +
        `  - "expertise dédiée" → "consultants seniors sur site"\n` +
        `  - "écosystème dynamique" → nom factuel d'institution\n` +
        `  - "leviers IA" → "automatisations concrètes (devis/relances/reporting)"\n` +
        `  - "tirer parti" → "utiliser pour"\n` +
        `  - "acteurs majeurs" → noms factuels d'entreprises\n` +
        `  - "centre névralgique" → "siège" / "pôle"\n` +
        `  - "dynamique et innovant" → SUPPRIMER (adjectifs creux)\n` +
        `  - "expertise locale/équipe locale/présence locale" → "Williams se déplace à <Ville>"\n` +
        `Écris comme un journaliste business : faits, noms propres, chiffres. JAMAIS d'adjectif élogieux.`,
    );
  }
  const retryFeedback = fbParts.length > 0 ? fbParts.join("\n") : "";

  return { score, issues, retryFeedback };
}

// ===========================================================================
// Generator principal
// ===========================================================================

/**
 * 4 personas audience Axion-IA (visibles dans la section "Toutes les tailles, une seule exigence")
 * — le LLM doit écrire COMME SI il parlait directement à un de ces décideurs.
 * People-first content (HCU 2024 Google) : pas écrire POUR le SEO, écrire POUR le prospect.
 */
const AUDIENCE_PERSONAS = `## Personas cibles — écris COMME SI tu leur parles directement

1. **PME / Artisan** (1-10 salariés) — Dirigeant débordé, pragmatique. Pain point : pas de temps, pas de budget pour expérimenter. Veut : premier outil IA rentable sous 4 semaines, ROI immédiat sur tâches admin/relance/devis.

2. **PME** (10-250 salariés) — DG ou Dir.Opérations. Pain point : processus métier manuels coûteux, équipes saturées, pas de DSI. Veut : audit clair, 3 chantiers prioritaires chiffrés, implémentation clés en main, ROI mesurable trimestre.

3. **ETI** (250-4999 salariés) — Dir.Transformation ou Dir.Digital. Pain point : multi-sites, multi-équipes, intégration SI existant (CRM/ERP). Veut : gouvernance IA, déploiement progressif, formation managers + ops, conformité.

4. **Grandes entreprises** (5000+ salariés) — DSI ou Chief AI Officer. Pain point : conformité AI Act, vendor lock-in, gouvernance. Veut : partenaire indépendant sans conflit d'intérêt éditeur, pilotes cadrés, audit trail.

Ton : sobre, factuel, jamais condescendant. Le prospect est un pro qui sent immédiatement le marketing-speak — évite-le.`;

const VILLE_HUB_SYSTEM_PROMPT = `Tu es Manon, plume éditoriale d'Axion-IA — cabinet IA opérationnel français (société française).

Mission : générer la copy d'une PAGE HUB VILLE (≠ article, ≠ landing service).
La page hub est la racine d'une ville sur axion-ia.fr — elle introduit transversalement nos interventions dans la ville.

🚨 RÈGLE ABSOLUE #1 — Axion-IA est un cabinet NATIONAL qui SE DÉPLACE 🚨
- Axion-IA n'a AUCUNE implantation locale dans aucune ville (pas de bureau, pas d'antenne, pas d'équipe locale)
- Nous SOMMES une équipe nationale qui intervient SUR SITE chez le client, partout en France
- INTERDIT : "expertise locale", "équipe locale", "présence locale", "implantation locale", "notre antenne à X", "nous sommes à X", "nous sommes basés à X", "bureau à X", "à proximité"
- AUTORISÉ : "intervention à X", "audit à X", "Williams se déplace à X", "nous accompagnons les entreprises de X", "nos clients à X"
- La page parle TOUJOURS de la ville comme du lieu où SE DÉROULE notre prestation, JAMAIS comme du lieu où NOUS sommes

🚨🚨🚨 RÈGLE ABSOLUE #2 — INTERDICTION ABSOLUE DE FABRIQUER DES PARTENARIATS 🚨🚨🚨
Les noms d'entreprises/pôles/incubateurs présents dans le KB (LVMH, BNP Paribas, Sanofi, Cap Digital, Station F, Inria, ENS, Sciences Po, Hermès, AXA, etc.) :
- Ces noms décrivent l'ÉCOSYSTÈME ÉCONOMIQUE LOCAL de la ville (qui est implanté là)
- Ces noms NE SONT PAS nos clients, NE SONT PAS nos partenaires, NE SONT PAS nos collaborateurs
- Nous N'AVONS PAS de relation commerciale, partenariale ou contractuelle avec ces entités

INTERDIT — c'est MENSONGER et JURIDIQUEMENT RISQUÉ :
- "Axion-IA collabore avec LVMH"
- "Nous travaillons avec Cap Digital"
- "Nos clients comme BNP Paribas"
- "En partenariat avec Inria"
- "En collaboration avec Station F"
- "Notamment chez Sanofi"
- "Au sein de pôles comme X" (sous-entend qu'on EST dans ces pôles)
- Tout phrasing qui sous-entend un lien commercial ou contractuel avec ces marques

AUTORISÉ — ces formulations factuelles sans lien implicite :
- "Paris abrite Cap Digital, Station F, Inria…" (description objective de la ville)
- "Le tissu économique parisien compte LVMH, BNP Paribas, Hermès…" (description de l'écosystème)
- "Les entreprises parisiennes côtoient ces pôles d'innovation"
- "L'écosystème B2B parisien comprend X, Y, Z" (description neutre)

Règle simple : tu PEUX nommer ces entités UNIQUEMENT comme contexte géographique/sectoriel, JAMAIS comme partenaires/clients d'Axion-IA. Si tu ne sais pas comment formuler sans ambiguïté, NE LES MENTIONNE PAS.

Doctrine v2.5 stricte :
- Axion-IA-centric ≥ 95 % (méthodologie + cas concrets + 5 services)
- ≤ 5 % données INSEE (mention contextuelle, pas exhaustive)
- Anti-doorway HCU 2024 : angle UNIQUE par ville (utiliser ≥ 2 noms propres du KB dans chaque champ texte long)
- Positionnement : "cabinet IA opérationnel" ("agence" / "organisme de formation" autorisés — décision 2026-07-12)
- Naming canonique : "intervention" (le mot "formation" est OK en descriptif)
- Tarifs PUBLICS — INTERDIT de dire "contactez-nous pour un devis", "selon la complexité", "selon vos besoins". Si tu ne connais pas un prix exact, dis "tarifs publics consultables".
- FR uniquement
- Ton sobre, factuel, éditorial — pas de superlatifs creux, pas de marketing-speak

Anti-duplicate avec les 5 sous-pages verticales :
- Les sous-pages /interventions, /audits, /implementations, /un-a-un, /sites-web-ia traitent CHAQUE service en profondeur
- Le hub DOIT rester transversal et bref sur les services (servicesContext = 1 phrase chacun, renvoie aux sous-pages)
- N'explique PAS comment se déroule un audit / une intervention / une implémentation — c'est le rôle des sous-pages
- Concentre-toi sur : intervention Axion-IA × écosystème local, FAQ géolocalisée, contexte économique de la ville

🚨🚨 STYLE OBLIGATOIRE — JOURNALISTE BUSINESS, PAS MARKETER 🚨🚨

Tu es un journaliste éditorial de Les Échos / La Tribune qui écrit sur un cabinet IA. PAS un commercial. Donc :

✅ AUTORISÉ — phrases factuelles avec noms propres :
  - "Le bassin industriel de [Ville] regroupe Bouygues, Renault et Sanofi"
  - "Axion-IA intervient à [Ville] pour automatiser devis, relances et reporting"
  - "L'audit Flash 4h démarre à {{price:audit-flash|flat}}" (token prix — JAMAIS de montant en chiffres)
  - "Williams se déplace sur site dans les 5 jours ouvrés"

❌ INTERDIT — adjectifs élogieux + marketing-speak (pénalité -10 par occurrence) :
  - JAMAIS : "transformation digitale efficace", "gain de compétitivité", "solutions sur mesure"
  - JAMAIS : "expertise dédiée", "écosystème dynamique", "acteurs majeurs"
  - JAMAIS : "centre névralgique", "dynamique et innovant", "leviers IA"
  - JAMAIS : "tirer parti", "renforçant son rôle", "développement personnalisé"
  - JAMAIS : "contactez-nous pour devis", "selon vos besoins", "selon la complexité"
  - JAMAIS : "expertise locale", "équipe locale", "présence locale", "notre bureau à X"

RÈGLE D'OR : si tu peux supprimer un adjectif sans changer le sens factuel → SUPPRIME-LE.

Concision absolue — pas de remplissage, pas de paraphrase. Si une info n'est pas dans le KB, n'invente pas.`;

export interface GenerateVilleHubCopyInput {
  readonly villeSlug: string;
  /** Pour la traçabilité (table GenerationLog plus tard). Optionnel. */
  readonly jobId?: string;
  /**
   * Override de la economic-data pour les villes hors `ECONOMIC_DATA_BY_SLUG`
   * (générée à la volée par `landing-ville-economic-data.ts` LLM). Si fourni,
   * prime sur le TS hardcodé. Permet de scaler à 2000+ villes sans data TS.
   */
  readonly ecoOverride?: VilleEconomicData;
}

// 2026-05-26 — tuning OpenAI : GPT-4o tend à utiliser marketing-speak (banned
// phrases), donc plus d'itérations + threshold légèrement plus bas. Best-of-N
// garde toujours le meilleur output produit, donc augmenter MAX ne dégrade jamais.
// Batch T3 mass-regen 2026-05-27 : early-exit dès score 50 (= seuil auto-approve)
// + MAX_RETRY_ITERATIONS=1 (2 iter total) pour accélérer ~4x. Quality 50-60 OK
// pour T3 (cohérent avec batch précédent 53 villes gpt-4o approved score 50-63).
const QUALITY_THRESHOLD_FOR_RETRY = 50;
const MAX_RETRY_ITERATIONS = 1;
const BUDGET_CAP_USD_PER_VILLE = 0.2; // était 0.15 (Claude). OpenAI moins cher → tolère 4 iter.

function buildUserPrompt(
  ville: NonNullable<Awaited<ReturnType<typeof getVille>>>,
  kbMarkdown: string,
  kbDoctrineContext: string,
  retryFeedback: string,
): string {
  const safeSlug = escapeSlugInput(ville.slug);

  const feedbackSection = retryFeedback
    ? `\n\n## ⚠️ FEEDBACK PASSE PRÉCÉDENTE — corrige IMPÉRATIVEMENT\n${retryFeedback}\n`
    : "";

  const kbDoctrineSection = kbDoctrineContext
    ? `\n\n## Knowledge Base Axion-IA — doctrine + méthodologie + cas concrets (utilise ce vocabulaire/ton)\n${kbDoctrineContext}\n`
    : "";

  return `${AUDIENCE_PERSONAS}\n\nGénère la copy hub pour la ville ${safeSlug}.

## Identité ville
- Nom : ${ville.nameFr}
- Région : ${ville.region}
- Département : ${ville.departementLabel ?? ville.departement}
- Code INSEE : ${ville.inseeCode}
- Population : ${ville.population.toLocaleString("fr")} habitants
- Coordonnées : ${ville.geo.lat}, ${ville.geo.lon}

## Knowledge Base — données économiques locales vérifiées (USE THESE NAMES)
${kbMarkdown}${kbDoctrineSection}

## Tarifs publics Axion-IA — utilise les TOKENS prix (JAMAIS de montant en dur)
Pour citer un prix, écris EXACTEMENT le token ci-dessous : il est remplacé par le
tarif réel (source de vérité pricing.ts) au rendu. N'écris JAMAIS un montant en
chiffres ni « € »/« EUR »/« euros » — uniquement le token.
- Audit Flash (4h) : {{price:audit-flash|flat}}
- Formation 4h : {{price:intervention-4h|flat}}
- Formation collective (1 jour) : {{price:intervention-essentielle|flat}}
- Implémentation (Pilote IA) : à partir de {{price:impl-poc|entry}}
- Coaching 1-to-1 dirigeant : {{price:intervention-dirigeants|flat}}

## CONTRAINTES STRICTES (word counts — re-gen si non-respectés)
- pitchFr : 35-55 mots OBLIGATOIRE. DOIT mentionner ≥ 1 nom propre du KB (Cap Digital, Inria, Station F, LVMH…) ET ${ville.nameFr}.
- directAnswerFr : 55-90 mots OBLIGATOIRE, autonome. DOIT nommer ≥ 2 entités précises du KB. PAS de formules creuses ("acteurs majeurs", "expertise dédiée", "solutions sur mesure").
- ecosystemFr : 40-60 mots OBLIGATOIRE via ≥ 2 entités nommées du KB. Bannir : "centre névralgique", "dynamique et innovant", "renforçant son rôle".
- distancesFr : 15-30 mots OBLIGATOIRE, 1 phrase factuelle avec NOMS précis tirés du KB (gares, aéroports, métro).
- topSectorsNaf : 4-6 secteurs en libellés COURTS (max 5 mots) issus du KB.topSectorsNaf simplifiés.
- servicesContext : 4 sections (audit/interventions/implementation/unAUn) — 22-40 mots OBLIGATOIRE chacune. Forme recommandée : "[Verbe d'action] à ${ville.nameFr} [contexte précis avec ≥ 1 nom KB] — [bénéfice concret]." Bannir : "transformation digitale efficace", "gain de compétitivité", "développement personnalisé".
- faqGeolocalisee : 4-6 Q/R B2B local pertinentes (tarifs, déplacement intra-ville, délais, RGPD, formats)
  - Q : 12-22 mots, question concrète d'un prospect ${ville.nameFr}
  - A : 35-65 mots OBLIGATOIRE, FACTUELLE. Pour les tarifs : utiliser les TOKENS prix (ex : "Audit Flash à partir de {{price:audit-flash|flat}}, intervention dès {{price:intervention-4h|flat}} — tarifs publics sur le site"). JAMAIS de montant en chiffres, JAMAIS "contactez-nous pour devis".
## INTERDICTIONS DURES — pénalité -10 par occurrence
- Toute implication qu'Axion-IA est implanté/basé/présent à ${ville.nameFr} : "expertise locale", "équipe locale", "présence locale", "notre antenne", "à proximité", "nos bureaux"
- Marketing-speak : "transformation digitale efficace", "gain de compétitivité", "solutions sur mesure", "acteurs majeurs", "centre névralgique", "dynamique et innovant", "expertise dédiée", "tirer parti", "leviers IA"
- Tarifs flous : "contactez-nous", "selon vos besoins", "selon la complexité", "n'hésitez pas"
- Tout montant en chiffres ou « € »/« EUR »/« euros » écrit en dur (utiliser EXCLUSIVEMENT les tokens {{price:...}})
- Re-traitement détaillé d'un service (réservé aux sous-pages verticales)
- Invention de faits absents du KB${feedbackSection}

## Output attendu — JSON strict, AUCUNE balise markdown autour
{
  "pitchFr": "...",
  "directAnswerFr": "...",
  "ecosystemFr": "...",
  "distancesFr": "...",
  "topSectorsNaf": ["...", "..."],
  "servicesContext": {
    "audit": { "fr": "..." },
    "interventions": { "fr": "..." },
    "implementation": { "fr": "..." },
    "unAUn": { "fr": "..." }
  },
  "faqGeolocalisee": [{ "q": "...", "a": "..." }, ...]
}`;
}

/**
 * Génère + persiste la copy hub d'une ville. Idempotent : upsert sur `villeSlug`.
 *
 * Boucle qualité (audit Will 2026-05-24) :
 *   - Passe 1 (initiale) : génère avec contraintes strictes
 *   - Si score < 70 ET budget < $0.15 → Passe 2 avec feedback explicite
 *   - Si score < 70 ET budget < $0.15 → Passe 3 (dernière chance)
 *   - Garde le MEILLEUR output des passes, persiste
 *
 * Le statut sort `generated` — Will (ou auto-approve si qualityScore ≥ 70 dans script
 * de test) doit passer en `approved` pour activer le rendu en prod.
 */
export async function generateVilleHubCopy(
  input: GenerateVilleHubCopyInput,
): Promise<VilleHubCopyResult> {
  const villeSlug = input.villeSlug;
  const ville = await getVille(villeSlug);
  if (!ville) {
    throw new Error(`generateVilleHubCopy: ville "${villeSlug}" introuvable`);
  }
  const eco = input.ecoOverride ?? ECONOMIC_DATA_BY_SLUG[villeSlug];
  const { facts: kbFacts, markdown: kbMarkdown } = buildKbContext(eco);

  // 🆕 KB RAG retrieve — doctrine + méthodologie + cas concrets Axion-IA
  // Query enrichi : ville + verticales pour matching FTS hybride
  // sectorTagSlugs : tirés du KB economic-data pour scoring sectoriel
  const sectorTagSlugs = eco?.kbSectorTags?.map((t) => String(t)) ?? [];
  let kbDoctrineContext = "";
  try {
    const kbChunks = await kbRetrieve({
      query: `cabinet IA opérationnel ${ville.nameFr} audit intervention implementation méthodologie`,
      locale: "fr",
      k: 6,
      filters: {
        audiences: ["public"],
        types: ["methodology", "doctrine", "case_study", "industry_use_case"],
      },
      ...(sectorTagSlugs.length > 0 ? { sectorTagSlugs } : {}),
      mode: "hybrid",
    });
    kbDoctrineContext = kbChunks
      .map((c, i) => `[${i + 1}] (${c.type}) ${c.title}\n${c.excerpt ?? ""}`)
      .join("\n\n");
  } catch (err) {
    console.warn(
      `[ville-hub-copy] ${villeSlug} — KB retrieve failed (fallback to KEcoData only):`,
      err instanceof Error ? err.message : err,
    );
    kbDoctrineContext = "";
  }

  // Best-of-N tracking
  let bestOutput: VilleHubCopyOutput | null = null;
  let bestScore = -1;
  let bestModel = "";
  let bestPromptHash = "";
  let bestTokensInput = 0;
  let bestTokensOutput = 0;
  let totalCostUsd = 0;
  let retryFeedback = "";
  let iteration = 0;

  while (iteration <= MAX_RETRY_ITERATIONS) {
    if (totalCostUsd >= BUDGET_CAP_USD_PER_VILLE) {
      console.warn(
        `[ville-hub-copy] ${villeSlug} — budget cap atteint ($${totalCostUsd.toFixed(4)}), arrêt`,
      );
      break;
    }

    const userPrompt = buildUserPrompt(ville, kbMarkdown, kbDoctrineContext, retryFeedback);
    const systemPrompt = `${VILLE_HUB_SYSTEM_PROMPT}\n\n${getBrandVoiceForContentType("landing_ville")}`;
    const promptHash = hashPrompt(systemPrompt + userPrompt);

    // Temperature décroissante : passe 1 plus créative, passes suivantes plus rigides
    const temperature = iteration === 0 ? 0.5 : iteration === 1 ? 0.35 : 0.2;

    const llmResult = await routerGenerate({
      jobId: input.jobId ?? `ville-hub-${villeSlug}-${Date.now()}-iter${iteration}`,
      contentType: "landing_ville",
      role: "text",
      systemPrompt,
      userPrompt,
      maxTokens: 2400,
      temperature,
      // 2026-05-26 — switch OpenAI (Anthropic credit empty). Revert si qualité
      // insuffisante après recharge Anthropic.
      preferredProvider: "openai",
    });

    totalCostUsd += llmResult.costUsd;
    iteration++;

    // Parse + validate
    let parsedRaw: unknown;
    try {
      parsedRaw = parseLlmJson(llmResult.output);
    } catch (err) {
      retryFeedback = `JSON invalide passe précédente — retourne UNIQUEMENT du JSON pur, sans \`\`\`json\`\`\` ni texte autour. Erreur : ${err instanceof Error ? err.message : "parse failed"}`;
      console.warn(`[ville-hub-copy] ${villeSlug} iter${iteration} — JSON parse failed, retry`);
      continue;
    }
    const parseResult = VilleHubCopySchema.safeParse(parsedRaw);
    if (!parseResult.success) {
      const flatIssues = parseResult.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 8)
        .join(" / ");
      retryFeedback = `Schema Zod invalide — corrige ces erreurs : ${flatIssues}`;
      console.warn(`[ville-hub-copy] ${villeSlug} iter${iteration} — Zod failed, retry`);
      continue;
    }
    const output = parseResult.data;

    // Quality gate
    const { score, issues, retryFeedback: nextFeedback } = computeQualityScore(output);
    console.log(
      `[ville-hub-copy] ${villeSlug} iter${iteration} — score ${score}/100 (${issues.length} issues, cost $${llmResult.costUsd.toFixed(4)}, cumulé $${totalCostUsd.toFixed(4)})`,
    );

    // Garde le meilleur output
    if (score > bestScore) {
      bestScore = score;
      bestOutput = output;
      bestModel = llmResult.model;
      bestPromptHash = promptHash;
      bestTokensInput = llmResult.tokensInput;
      bestTokensOutput = llmResult.tokensOutput;
    }

    // Si score >= threshold → on s'arrête là, c'est bon
    if (score >= QUALITY_THRESHOLD_FOR_RETRY) {
      break;
    }

    // Sinon, prépare le feedback pour la passe suivante
    retryFeedback = nextFeedback;
  }

  if (!bestOutput) {
    throw new Error(
      `generateVilleHubCopy(${villeSlug}): aucune passe valide après ${iteration} itérations (budget $${totalCostUsd.toFixed(4)})`,
    );
  }

  // 🆕 Phase 3 Sprint Quality 2026 — Cross-check anti-duplicate vs verticales existantes
  // Fetch les Articles landing_ville déjà publiés pour cette ville (5 verticales max)
  let duplicateScore: number | null = null;
  try {
    // Article n'a pas contentType (c'est sur ContentGenJob). On filtre via templateVariant
    // (qui matche les 5 verticales) + mentionedCities qui contient le villeSlug.
    const existingVerticales = await prisma.article.findMany({
      where: {
        templateVariant: {
          in: ["interventions", "audits", "implementations", "un-a-un", "sites-web-ia"],
        },
        mentionedCities: { has: villeSlug },
        status: { in: ["published", "draft"] },
      },
      include: {
        translations: { where: { locale: "fr" }, select: { body: true, excerpt: true } },
      },
    });
    if (existingVerticales.length > 0) {
      const verticalesForCheck = existingVerticales.map((v) => {
        const tr = v.translations[0];
        const hero = tr?.excerpt ?? (tr?.body ?? "").slice(0, 400);
        const directAnswer = v.directAnswer;
        return {
          slug: v.templateVariant ?? "(unknown)",
          hero,
          ...(directAnswer ? { directAnswer } : {}),
        };
      });
      const dupResult = checkHubVsVerticalesDuplicate({
        hubPitchFr: bestOutput.pitchFr,
        hubDirectAnswerFr: bestOutput.directAnswerFr,
        verticales: verticalesForCheck,
      });
      duplicateScore = dupResult.maxSimilarity;
      if (dupResult.issues.length > 0) {
        console.warn(
          `[ville-hub-copy] ${villeSlug} — Duplicate WARNING (max Jaccard ${dupResult.maxSimilarity.toFixed(3)}):`,
          dupResult.issues,
        );
      } else {
        console.log(
          `[ville-hub-copy] ${villeSlug} — Anti-duplicate OK (max Jaccard ${dupResult.maxSimilarity.toFixed(3)} ≤ 0.4)`,
        );
      }
    } else {
      console.log(
        `[ville-hub-copy] ${villeSlug} — Aucune verticale publiée encore, skip cross-check`,
      );
    }
  } catch (err) {
    console.warn(
      `[ville-hub-copy] ${villeSlug} — cross-check failed (non-bloquant):`,
      err instanceof Error ? err.message : err,
    );
  }

  // Persist le meilleur (upsert sur villeSlug)
  await prisma.generatedVilleCopy.upsert({
    where: { villeSlug },
    create: {
      villeSlug,
      pitchFr: bestOutput.pitchFr,
      directAnswerFr: bestOutput.directAnswerFr,
      ecosystemFr: bestOutput.ecosystemFr,
      distancesFr: bestOutput.distancesFr,
      topSectorsNaf: [...bestOutput.topSectorsNaf],
      servicesContextJson: bestOutput.servicesContext,
      faqGeolocaliseeJson: [...bestOutput.faqGeolocalisee],
      qualityScore: bestScore,
      duplicateVsVerticales: duplicateScore,
      modelUsed: bestModel,
      totalCostUsd, // cumulé sur toutes les passes
      promptHash: bestPromptHash,
      tokensInput: bestTokensInput,
      tokensOutput: bestTokensOutput,
      kbContextUsed: {
        ecoFacts: kbFacts.map((f) => `${f.label}: ${f.value}`),
        kbDoctrineChunkCount: kbDoctrineContext ? kbDoctrineContext.split("\n\n").length : 0,
        iterations: iteration,
      },
      status: "generated",
    },
    update: {
      pitchFr: bestOutput.pitchFr,
      directAnswerFr: bestOutput.directAnswerFr,
      ecosystemFr: bestOutput.ecosystemFr,
      distancesFr: bestOutput.distancesFr,
      topSectorsNaf: [...bestOutput.topSectorsNaf],
      servicesContextJson: bestOutput.servicesContext,
      faqGeolocaliseeJson: [...bestOutput.faqGeolocalisee],
      qualityScore: bestScore,
      duplicateVsVerticales: duplicateScore,
      modelUsed: bestModel,
      totalCostUsd,
      promptHash: bestPromptHash,
      tokensInput: bestTokensInput,
      tokensOutput: bestTokensOutput,
      kbContextUsed: {
        ecoFacts: kbFacts.map((f) => `${f.label}: ${f.value}`),
        kbDoctrineChunkCount: kbDoctrineContext ? kbDoctrineContext.split("\n\n").length : 0,
        iterations: iteration,
      },
      status: "generated",
      reviewedAt: null,
      reviewedBy: null,
    },
  });

  // 🆕 Fix C2 (log-only) — signal de monitoring soft-404 (thin copy).
  // ⚠️ STRICTEMENT additif : on NE change PAS l'indexationTier ni le status
  // (décision #66 : toutes les villes restent indexables immédiatement).
  // On émet uniquement un WARNING de monitoring si la copy générée est thin.
  const soft404WordCount =
    countWords(bestOutput.pitchFr) +
    countWords(bestOutput.directAnswerFr) +
    countWords(bestOutput.ecosystemFr) +
    countWords(bestOutput.distancesFr) +
    countWords(bestOutput.servicesContext.audit.fr) +
    countWords(bestOutput.servicesContext.interventions.fr) +
    countWords(bestOutput.servicesContext.implementation.fr) +
    countWords(bestOutput.servicesContext.unAUn.fr) +
    bestOutput.faqGeolocalisee.reduce((sum, f) => sum + countWords(f.q) + countWords(f.a), 0);
  const soft404 = evaluateSoft404({
    wordCount: soft404WordCount,
    hasFullLocalBusinessJsonLd: false,
    hasLocalCase: false,
    faqCount: bestOutput.faqGeolocalisee.length,
  });
  if (soft404.isSoft404) {
    console.warn(
      `[ville-hub-copy] soft-404 détecté (thin) villeSlug=${villeSlug} wordCount=${soft404WordCount} ` +
        `(seuil ${soft404.threshold}, reason ${soft404.reason}) — log-only, indexation inchangée`,
    );
  }

  return {
    villeSlug,
    output: bestOutput,
    qualityScore: bestScore,
    modelUsed: bestModel,
    totalCostUsd,
    tokensInput: bestTokensInput,
    tokensOutput: bestTokensOutput,
    promptHash: bestPromptHash,
    kbContextUsed: kbFacts.map((f) => `${f.label}: ${f.value}`),
  };
}
