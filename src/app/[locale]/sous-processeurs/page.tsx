// Page transparence sous-processeurs RGPD — Sprint X.17 / Booking V1.
//
// RGPD art. 28 — transparence vis-à-vis des sous-traitants. Liste exhaustive
// avec finalité / localisation / DPA / cadre transfert.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { SUBPROCESSORS, type Subprocessor } from "@/content/subprocessors";
import { buildProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr ? "/sous-processeurs" : "/subprocessors",
    title: isFr
      ? "Sous-processeurs · transparence RGPD · Axion-IA"
      : "Subprocessors · GDPR transparency · Axion-IA",
    description: isFr
      ? "Liste exhaustive des sous-traitants ayant accès aux données traitées par Axion-IA OÜ. Conformité RGPD art. 28."
      : "Exhaustive list of subprocessors accessing data handled by Axion-IA OÜ. GDPR art. 28 compliance.",
    alternates: { fr: "/sous-processeurs", en: "/subprocessors" },
  });
}

const LABELS_LEGAL_BASIS_FR: Record<Subprocessor["legalBasis"], string> = {
  "6.1.b_contract": "Exécution du contrat (art. 6.1.b)",
  "6.1.f_legitimate_interest": "Intérêt légitime (art. 6.1.f)",
  "6.1.a_consent": "Consentement (art. 6.1.a)",
};
const LABELS_LEGAL_BASIS_EN: Record<Subprocessor["legalBasis"], string> = {
  "6.1.b_contract": "Contract performance (art. 6.1.b)",
  "6.1.f_legitimate_interest": "Legitimate interest (art. 6.1.f)",
  "6.1.a_consent": "Consent (art. 6.1.a)",
};

const LABELS_DPA_FR: Record<Subprocessor["dpaStatus"], string> = {
  signed: "DPA signé",
  auto_signable_dashboard: "DPA auto-signable (dashboard)",
  self_hosted_no_dpa: "Auto-hébergé — pas de DPA externe",
  pending: "En cours",
};
const LABELS_DPA_EN: Record<Subprocessor["dpaStatus"], string> = {
  signed: "DPA signed",
  auto_signable_dashboard: "DPA auto-signable (dashboard)",
  self_hosted_no_dpa: "Self-hosted — no external DPA",
  pending: "Pending",
};

const LABELS_TRANSFER_FR: Record<Subprocessor["transferFramework"], string> = {
  intra_eu: "Intra-UE",
  scc: "Clauses contractuelles types (SCC)",
  adequacy_decision: "Décision d'adéquation",
  self_hosted_eu: "Auto-hébergé UE — pas de transfert",
};
const LABELS_TRANSFER_EN: Record<Subprocessor["transferFramework"], string> = {
  intra_eu: "Intra-EU",
  scc: "Standard Contractual Clauses (SCC)",
  adequacy_decision: "Adequacy decision",
  self_hosted_eu: "Self-hosted EU — no transfer",
};

export default async function SubprocessorsPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const lbLegal = isFr ? LABELS_LEGAL_BASIS_FR : LABELS_LEGAL_BASIS_EN;
  const lbDpa = isFr ? LABELS_DPA_FR : LABELS_DPA_EN;
  const lbTransfer = isFr ? LABELS_TRANSFER_FR : LABELS_TRANSFER_EN;

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            { href: "/sous-processeurs", label: isFr ? "Sous-processeurs" : "Subprocessors" },
          ]}
        />
      </Container>

      <section className="bg-halo-warm relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Container className="relative">
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Transparence RGPD · art. 28" : "GDPR transparency · art. 28"}
            </p>
            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Sous-processeurs" : "Subprocessors"}{" "}
              <span
                className="text-terracotta-deep mx-2 italic"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {isFr ? "Axion-IA OÜ" : "Axion-IA OÜ"}
              </span>
            </h1>
            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
              {isFr
                ? "Liste exhaustive et tenue à jour des sous-traitants ayant accès aux données traitées par Axion-IA OÜ dans le cadre de ses prestations. Toute évolution est notifiée par email aux clients actifs au moins 30 jours avant prise d'effet."
                : "Exhaustive and up-to-date list of subprocessors with access to data handled by Axion-IA OÜ as part of its services. Any change is notified by email to active clients at least 30 days before taking effect."}
            </p>
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container>
          <div className="space-y-6">
            {SUBPROCESSORS.map((s) => (
              <article
                key={s.name}
                className="bg-paper border-border shadow-subtle rounded-2xl border p-6 sm:p-8"
              >
                <header className="mb-4">
                  <h2 className="text-fg text-xl leading-tight font-semibold">{s.name}</h2>
                  <p className="text-fg-muted mt-1 text-sm">{s.location}</p>
                </header>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-fg-muted text-[12px] font-semibold tracking-[0.12em] uppercase">
                      {isFr ? "Finalité" : "Purpose"}
                    </dt>
                    <dd className="text-fg mt-1 text-sm leading-relaxed">
                      {isFr ? s.purposeFr : s.purposeEn}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-[12px] font-semibold tracking-[0.12em] uppercase">
                      {isFr ? "Données traitées" : "Data processed"}
                    </dt>
                    <dd className="text-fg mt-1 text-sm leading-relaxed">
                      {isFr ? s.dataCategoriesFr : s.dataCategoriesEn}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-[12px] font-semibold tracking-[0.12em] uppercase">
                      {isFr ? "Serveurs" : "Servers"}
                    </dt>
                    <dd className="text-fg mt-1 text-sm">{s.serversLocation}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-[12px] font-semibold tracking-[0.12em] uppercase">
                      {isFr ? "Base légale" : "Legal basis"}
                    </dt>
                    <dd className="text-fg mt-1 text-sm">{lbLegal[s.legalBasis]}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-[12px] font-semibold tracking-[0.12em] uppercase">
                      {isFr ? "DPA" : "DPA"}
                    </dt>
                    <dd className="text-fg mt-1 text-sm">{lbDpa[s.dpaStatus]}</dd>
                  </div>
                  <div>
                    <dt className="text-fg-muted text-[12px] font-semibold tracking-[0.12em] uppercase">
                      {isFr ? "Cadre transfert" : "Transfer framework"}
                    </dt>
                    <dd className="text-fg mt-1 text-sm">{lbTransfer[s.transferFramework]}</dd>
                  </div>
                </dl>
                {s.documentationUrl ? (
                  <p className="mt-4 text-sm">
                    <a
                      href={s.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terracotta-deep underline hover:no-underline"
                    >
                      {isFr ? "Documentation publique →" : "Public documentation →"}
                    </a>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
