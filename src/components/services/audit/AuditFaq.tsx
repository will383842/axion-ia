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

function buildFrFaqs(): ReadonlyArray<AuditFaqItem> {
  return [
    {
      id: "duree-reservation",
      question: "Comment ça démarre ?",
      answer:
        "Un appel de cadrage en 2 minutes. Pour l'Audit Flash, on planifie la journée ; pour un audit complet, vous recevez un devis sous 48 h ouvrées.",
    },
    {
      id: "remote-onsite",
      question: "À distance ou sur site ?",
      answer:
        "À distance : visio sécurisée, entretiens, analyse de données. Sur site : observation directe et ateliers métier. Au choix selon votre besoin.",
    },
    {
      id: "data",
      question: "Quelles données dois-je fournir ?",
      answer:
        "Aucune donnée sensible n'est exfiltrée hors UE. Pour le devis : taille, secteur, outils, périmètre. Aucun accès production avant signature.",
    },
    {
      id: "after",
      question: "Que se passe-t-il après l'audit ?",
      answer:
        "Vous repartez avec un plan d'action chiffré, priorisé par phases. Vous déployez à votre rythme — avec vos équipes ou avec nous (module Implémentation). Un suivi peut être programmé après livraison.",
    },
    {
      id: "eu-jurisdiction",
      question: "Axion-IA peut-elle facturer en France ?",
      answer:
        "Oui. Société européenne en libre prestation dans toute l'UE (France incluse). Facturation HT, données hébergées en UE, conformité RGPD.",
    },
    {
      id: "starting-point",
      question: "Et si je ne sais pas par où commencer ?",
      answer:
        "Le rapport est priorisé : le quick-win nº 1 est lançable dès la semaine suivante. Et le module Implémentation peut prendre le relais.",
    },
  ];
}

function buildEnFaqs(): ReadonlyArray<AuditFaqItem> {
  return [
    {
      id: "duree-reservation",
      question: "How does it start?",
      answer:
        "A 2-minute scoping call. For the Flash audit we plan the day; for a complete audit you receive a quote within 48 business hours.",
    },
    {
      id: "remote-onsite",
      question: "Remote or on site?",
      answer:
        "Remote: secure video, interviews, data analysis. On site: direct observation and business workshops. Your choice, based on your need.",
    },
    {
      id: "data",
      question: "What data do I need to provide?",
      answer:
        "No sensitive data is exfiltrated outside the EU. For the quote: size, sector, tools, scope. No production access before signing.",
    },
    {
      id: "after",
      question: "What happens after the audit?",
      answer:
        "You leave with a costed action plan, prioritised by phase. You deploy at your pace — with your teams or with us (Implementation module). A follow-up can be scheduled after delivery.",
    },
    {
      id: "eu-jurisdiction",
      question: "Can Axion-IA invoice in France?",
      answer:
        "Yes. A registered European company under EU free-services-provision (France included). Excl. VAT invoicing, EU-hosted data, full GDPR compliance.",
    },
    {
      id: "starting-point",
      question: "What if I don't know where to start?",
      answer:
        "The report is prioritised: quick-win #1 is launchable the very next week. And the Implementation module can take over.",
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
  const baseItems = isFr ? buildFrFaqs() : buildEnFaqs();

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
      ? `Les 6 questions que tout dirigeant pose avant de réserver un audit IA, complétées de précisions pour les entreprises de ${villeContext.name}. Si la vôtre n'y est pas, écrivez-nous — on répond sous 48 h ouvrées.`
      : `The 6 questions every leader asks before booking, plus specifics for ${villeContext.name}-area companies. Not yours? Write us — we reply within 48 business hours.`
    : isFr
      ? "Les 6 questions que tout dirigeant pose avant de réserver. Si la vôtre n'y est pas, écrivez-nous — on répond sous 48 h ouvrées."
      : "The 6 questions every leader asks before booking. Not yours? Write us — we reply within 48 business hours.";

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
