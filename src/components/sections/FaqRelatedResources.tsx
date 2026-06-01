// Server Component — bloc « Pour aller plus loin » des pages FAQ.
// Maillage interne contextuel curé par catégorie (cf. `content/faq-resources.ts`).
// 100 % server-rendered → 0 KB JS client (budget Web Vitals 2026).

import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { getFaqResources } from "@/content/faq-resources";

interface Props {
  /** Slug de catégorie FAQ (enum FAQCategory ; fallback `general`). */
  readonly category: string;
  readonly locale: string;
  readonly isFr: boolean;
}

export function FaqRelatedResources({ category, locale, isFr }: Props): ReactNode {
  const links = getFaqResources(category);
  if (links.length === 0) return null;

  return (
    <section
      aria-label={isFr ? "Pour aller plus loin" : "Go further"}
      className="border-border border-t py-14 sm:py-16"
    >
      <Container className="max-w-3xl">
        <p className="text-fg-muted mb-1 text-[13px] font-medium tracking-[0.16em] uppercase">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "Pour aller plus loin" : "Go further"}
        </p>
        <h2 className="text-fg mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
          {isFr ? "Ressources liées" : "Related resources"}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={`/${locale}${link.href}`}
                className="border-border bg-paper hover:border-terracotta/60 hover:shadow-subtle group flex h-full items-start gap-3 rounded-xl border p-4 transition"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-fg group-hover:text-terracotta-deep block text-base font-medium transition">
                    {isFr ? link.labelFr : link.labelEn}
                  </span>
                  <span className="text-fg-soft mt-1 block text-sm leading-snug">
                    {isFr ? link.descFr : link.descEn}
                  </span>
                </span>
                <ArrowUpRight
                  className="text-fg-muted group-hover:text-terracotta mt-0.5 h-4 w-4 shrink-0 transition"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
