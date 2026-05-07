import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/glossaire",
    title:
      locale === "fr"
        ? "Glossaire IA · termes essentiels · AxionIA"
        : "AI glossary · essential terms · AxionIA",
    description:
      locale === "fr"
        ? "Glossaire IA AxionIA : LLM, RAG, fine-tuning, agents, MCP, vectorisation, hallucination, prompt engineering."
        : "AxionIA AI glossary: LLM, RAG, fine-tuning, agents, MCP, vectorization, hallucination, prompt engineering.",
    alternates: { fr: "/glossaire", en: "/glossary" },
  });
}

interface Term {
  term: string;
  fr: string;
  en: string;
}

const TERMS: ReadonlyArray<Term> = [
  {
    term: "LLM",
    fr: "Large Language Model — modèle de langage entraîné sur des milliards de paramètres pour générer du texte cohérent (GPT-4, Claude, Llama).",
    en: "Large Language Model — language model trained on billions of parameters to generate coherent text (GPT-4, Claude, Llama).",
  },
  {
    term: "RAG",
    fr: "Retrieval-Augmented Generation — pattern qui ancre la génération IA sur des documents propriétaires via recherche vectorielle pour éviter les hallucinations.",
    en: "Retrieval-Augmented Generation — pattern grounding AI generation on proprietary documents via vector search to avoid hallucinations.",
  },
  {
    term: "Fine-tuning",
    fr: "Spécialisation d'un modèle de base sur vos données. Coûte 8-50 k€, justifié seulement après 6-12 mois d'usage en RAG.",
    en: "Specialising a base model on your data. Costs €8-50k, justified only after 6-12 months of RAG usage.",
  },
  {
    term: "Agent",
    fr: "IA capable de planifier, utiliser des outils (web, API, code) et boucler jusqu'à atteindre un objectif. Coût d'inférence 5-10× supérieur à un LLM.",
    en: "AI capable of planning, using tools (web, API, code) and looping until reaching a goal. Inference cost 5-10× higher than an LLM.",
  },
  {
    term: "MCP",
    fr: "Model Context Protocol — protocole open standard pour connecter des LLMs à des outils externes (databases, APIs, file systems) de façon réutilisable.",
    en: "Model Context Protocol — open standard protocol to connect LLMs to external tools (databases, APIs, file systems) in a reusable way.",
  },
  {
    term: "Vectorisation",
    fr: "Transformation d'un texte en vecteur numérique haute-dimension (typiquement 768-3072 dim) pour permettre la recherche sémantique.",
    en: "Transforming text into a high-dimensional numeric vector (typically 768-3072 dim) to enable semantic search.",
  },
  {
    term: "Hallucination",
    fr: "Génération d'information factuellement fausse mais formulée avec assurance. Mitigée par RAG + citations sources + validation humaine.",
    en: "Generating factually false information stated with confidence. Mitigated by RAG + source citations + human validation.",
  },
  {
    term: "Prompt engineering",
    fr: "Discipline d'écriture des instructions LLM. Couvre 80 % des cas avant de justifier un fine-tuning. ROI très élevé.",
    en: "Discipline of writing LLM instructions. Covers 80% of cases before justifying fine-tuning. Very high ROI.",
  },
  {
    term: "Tokens",
    fr: "Unités fondamentales facturées par les API LLM. ~4 caractères/token en français. 1 page A4 ≈ 500 tokens.",
    en: "Fundamental units billed by LLM APIs. ~4 chars/token in English. 1 A4 page ≈ 500 tokens.",
  },
  {
    term: "Embedding",
    fr: "Représentation vectorielle d'un texte produite par un modèle dédié (text-embedding-3, BGE-M3). Briques de base de la recherche RAG.",
    en: "Vector representation of text produced by a dedicated model (text-embedding-3, BGE-M3). Building blocks of RAG search.",
  },
  {
    term: "Context window",
    fr: "Volume de texte qu'un LLM peut considérer simultanément. GPT-4o : 128k tokens, Claude Opus 4 : 1M tokens, Gemini 1.5 Pro : 2M tokens.",
    en: "Volume of text an LLM can consider at once. GPT-4o: 128k tokens, Claude Opus 4: 1M tokens, Gemini 1.5 Pro: 2M tokens.",
  },
  {
    term: "Inference",
    fr: "Exécution d'un modèle entraîné sur de nouvelles entrées. Facturé à l'usage (tokens). 60-80 % du coût total IA en production.",
    en: "Running a trained model on new inputs. Usage-billed (tokens). 60-80% of total AI production cost.",
  },
];

export default async function GlossaryPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: isFr ? "Glossaire IA AxionIA" : "AxionIA AI glossary",
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/glossaire`,
    hasDefinedTerm: TERMS.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t[loc],
      inDefinedTermSet: `${SITE_URL}/${locale}/glossaire`,
    })),
  } as const;

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/glossaire", label: isFr ? "Glossaire" : "Glossary" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Glossaire" : "Glossary"}
        title={isFr ? "Termes IA" : "Essential AI"}
        titleEm={isFr ? "essentiels" : "terms"}
        description={
          isFr
            ? "12 termes pour parler IA en réunion sans se tromper. Mis à jour à chaque évolution majeure."
            : "12 terms to discuss AI in meetings without errors. Updated on each major evolution."
        }
      />
      <Section>
        <Container className="max-w-3xl">
          <dl className="border-border divide-border space-y-0 divide-y border-y">
            {TERMS.map((t) => (
              <div key={t.term} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-fg font-mono text-sm font-semibold">{t.term}</dt>
                <dd className="text-fg-soft text-base leading-relaxed">{t[loc]}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
      <JsonLd data={definedTermSetJsonLd} />
    </>
  );
}
