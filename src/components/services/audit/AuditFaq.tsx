/**
 * AuditFaq — FAQ 6 questions audit + JSON-LD FAQPage + Speakable (Server Component).
 *
 * Sprint A · Phase 2 (Will 2026-05-25) — extrait depuis `src/app/[locale]/audit/page.tsx`
 * (l.271-353). 6 questions canoniques (duree-reservation, remote-onsite, data,
 * after, eu-jurisdiction, starting-point). Quand `villeSpecificFaqs` est
 * fourni (page ville), 2-3 Q/A LLM-générées sont ajoutées en queue. Le JSON-LD
 * FAQPage + SpeakableSpecification est émis automatiquement par `FaqAccordion`
 * (cf. `buildFaqJsonLd`).
 */

import type { ReactNode } from "react";
import { Section } from "@/components/layout/Section";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import type { VilleContext } from "@/components/services/types";
import { AUDIT_TIERS, formatAmount, getTierById } from "@/content/pricing";

interface AuditFaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface AuditFaqProps {
  readonly isFr: boolean;
  readonly villeContext?: VilleContext;
  /**
   * Q/A additionnelles ville-spécifiques (généralement 2-3 entrées LLM-générées
   * sur des sujets comme « Couverture ville X », « Délai déplacement », etc.).
   * Optionnel.
   */
  readonly villeSpecificFaqs?: ReadonlyArray<{ q: string; a: string }>;
}

function buildFrFaqs(onsitePrice: string): ReadonlyArray<AuditFaqItem> {
  return [
    {
      id: "duree-reservation",
      question: "Combien de temps prend la réservation ?",
      answer: `L'audit Flash terrain (${onsitePrice}) se réserve directement sur le calendrier en 2 minutes. Pour Flash distance et les niveaux Ciblé / Stratégique, vous recevez un devis personnalisé sous 48 h ouvrées avec un créneau d'appel de cadrage proposé.`,
    },
    {
      id: "remote-onsite",
      question: "À distance ou sur site, quelle différence ?",
      answer:
        "À distance : visio sécurisée + entretiens + analyse des données partagées. Plus rapide à organiser, tarif réduit. Sur site : observation directe, immersion équipe, ateliers métier physiques. Recommandé dès le niveau Ciblé pour les ateliers métier.",
    },
    {
      id: "data",
      question: "Quelles données dois-je vous fournir ?",
      answer:
        "Aucune donnée sensible n'est exfiltrée hors UE. Tous les entretiens et analyses se font sur place ou en visio sécurisée. Pour calibrer le devis : taille de l'équipe, secteur, outils en place, périmètre cible. Aucun accès production demandé avant signature.",
    },
    {
      id: "after",
      question: "Que se passe-t-il après l'audit ?",
      answer:
        "Vous repartez avec un plan d'action chiffré, exécutable par vos équipes ou par Axion-IA (module Implémentation). Une session de suivi peut être programmée 30 à 60 jours après la livraison pour challenger la mise en œuvre — sans frais additionnels si elle tient en 60 minutes.",
    },
    {
      id: "eu-jurisdiction",
      question: "Axion-IA peut-elle facturer en France ?",
      answer:
        "Oui. Axion-IA est une société européenne dûment enregistrée, opérant en libre prestation de services dans toute l'UE (incluant France). Facturation HT, paiement par virement SEPA ou carte. Données hébergées exclusivement en UE (Hetzner Frankfurt). Conformité RGPD complète.",
    },
    {
      id: "starting-point",
      question: "Et si je ne sais pas par où commencer ?",
      answer:
        "Notre rapport est volontairement priorisé : le quick-win #1 doit être lançable dans la semaine qui suit la restitution. Si vous hésitez, nous proposons un appel de clarification gratuit de 30 minutes dans les 30 jours suivant la livraison. Et le module Implémentation peut prendre le relais sans transition.",
    },
  ];
}

