// Helpers JSON-LD spécifiques aux sous-pages /implementation/* (Module 3).
// Garde les page.tsx minces et garantit un HowTo cohérent sur les 9 pages
// (signal AEO : Google AI Overviews + Perplexity citent les HowTo schemas pour
// les requêtes « comment déployer / implémenter X »).

import { buildHowToJsonLd } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";

interface HowToCopy {
  title: string;
  answer: string;
  processSteps: ReadonlyArray<{ title: string; description: string }>;
}

/**
 * HowTo JSON-LD pour une sous-page implémentation, dérivé du process de la
 * page (cadrage → build → déploiement → support). `name`/`description`
 * portent le sous-service exact → différenciation par page.
 */
export function buildImplementationHowToJsonLd({
  locale,
  path,
  copy,
}: {
  locale: Locale;
  path: string;
  copy: HowToCopy;
}) {
  const isFr = locale === "fr";
  const lower = copy.title.charAt(0).toLowerCase() + copy.title.slice(1);
  return buildHowToJsonLd({
    locale,
    path,
    name: isFr ? `Déployer ${lower} avec Axion-IA` : `Deploy ${lower} with Axion-IA`,
    description: copy.answer,
    steps: copy.processSteps.map((s) => ({ name: s.title, text: s.description })),
  });
}
