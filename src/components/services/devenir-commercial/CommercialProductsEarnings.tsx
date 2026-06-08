// Server Component — ⭐ « Ce que vous vendez & ce que vous gagnez » en UN SEUL
// bloc. Tout dérivé de la SSOT (commissions + prix OFFERS). Encart de calcul
// dynamique. Icônes + accents colorés pour le contraste (pas de sombre).

import type { ReactNode } from "react";
import {
  ArrowUpRight,
  GraduationCap,
  ClipboardCheck,
  Workflow,
  UserRound,
  TrendingUp,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import {
  COMMERCIAL_COMMISSIONS,
  getCommissionById,
  formatAmount,
  type CommercialCommission,
} from "@/content/pricing";
import { getOfferById } from "@/content/offers-catalog";

export interface CommercialProductsEarningsProps {
  readonly isFr: boolean;
}

const FAMILY_LINK: Record<string, string> = {
  "com-formation-1j": "/interventions",
  "com-formation-2j": "/interventions",
  "com-formation-3j": "/interventions",
  "com-un-a-un": "/un-a-un",
  "com-audit": "/audit",
  "com-integration": "/implementation",
};

function percentExample(c: CommercialCommission, isFr: boolean): string | null {
  if (c.percent == null || !c.basisTierId) return null;
  const offer = getOfferById(c.basisTierId);
  if (!offer) return null;
  const min = offer.prixMin ?? offer.prixFlat;
  const max = offer.prixMax ?? offer.prixFlat;
  if (min == null) return null;
  const loc = isFr ? "fr" : "en";
  const cMin = Math.round((min * c.percent) / 100);
  const cMax = max != null ? Math.round((max * c.percent) / 100) : null;
  const earn =
    cMax != null && cMax !== cMin
      ? `${formatAmount(cMin, loc, { compact: true })} à ${formatAmount(cMax, loc, { compact: true })}`
      : formatAmount(cMin, loc, { compact: true });
  return isFr
    ? `Soit ${earn} sur ${offer.titre.toLowerCase()}.`
    : `That's ${earn} on ${offer.titre.toLowerCase()}.`;
}

export function CommercialProductsEarnings({ isFr }: CommercialProductsEarningsProps): ReactNode {
  const loc = isFr ? "fr" : "en";
  const flats = COMMERCIAL_COMMISSIONS.filter((c) => c.kind === "flat");
  const perFormation = getCommissionById("com-formation-1j").flatEur ?? 0;
  const scenarios = [5, 10, 20].map((n) => ({ n, total: n * perFormation }));

  const audit = COMMERCIAL_COMMISSIONS.find((c) => c.id === "com-audit");
  const integration = COMMERCIAL_COMMISSIONS.find((c) => c.id === "com-integration");

  return (
    <Section
      tone="canvas"
      eyebrow={isFr ? "Vos commissions, sans plafond" : "Your commissions, uncapped"}
      title={isFr ? "Combien" : "How much"}
      titleEm={isFr ? "vous gagnez ?" : "you earn?"}
      description={
        isFr
          ? "Pour chaque produit que vous faites connaître, vous savez exactement ce que vous touchez. Plus vous en présentez, plus vous gagnez — sans aucune limite."
          : "For each product you introduce, you know exactly what you earn. The more you present, the more you earn — with no limit."
      }
    >
      {/* FORMATIONS — commission fixe par vente (cartes phares) */}
      <div className="mb-3 flex items-center gap-2">
        <GraduationCap aria-hidden="true" className="text-terracotta h-5 w-5" />
        <h3 className="text-fg text-lg font-semibold tracking-tight">
          {isFr
            ? "Formations IA — commission fixe par vente"
            : "AI trainings — flat commission per sale"}
        </h3>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {flats.map((c) => (
          <Link
            key={c.id}
            href={(FAMILY_LINK[c.id] ?? "/interventions") as never}
            className="group border-terracotta/25 bg-halo-warm hover:border-terracotta/50 relative flex flex-col overflow-hidden rounded-2xl border-2 p-6 transition-colors"
          >
            <span aria-hidden="true" className="bg-terracotta absolute inset-x-0 top-0 h-1" />
            <span className="text-fg-soft flex items-center justify-between text-sm font-medium">
              {isFr ? c.labelFr : c.labelEn}
              <ArrowUpRight
                aria-hidden="true"
                className="text-fg-muted group-hover:text-terracotta h-4 w-4"
              />
            </span>
            <span className="text-terracotta-deep mt-3 font-mono text-4xl font-semibold tabular-nums">
              {c.flatEur != null ? formatAmount(c.flatEur, loc, { compact: true }) : "—"}
            </span>
            <span className="text-fg-muted mt-1 text-xs">
              {isFr ? "par formation vendue" : "per training sold"}
            </span>
          </Link>
        ))}
      </div>

      {/* ENCART DE CALCUL — potentiel mensuel (calculé depuis le SSOT) */}
      <div className="border-sage/30 from-sage-soft to-bg mt-6 rounded-2xl border-2 bg-gradient-to-br p-6 sm:p-8">
        <p className="text-sage-deep flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] uppercase">
          <TrendingUp aria-hidden="true" className="h-4 w-4" />
          {isFr ? "Votre potentiel" : "Your potential"}
        </p>
        <p className="text-fg mt-3 text-xl leading-snug font-semibold sm:text-2xl">
          {isFr ? (
            <>
              {scenarios[1]!.n} formations d&apos;1 jour vendues dans le mois ={" "}
              <span className="text-terracotta-deep">
                {formatAmount(scenarios[1]!.total, loc, { compact: true })}
              </span>{" "}
              de commissions.
            </>
          ) : (
            <>
              {scenarios[1]!.n} one-day trainings sold in a month ={" "}
              <span className="text-terracotta-deep">
                {formatAmount(scenarios[1]!.total, loc, { compact: true })}
              </span>{" "}
              in commissions.
            </>
          )}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {scenarios.map((s) => (
            <div key={s.n} className="bg-bg/80 border-border rounded-xl border px-4 py-3">
              <p className="text-fg-muted text-xs">
                {s.n} {isFr ? "formations 1 j / mois" : "trainings 1 d / month"}
              </p>
              <p className="text-fg font-mono text-lg font-semibold tabular-nums">
                {formatAmount(s.total, loc, { compact: true })}
              </p>
            </div>
          ))}
        </div>
        <p className="text-fg-muted mt-4 text-xs">
          {isFr
            ? "Et ce ne sont que les formations 1 jour : en y ajoutant les formats longs, les audits (30 %) et les intégrations (15 %), vos revenus n'ont aucune limite."
            : "And that's just 1-day trainings: add longer formats, audits (30%) and integrations (15%) and your income has no limit."}
        </p>
      </div>

      {/* AUDITS & INTÉGRATIONS — pourcentage de la facture */}
      <h3 className="text-fg mt-12 mb-3 text-lg font-semibold tracking-tight">
        {isFr
          ? "Audits & intégrations — % de la facture"
          : "Audits & integrations — % of the invoice"}
      </h3>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Audit (accent sage) */}
        {audit ? (
          <Link
            href="/audit"
            className="group border-sage/30 bg-bg hover:border-sage/60 flex flex-col rounded-2xl border-2 p-6 transition-colors"
          >
            <span className="bg-sage-soft text-sage flex h-11 w-11 items-center justify-center rounded-xl">
              <ClipboardCheck aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="text-fg mt-4 flex items-center justify-between text-sm font-semibold">
              {isFr ? audit.labelFr : audit.labelEn}
              <ArrowUpRight
                aria-hidden="true"
                className="text-fg-muted group-hover:text-sage h-4 w-4"
              />
            </span>
            <span className="text-sage-deep mt-2 font-mono text-3xl font-semibold tabular-nums">
              {audit.percent} %
            </span>
            <span className="text-fg-muted text-xs">
              {isFr ? "de la facture" : "of the invoice"}
            </span>
            {percentExample(audit, isFr) ? (
              <span className="text-fg-soft mt-3 text-sm leading-snug">
                {percentExample(audit, isFr)}
              </span>
            ) : null}
          </Link>
        ) : null}

        {/* Intégration (accent bleu) + upside grands projets */}
        {integration ? (
          <Link
            href="/implementation"
            className="group border-primary/25 bg-bg hover:border-primary/50 flex flex-col rounded-2xl border-2 p-6 transition-colors"
          >
            <span className="bg-primary-soft text-primary flex h-11 w-11 items-center justify-center rounded-xl">
              <Workflow aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="text-fg mt-4 flex items-center justify-between text-sm font-semibold">
              {isFr ? integration.labelFr : integration.labelEn}
              <ArrowUpRight
                aria-hidden="true"
                className="text-fg-muted group-hover:text-primary h-4 w-4"
              />
            </span>
            <span className="text-primary mt-2 font-mono text-3xl font-semibold tabular-nums">
              {integration.percent} %
            </span>
            <span className="text-fg-muted text-xs">
              {isFr ? "de la facture" : "of the invoice"}
            </span>
            {percentExample(integration, isFr) ? (
              <span className="text-fg-soft mt-3 text-sm leading-snug">
                {percentExample(integration, isFr)}
              </span>
            ) : null}
            <span className="text-fg-muted mt-1 text-xs leading-snug">
              {isFr
                ? "Les grands projets d'intégration peuvent atteindre plusieurs centaines de milliers d'euros — votre commission suit la facture."
                : "Large integration projects can reach several hundred thousand euros — your commission follows the invoice."}
            </span>
          </Link>
        ) : null}

        {/* 1-to-1 (accent mocha doux) */}
        <Link
          href="/un-a-un"
          className="group border-mocha-fg/15 bg-sand hover:border-mocha-fg/30 flex flex-col rounded-2xl border-2 p-6 transition-colors"
        >
          <span className="bg-paper text-mocha-rich flex h-11 w-11 items-center justify-center rounded-xl">
            <UserRound aria-hidden="true" className="h-6 w-6" />
          </span>
          <span className="text-fg mt-4 flex items-center justify-between text-sm font-semibold">
            {isFr ? "Accompagnement 1-to-1" : "1-on-1 support"}
            <ArrowUpRight
              aria-hidden="true"
              className="text-fg-muted group-hover:text-mocha-rich h-4 w-4"
            />
          </span>
          <span className="text-mocha-rich mt-2 font-mono text-2xl font-semibold">
            {isFr ? "Sur barème" : "On scale"}
          </span>
          <span className="text-fg-soft mt-3 text-sm leading-snug">
            {isFr ? "Détaillé après votre candidature." : "Detailed after your application."}
          </span>
        </Link>
      </div>

      <p className="text-fg-muted mt-8 text-sm">
        {isFr
          ? "Prix des prestations issus de notre grille publique unique — cliquez une carte pour voir le détail de chaque offre."
          : "Service prices come from our single public rate card — click a card to see each offer in detail."}
      </p>
    </Section>
  );
}