function buildEnFaqs(onsitePrice: string): ReadonlyArray<AuditFaqItem> {
  return [
    {
      id: "duree-reservation",
      question: "How long does booking take?",
      answer: `The on-site Flash audit (${onsitePrice}) is booked directly on the calendar in 2 minutes. For remote Flash and Targeted / Strategic levels, you receive a personalised quote within 48 business hours with a proposed framing call slot.`,
    },
    {
      id: "remote-onsite",
      question: "Remote or on site — what's the difference?",
      answer:
        "Remote: secure video + interviews + analysis of shared data. Faster to organise, reduced fee. On site: direct observation, team immersion, physical business workshops. Recommended from Targeted level for business workshops.",
    },
    {
      id: "data",
      question: "What data do I need to provide?",
      answer:
        "No sensitive data is exfiltrated outside the EU. All interviews and analysis happen on-site or in secure video conferencing. To calibrate the quote: team size, sector, tools in place, target scope. No production access requested before signing.",
    },
    {
      id: "after",
      question: "What happens after the audit?",
      answer:
        "You leave with a costed action plan, executable by your teams or by Axion-IA (Implementation module). A follow-up session can be scheduled 30 to 60 days after delivery to challenge execution — at no additional cost if it fits in 60 minutes.",
    },
    {
      id: "eu-jurisdiction",
      question: "Can Axion-IA invoice in France?",
      answer:
        "Yes. Axion-IA is a duly registered European company, operating under EU free-services-provision (including France). Excl. VAT invoicing, SEPA transfer or card payment. Data hosted exclusively in the EU (Hetzner Frankfurt). Full GDPR compliance.",
    },
    {
      id: "starting-point",
      question: "What if I don't know where to start?",
      answer:
        "Our report is deliberately prioritised: quick-win #1 must be launchable within a week of the debrief. If you hesitate, we offer a free 30-minute clarification call within the 30 days following delivery. And the Implementation module can take over without transition.",
    },
  ];
}

/** Slugify minimaliste pour générer des ids stables à partir d'une question LLM. */
function slugifyId(input: string, fallbackIndex: number): string {
  const slug = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? `ville-${slug}` : `ville-q-${fallbackIndex}`;
}

export function AuditFaq({ isFr, villeContext, villeSpecificFaqs }: AuditFaqProps): ReactNode {
  const loc: "fr" | "en" = isFr ? "fr" : "en";
  const flashTier = getTierById(AUDIT_TIERS, "audit-flash");
  const onsitePrice = formatAmount(flashTier.priceFlatOnsite ?? 890, loc, { compact: true });
  const baseItems = isFr ? buildFrFaqs(onsitePrice) : buildEnFaqs(onsitePrice);

  const extraItems: ReadonlyArray<AuditFaqItem> = villeSpecificFaqs
    ? villeSpecificFaqs.slice(0, 3).map((entry, idx) => ({
        id: slugifyId(entry.q, idx),
        question: entry.q,
        answer: entry.a,
      }))
    : [];

  const items = [...baseItems, ...extraItems];

  const description = villeContext
    ? isFr
      ? `Les 6 questions que tout dirigeant pose avant de réserver un audit IA, complétées de précisions pour les entreprises de ${villeContext.name}. Si la vôtre n'y est pas, écrivez-nous — on répond sous 24 h ouvrées.`
      : `The 6 questions every leader asks before booking, plus specifics for ${villeContext.name}-area companies. Not yours? Write us — we reply within 24 business hours.`
    : isFr
      ? "Les 6 questions que tout dirigeant pose avant de réserver. Si la vôtre n'y est pas, écrivez-nous — on répond sous 24 h ouvrées."
      : "The 6 questions every leader asks before booking. Not yours? Write us — we reply within 24 business hours.";

  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Questions fréquentes" : "Frequently asked"}
      title={isFr ? "On vous répond" : "We answer"}
      titleEm={isFr ? "sans détour" : "without spin"}
      description={description}
      contentClassName="lg:px-6 xl:px-10 max-w-4xl"
    >
      <FaqAccordion items={items} />
    </Section>
  );
}
