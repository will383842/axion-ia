// Variante TUNNEL du simulateur de gains (`/[locale]/simulateur`).
//
// Même moteur, même rapport que `/roi` — mais sans en-tête, sans pied de page,
// sans maillage interne et sans FAQ. Un visiteur venu d'une publicité a une
// seule chose à faire ici : répondre, voir son résultat, demander la suite.
//
// Tout le contenu éditorial (mode d'emploi, hypothèses détaillées, secteurs,
// villes, FAQ) reste sur `/roi`, qui est la page canonique et la seule
// indexée. Cette page-ci est `noindex` (cf. `layout.tsx`) et retirée du
// sitemap (cf. `EXCLUDED_FROM_INDEX` dans `app/sitemap.ts`).
//
// Server Component pur ; seul `SimulatorFlow` porte du JS.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { SimulatorFlow } from "@/components/roi/v2/SimulatorFlow";
import { decodeAnswers, REPORT_QUERY_PARAM, ROI_QUERY_PARAM } from "@/lib/roi/encode";
import { AUTOMATABLE_TASKS } from "@/content/roi/model/tasks";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return {
    title: isFr
      ? "Quelles tâches automatiser en premier ? · Axion-IA"
      : "Which tasks to automate first? · Axion-IA",
    description: isFr
      ? "Dix questions, un rapport nominatif : vos premières tâches à automatiser, le temps et l'argent récupérables, la feuille de route."
      : "Ten questions, a tailored report: your first tasks to automate, the time and money recoverable, the roadmap.",
    // Le layout porte déjà `noindex`. Répété ici pour que la règle survive à un
    // éventuel déplacement du fichier.
    robots: { index: false, follow: false },
  };
}

export default async function SimulateurFunnelPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const sp = await searchParams;
  const rawDiagnostic = typeof sp[ROI_QUERY_PARAM] === "string" ? sp[ROI_QUERY_PARAM] : null;
  const initialAnswers = decodeAnswers(rawDiagnostic);
  const initialShowReport = sp[REPORT_QUERY_PARAM] === "1" && initialAnswers !== null;

  return (
    <div className="axion-funnel-shell bg-canvas min-h-screen">
      <Container className="max-w-2xl py-8 sm:py-12">
        {/* En-tête minimal : la marque, rien de cliquable qui sorte du tunnel. */}
        <p className="text-terracotta-deep text-[12px] font-bold tracking-[0.16em] uppercase">
          Axion-IA · {isFr ? "Simulateur de gains" : "Gains simulator"}
        </p>
        <h1 className="text-fg mt-3 text-[28px] leading-[1.12] font-bold tracking-tight text-balance sm:text-[36px]">
          {isFr ? (
            <>
              Quelles tâches votre entreprise{" "}
              <em className="text-terracotta not-italic">doit automatiser</em> en premier ?
            </>
          ) : (
            <>
              Which tasks should your company{" "}
              <em className="text-terracotta not-italic">automate</em> first?
            </>
          )}
        </h1>
        {/* Introduction volontairement COURTE. La version longue repoussait la
            première question sous la ligne de flottaison au mobile — sur une
            page de tunnel, tout ce qui précède la première question est du
            temps pendant lequel on peut perdre le visiteur. Le détail du modèle
            est reporté sous le questionnaire, où il rassure ceux qui le
            cherchent sans retarder ceux qui veulent commencer. */}
        <p className="text-fg-soft mt-3 text-[16px] leading-relaxed text-pretty">
          {isFr
            ? "Une dizaine de questions sur vos volumes réels. Trois minutes, sans inscription."
            : "A dozen questions about your real volumes. Three minutes, no sign-up."}
        </p>

        <div className="border-border bg-paper shadow-card mt-6 rounded-3xl border p-5 sm:p-8">
          <SimulatorFlow
            locale={loc}
            initialAnswers={initialAnswers}
            initialShowReport={initialShowReport}
            funnel
          />
        </div>

        <p className="text-fg-muted mt-8 flex items-start gap-2 text-[13px] leading-relaxed">
          <ShieldCheck aria-hidden="true" className="text-terracotta-deep mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {isFr
              ? `Modèle ouvert : ${AUTOMATABLE_TASKS.length} tâches de référence, chacune avec son temps et la justification de son taux. Rien n'est transmis tant que vous ne le demandez pas.`
              : `Open model: ${AUTOMATABLE_TASKS.length} reference tasks, each with its time and the reasoning behind its rate. Nothing is transmitted unless you ask.`}
          </span>
        </p>

        <p className="text-fg-muted mt-4 text-center text-[12.5px] leading-relaxed">
          {isFr
            ? "Estimation issue d'un modèle dont les hypothèses sont publiées. Ni un devis, ni un audit, ni un engagement de résultat."
            : "Estimate from a model whose assumptions are published. Neither a quote, nor an audit, nor a performance guarantee."}
        </p>
      </Container>
    </div>
  );
}
