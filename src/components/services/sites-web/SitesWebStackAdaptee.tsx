/**
 * SitesWebStackAdaptee — « On s'intègre à votre stack » : modèles IA + frameworks
 * supportés (Server Component).
 *
 * Refonte fusion 2026-06-01 (Will) — l'ancienne version listait les modules IA
 * (chatbot RAG / search / génération), en DOUBLON avec `SitesWebModules`. Cette
 * section est recentrée « compatibilité technique » : logos des modèles IA
 * intégrés + frameworks/CMS/bases supportés. Enrichit le ratio image (logos
 * réels `public/logos/ai-tools/*.svg`) et supprime la redondance.
 *
 * Zéro JS. FR canonique — EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import Image from "next/image";
import { Section } from "@/components/layout/Section";

interface AiTool {
  readonly slug: string;
  readonly name: string;
  readonly src: string;
}

// Logos modèles & outils IA intégrés (SVG réels du repo).
const AI_TOOLS: ReadonlyArray<AiTool> = [
  { slug: "anthropic", name: "Claude (Anthropic)", src: "/logos/ai-tools/anthropic.svg" },
  { slug: "openai", name: "OpenAI", src: "/logos/ai-tools/openai.svg" },
  { slug: "mistralai", name: "Mistral AI", src: "/logos/ai-tools/mistralai.svg" },
  { slug: "googlegemini", name: "Google Gemini", src: "/logos/ai-tools/googlegemini.svg" },
  { slug: "google", name: "Google AI", src: "/logos/ai-tools/google.svg" },
  { slug: "githubcopilot", name: "GitHub Copilot", src: "/logos/ai-tools/githubcopilot.svg" },
  { slug: "github", name: "GitHub", src: "/logos/ai-tools/github.svg" },
];

// Frameworks / CMS / bases supportés — couverture sémantique large, sans tarif.
const STACKS: ReadonlyArray<string> = [
  "Next.js",
  "Astro",
  "Laravel",
  "Django",
  "Ruby on Rails",
  "Symfony",
  "Node.js",
  "Vue",
  "React",
  "Angular",
  "WordPress",
  "Webflow",
  "Shopify",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "REST / GraphQL",
];

export interface SitesWebStackAdapteeProps {
  readonly isFr: boolean;
}

export function SitesWebStackAdaptee({ isFr }: SitesWebStackAdapteeProps): ReactNode {
  return (
    <Section
      tone="paper"
      eyebrow={isFr ? "Toute stack" : "Any stack"}
      title={isFr ? "On s'intègre à votre stack," : "We integrate with your stack,"}
      titleEm={isFr ? "jamais l'inverse" : "never the other way"}
      titleTail="."
      description={
        isFr
          ? "On greffe l'IA sur votre existant ou on construit en IA-native — sur les meilleurs modèles et le framework adapté à vos objectifs. Hébergement UE, vos données, votre code."
          : "We graft AI onto your existing setup or build AI-native — on the best models and the framework that fits your goals. EU hosting, your data, your code."
      }
    >
      {/* Modèles & outils IA — logos réels */}
      <p className="text-fg-muted mb-5 text-center text-[11px] font-bold tracking-[0.18em] uppercase">
        {isFr ? "Modèles & outils IA intégrés" : "Integrated AI models & tools"}
      </p>
      <ul className="mb-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 p-0 sm:gap-x-12">
        {AI_TOOLS.map((tool) => (
          <li
            key={tool.slug}
            className="flex h-10 w-[120px] shrink-0 items-center justify-center sm:w-[136px]"
          >
            <Image
              src={tool.src}
              alt={isFr ? `Intégration ${tool.name}` : `${tool.name} integration`}
              width={136}
              height={40}
              loading="lazy"
              decoding="async"
              sizes="136px"
              className="max-h-8 max-w-[112px] object-contain opacity-70 transition-opacity duration-200 hover:opacity-100"
              data-ai-tool={tool.slug}
            />
          </li>
        ))}
      </ul>

      {/* Frameworks / CMS / bases — pills */}
      <p className="text-fg-muted mb-5 text-center text-[11px] font-bold tracking-[0.18em] uppercase">
        {isFr ? "Frameworks, CMS & bases supportés" : "Supported frameworks, CMS & databases"}
      </p>
      <ul className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2.5 p-0">
        {STACKS.map((stack) => (
          <li
            key={stack}
            className="border-border bg-bg text-fg-soft rounded-full border px-4 py-2 text-[13px] font-medium"
          >
            {stack}
          </li>
        ))}
        <li className="text-fg-muted px-2 py-2 text-[13px] italic">
          {isFr ? "… et toute API REST / GraphQL" : "… and any REST / GraphQL API"}
        </li>
      </ul>
    </Section>
  );
}
