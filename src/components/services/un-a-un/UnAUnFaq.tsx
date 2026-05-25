/**
 * UnAUnFaq — FAQ "L'essentiel à savoir" du service `un-a-un` (5 questions).
 *
 * Sprint A Phase 2 — extrait depuis `src/app/[locale]/un-a-un/page.tsx`.
 * Questions essentielles : durée session / prix / visio-ou-site / outils IA
 * enseignés / garantie de résultat. Prix injecté via SSOT
 * (`UN_A_UN_TIERS` → `getEntryTier` + `formatPrice`).
 *
 * `FaqAccordion` émet automatiquement le JSON-LD FAQPage avec Speakable
 * (`buildFaqJsonLd` injecte Speakable par défaut). Si `villeSpecificFaqs`
 * est fourni, les Q/R ville-spécifiques sont préfixées à la liste générique.
 *
 * Server Component pur, zéro JS.
 */

import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { UN_A_UN_TIERS, formatPrice, getEntryTier } from "@/content/pricing";
import type { VilleContext } from "@/components/services/types";

interface UnAUnFaqProps {
  readonly isFr: boolean;
  /** Si fourni, le titre de section peut être ville-aware (futur). */
  readonly villeContext?: VilleContext;
  /** Q/R additionnelles préfixées à la liste — typiquement géo (« Intervenez-vous à X ? »). */
  readonly villeSpecificFaqs?: ReadonlyArray<{ readonly q: string; readonly a: string }>;
}

export function UnAUnFaq({ isFr, villeContext, villeSpecificFaqs }: UnAUnFaqProps) {
  const entryTier = getEntryTier(UN_A_UN_TIERS);
  const formattedPrice = formatPrice(entryTier, isFr ? "fr" : "en");

  const baseItems = isFr
    ? ([
        {
          id: "duree-session",
          question: "Combien de temps dure une session ?",
          answer:
            "La journée standard fait 7 h sur site (9h-17h avec pause déjeuner). En visio, on adapte par blocs de 2-3 h selon l'agenda de la personne. Pas de format imposé.",
        },
        {
          id: "prix",
          question: "Combien ça coûte ?",
          answer: `${formattedPrice} pour la journée 1-to-1 dirigeant. Pour un collaborateur clé (non-dirigeant), tarif préférentiel sur devis. Frais de déplacement facturés en sus selon distance/durée — devis transparent avant signature.`,
        },
        {
          id: "visio-ou-site",
          question: "Visio ou sur site ?",
          answer:
            "Au choix. La visio fonctionne très bien pour le coaching IA (partage d'écran sur les outils réels de la personne). Le sur site est privilégié quand il faut voir le contexte physique (atelier, ligne de production, point de vente).",
        },
        {
          id: "outils",
          question: "Quels outils IA sont enseignés ?",
          answer:
            "Ceux que la personne utilise déjà ou qui correspondent à son poste : ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, NotebookLM, plus les automatisations métier (Make, Zapier) si pertinent. Pas de techno imposée — on travaille sur ses outils réels.",
        },
        {
          id: "garantie",
          question: "Garantie de résultat ?",
          answer:
            "Si la personne n'a rien tiré de la journée (cas extrêmement rare), on rembourse intégralement. Concrètement, 100 % de nos clients 1-to-1 ressortent avec 3-5 automatisations ou améliorations directement applicables à leur poste.",
        },
      ] as const)
    : ([
        {
          id: "session-length",
          question: "How long is a session?",
          answer:
            "Standard day is 7 h on-site (9am-5pm with lunch break). Remotely, we adapt in 2-3 h blocks based on the person's schedule. No imposed format.",
        },
        {
          id: "price",
          question: "How much does it cost?",
          answer: `${formattedPrice} for the 1-to-1 executive day. For a key employee (non-executive), preferential rate on request. Travel expenses billed separately based on distance/duration — transparent quote before signature.`,
        },
        {
          id: "remote-or-onsite",
          question: "Remote or on-site?",
          answer:
            "Either. Remote works very well for AI coaching (screen sharing on the person's real tools). On-site is preferred when the physical context matters (workshop, production line, point of sale).",
        },
        {
          id: "tools",
          question: "Which AI tools are taught?",
          answer:
            "The ones the person already uses or that fit their role: ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, NotebookLM, plus business automations (Make, Zapier) if relevant. No imposed tech — we work on their real tools.",
        },
        {
          id: "guarantee",
          question: "Guarantee?",
          answer:
            "If the person got nothing from the day (extremely rare), we refund in full. Concretely, 100 % of our 1-to-1 customers come out with 3-5 automations or improvements directly applicable to their role.",
        },
      ] as const);

  // Slugify Q ville-specifiques → id stable + collision-safe avec base.
  const villeItems =
    villeSpecificFaqs?.map((f, i) => ({
      id: `ville-faq-${i + 1}`,
      question: f.q,
      answer: f.a,
    })) ?? [];

  const allItems = [...villeItems, ...baseItems];

  const titleEm = villeContext
    ? isFr
      ? `à savoir pour ${villeContext.name}`
      : `to know for ${villeContext.name}`
    : isFr
      ? "à savoir"
      : "to know";

  return (
    <Section
      eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
      title={isFr ? "L'essentiel" : "The essentials"}
      titleEm={titleEm}
    >
      <Container>
        <FaqAccordion className="mx-auto max-w-3xl" items={allItems} />
      </Container>
    </Section>
  );
}
