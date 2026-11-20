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
import { faqItems } from "@/content/questions-reference";
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
      question: "Comment démarre un audit IA avec Axion-IA ?",
      answer:
        "Un audit IA avec Axion-IA démarre par un rendez-vous de cadrage gratuit de 45 minutes, en visio ou par téléphone. Pour la plupart des entreprises, nous planifions ensuite La Journée IA dans vos locaux, avec un rapport complet remis sous 3 jours ouvrés. Pour un audit plus approfondi, vous recevez d'abord un devis écrit sous 48 h ouvrées.",
    },
    {
      id: "remote-onsite",
      question: "Un audit IA se fait-il à distance ou sur site ?",
      answer:
        "Un audit IA peut se faire à distance ou sur site, selon votre besoin. À distance : visio sécurisée, entretiens et analyse de données. Sur site : observation directe du travail et ateliers métier avec les équipes concernées. La Journée IA, elle, se déroule dans vos locaux, partout en France métropolitaine, pour voir les tâches là où elles se font.",
    },
    {
      id: "data",
      question: "Quelles données faut-il fournir pour un audit IA ?",
      answer:
        "Pour un audit IA, vous fournissez d'abord peu de choses : la taille de l'entreprise, le secteur, les outils utilisés et le périmètre souhaité, pour établir le devis. Aucun accès à vos systèmes de production n'est demandé avant la signature. Aucune donnée sensible n'est exfiltrée hors de l'Union européenne, et le RGPD s'applique.",
    },
    {
      id: "after",
      question: "Que se passe-t-il après un audit IA ?",
      answer:
        "Après un audit IA, vous repartez avec un plan d'action chiffré et priorisé par phases. Vous déployez ensuite à votre rythme, avec vos équipes ou avec Axion-IA grâce au module Implémentation, sur devis écrit.",
    },
    {
      id: "eu-jurisdiction",
      question: "Axion-IA peut-elle facturer en France ?",
      answer:
        "Oui, Axion-IA facture en France : c'est une société française (SAS). Les devis et les factures sont établis hors taxes, la TVA au taux en vigueur s'ajoutant. Les données sont hébergées dans l'Union européenne, dans le respect du RGPD. Vous recevez un devis écrit avant tout démarrage, et rien ne se paie en ligne.",
    },
    {
      id: "starting-point",
      question: "Que faire si je ne sais pas par où commencer avec l'IA ?",
      answer:
        "Si vous ne savez pas par où commencer avec l'IA, commencez par La Journée IA : l'audit du matin chiffre vos priorités, la formation de l'après-midi met vos équipes au travail, et le rapport complet arrive sous 3 jours ouvrés. Le module Implémentation peut ensuite prendre le relais, sur devis écrit.",
    },
    ...faqItems(["ref-audit-contenu", "ref-audit-prix", "ref-audit-vs-info"]).map(
      ({ id, question, answer }) => ({ id, question, answer }),
    ),
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
        "You leave with a costed action plan, prioritised by phase. You deploy at your pace — with your teams or with us (Implementation module).",
    },
    {
      id: "eu-jurisdiction",
      question: "Can Axion-IA invoice in France?",
      answer:
        "Yes. Axion-IA is a French company (SAS). Quotes and invoices are issued excluding VAT, data is hosted in the EU, and GDPR applies.",
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
      ? `Les questions que tout dirigeant pose avant de réserver un audit IA, complétées de précisions pour les entreprises de ${villeContext.name}. Si la vôtre n'y est pas, écrivez-nous.`
      : `The questions every leader asks before booking, plus specifics for ${villeContext.name}-area companies. Not yours? Write us.`
    : isFr
      ? "Les questions que tout dirigeant pose avant de réserver. Si la vôtre n'y est pas, écrivez-nous."
      : "The questions every leader asks before booking. Not yours? Write us.";

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
