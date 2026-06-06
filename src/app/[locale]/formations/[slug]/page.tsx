/**
 * Fiche formation publique — indicateur Qualiopi n°1 (11 champs obligatoires).
 *
 * Déploiement phasé légal (ADR Qualiopi §4) :
 *  - Phase A (défaut) : `OF_PUBLIC_DISCLOSURE_ENABLED` absent / ≠ "true" → notFound().
 *  - Phase B : `OF_PUBLIC_DISCLOSURE_ENABLED=true` (réglé Coolify run scope) → page visible.
 *
 * Contrat build ADR 0026 : early-exit si `DATABASE_URL` contient "stub.invalid"
 * (build GitHub Actions sans DB) → notFound() sans instancier Prisma.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildCourseJsonLd, buildProductMetadata } from "@/lib/seo";
import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import { getPublicFormationBySlug } from "@/server/qualiopi/formations/formations";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { resolveOffrePriceLabel } from "@/server/qualiopi/offres/pricing-resolver";

// ── Dynamisme & ISR ──────────────────────────────────────────────────────────
// ISR `revalidate=3600` (budget Web Vitals Phase B : éviter un appel DB par requête
// → LCP). Le flag `isQualiopiPublicDisclosureEnabled()` est ré-évalué à chaque
// régénération ISR (acceptable : en Phase B le flag est activé de façon permanente ;
// au basculement Phase A→B, la page se rouvre sous ≤1h). dynamicParams=true permet
// les slugs non pré-rendus (générés à la demande puis cachés). [T17.1 — S9]
export const revalidate = 3600;
export const dynamicParams = true;

// ── Params pré-rendus ────────────────────────────────────────────────────────
export async function generateStaticParams() {
  // Contrat build ADR 0026 — stub.invalid sans DB → aucune route SSG.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  // Phase A légale — pas de divulgation publique → aucune route SSG.
  if (!isQualiopiPublicDisclosureEnabled()) return [];
  // Phase B — laisser ISR gérer les slugs dynamiquement (retourner [] ici
  // n'empêche pas le rendu dynamique grâce à dynamicParams=true).
  return [];
}

// ── Metadata ─────────────────────────────────────────────────────────────────
interface PageParams {
  locale: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;

  // Même garde que la page — pas de metadata si phase A.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return {};
  if (!isQualiopiPublicDisclosureEnabled()) return {};
  if (!hasLocale(routing.locales, locale)) return {};

  const f = await getPublicFormationBySlug(slug);
  if (!f) return {};

  const loc = locale as Locale;
  const title = `${f.titre} — Formation IA · Axion-IA`;
  const description =
    `Formation professionnelle continue dispensée par Axion-IA — ${f.dureeHeures} h, ` +
    `${f.modalite === "presentiel" ? "présentiel" : f.modalite === "distanciel" ? "distanciel" : "hybride"}. ` +
    `Exonérée de TVA (art. 261-4-4° CGI).`;

  return buildProductMetadata({
    locale: loc,
    path: `/formations/${slug}`,
    title,
    description,
  });
}

// ── Helpers d'affichage ──────────────────────────────────────────────────────

/** Libellé modalité de formation (indicateur 1 — modalités). */
function modaliteLabel(modalite: "presentiel" | "distanciel" | "hybride"): string {
  const MAP: Record<typeof modalite, string> = {
    presentiel: "Présentiel (sur site)",
    distanciel: "À distance (FOAD)",
    hybride: "Hybride (présentiel + distanciel)",
  };
  return MAP[modalite] ?? modalite;
}

/** Durée ISO 8601 pour JSON-LD Course (ex. 14 h → "PT14H"). */
function iso8601Duration(heures: number): string {
  return `PT${heures}H`;
}

// ── Types défensifs pour champs Json Prisma ──────────────────────────────────

// objectifsPedagogiques — peut être string[] ou { verbe?; description? }[]
type ObjectifItem = string | { verbe?: string; description?: string };

// indicateursPublies — tableau d'indicateurs de résultats publiés (off.1/2)
type IndicateurPublie = {
  libelle: string;
  valeur: number;
  unite: string;
  annee: number;
};

function renderObjectif(item: ObjectifItem, idx: number): React.ReactNode {
  if (typeof item === "string") {
    return (
      <li key={idx} className="text-fg-soft flex items-start gap-2.5 text-[15px] leading-relaxed">
        <span
          aria-hidden="true"
          className="bg-terracotta mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        />
        <span>{item}</span>
      </li>
    );
  }
  return (
    <li key={idx} className="text-fg-soft flex items-start gap-2.5 text-[15px] leading-relaxed">
      <span
        aria-hidden="true"
        className="bg-terracotta mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      />
      <span>
        {item.verbe ? <strong className="text-fg font-semibold">{item.verbe} </strong> : null}
        {item.description ?? ""}
      </span>
    </li>
  );
}

// ── Section UI helper ─────────────────────────────────────────────────────────
function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border rounded-2xl border bg-white p-6 sm:p-8">
      <h2 className="text-fg mb-4 text-lg leading-tight font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function FormationSlugPage({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params;

  // Contrat build ADR 0026 — stub.invalid → notFound() immédiat.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    notFound();
  }

  // Garde légale phase A — illégal d'afficher Qualiopi avant certification.
  if (!isQualiopiPublicDisclosureEnabled()) {
    notFound();
  }

  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const f = await getPublicFormationBySlug(slug);
  if (!f) notFound();

  const prixLabel = resolveOffrePriceLabel(f.offreSite.tierId, locale === "en" ? "en" : "fr");

  // Modalités : fusion modalite Formation + modalites[] OffreSite.
  const modalitesOffreSite: string[] = Array.isArray(f.offreSite.modalites)
    ? f.offreSite.modalites
    : [];
  const modalitesDisplay =
    modalitesOffreSite.length > 0 ? modalitesOffreSite.join(", ") : modaliteLabel(f.modalite);

  // Objectifs pédagogiques (Json → tableau défensif).
  const objectifs: ObjectifItem[] = Array.isArray(f.objectifsPedagogiques)
    ? (f.objectifsPedagogiques as ObjectifItem[])
    : [];

  // Indicateurs de résultats publiés (off.1/2 Qualiopi — Json → tableau défensif).
  const indicateursPublies: IndicateurPublie[] = Array.isArray(f.indicateursPublies)
    ? (f.indicateursPublies as IndicateurPublie[])
    : [];

  // JSON-LD Course (indicateur 1 + AEO Google AI Overviews).
  const courseJsonLd = buildCourseJsonLd({
    locale,
    path: `/formations/${slug}`,
    name: f.titre,
    description: f.offreSite.promessePrincipaleFr,
    courseMode:
      f.modalite === "presentiel"
        ? ["Onsite"]
        : f.modalite === "distanciel"
          ? ["Online"]
          : ["Onsite", "Online"],
    duration: iso8601Duration(f.dureeHeures),
    audienceType: f.offreSite.publicViseFr,
    about: "Formation professionnelle IA opérationnelle — Axion-IA",
  });

  return (
    <>
      <JsonLd data={courseJsonLd} />

      {/* ── Hero fiche formation ──────────────────────────────────────── */}
      <section className="bg-paper border-border border-b py-14 sm:py-18">
        <Container>
          <div className="max-w-3xl">
            {/* Breadcrumb léger — A4 : /formations n'existe pas → niveau retiré */}
            <nav aria-label="Fil d'Ariane" className="mb-6">
              <ol className="text-fg-muted flex items-center gap-1.5 text-sm">
                <li>
                  <a href={`/${locale}`} className="hover:text-terracotta transition-colors">
                    Accueil
                  </a>
                </li>
                <li aria-hidden="true" className="text-fg-muted">
                  /
                </li>
                <li
                  aria-current="page"
                  className="text-fg max-w-[200px] truncate font-medium sm:max-w-none"
                >
                  {f.titre}
                </li>
              </ol>
            </nav>

            {/* Numéro + badges */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="bg-terracotta-soft text-terracotta-deep rounded-full px-3 py-1 text-[12px] font-semibold">
                {f.numero}
              </span>
              <span className="bg-sage-soft text-sage rounded-full px-3 py-1 text-[12px] font-semibold">
                {modaliteLabel(f.modalite)}
              </span>
              <span className="border-border text-fg-muted rounded-full border px-3 py-1 text-[12px] font-semibold">
                {f.dureeHeures} h
              </span>
            </div>

            {/* Titre principal (indicateur 1 — intitulé) */}
            <h1
              className="text-fg text-[clamp(2rem,4vw,3rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {f.titre}
            </h1>

            {/* Promesse principale */}
            <p className="text-fg-soft mt-5 text-lg leading-relaxed">
              {f.offreSite.promessePrincipaleFr}
            </p>

            {/* Prix + exonération TVA */}
            <div className="border-border mt-8 flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-5 sm:gap-6">
              <div>
                <p className="text-fg-muted mb-0.5 text-[11px] font-semibold tracking-wide uppercase">
                  Tarif
                </p>
                <p className="text-fg text-2xl font-semibold">{prixLabel}</p>
              </div>
              <div className="border-border hidden h-10 border-l sm:block" />
              <p className="text-fg-muted text-sm leading-snug">
                {LEGAL_MENTIONS.factureExonerationTva}
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Corps de la fiche — 11 champs indicateur 1 ────────────────── */}
      <section className="bg-sand py-14 sm:py-18">
        <Container>
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {/* Colonne principale : 2/3 */}
            <div className="space-y-5 lg:col-span-2">
              {/* 1. Objectifs pédagogiques */}
              <SectionBlock title="Objectifs pédagogiques">
                {objectifs.length > 0 ? (
                  <ul className="space-y-2.5">
                    {objectifs.map((obj, idx) => renderObjectif(obj, idx))}
                  </ul>
                ) : (
                  <p className="text-fg-soft text-[15px]">
                    Les objectifs pédagogiques sont en cours de rédaction.
                  </p>
                )}
              </SectionBlock>

              {/* 2. Modalités d&apos;évaluation */}
              <SectionBlock title="Modalités d'évaluation">
                <p className="text-fg-soft text-[15px] leading-relaxed">
                  L&apos;acquisition des compétences est évaluée tout au long de la formation par
                  des exercices pratiques et une évaluation formative continue. Un quiz de
                  positionnement est réalisé en amont. Une évaluation à chaud est conduite à
                  l&apos;issue de la formation.
                </p>
                <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">
                  Une <strong className="text-fg font-semibold">attestation de formation</strong>{" "}
                  est délivrée à l&apos;issue du parcours. {LEGAL_MENTIONS.attestation}
                </p>
                <p className="text-fg-muted mt-3 text-[13px] leading-snug">
                  Seuil de réussite : {f.seuilReussitePct} %
                  {f.ratioPratiquePct != null
                    ? ` · Ratio pratique : ${f.ratioPratiquePct} %`
                    : null}
                </p>
              </SectionBlock>

              {/* 3. Accessibilité handicap */}
              <SectionBlock title="Accessibilité et handicap">
                <p className="text-fg-soft text-[15px] leading-relaxed">
                  Axion-IA s&apos;engage à rendre ses formations accessibles aux personnes en
                  situation de handicap. Un{" "}
                  <strong className="text-fg font-semibold">référent handicap</strong> est désigné
                  au sein de l&apos;organisme pour étudier toute demande d&apos;adaptation
                  pédagogique ou technique. {LEGAL_MENTIONS.referentHandicap}
                </p>
                <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">
                  Pour toute demande d&apos;adaptation, contactez-nous avant l&apos;inscription afin
                  d&apos;étudier ensemble les aménagements possibles.
                </p>
                {f.accessibleHandicap ? (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-[12px] font-semibold text-green-700">
                    ● Accessible
                  </span>
                ) : null}
              </SectionBlock>

              {/* 4. Indicateurs de résultats (off.1/2 Qualiopi) */}
              <SectionBlock title="Indicateurs de résultats">
                {indicateursPublies.length > 0 ? (
                  <>
                    <ul className="divide-border divide-y">
                      {indicateursPublies.map((ind, idx) => (
                        <li key={idx} className="flex items-center justify-between py-2.5">
                          <span className="text-fg-soft text-[15px]">{ind.libelle}</span>
                          <span className="text-fg font-semibold tabular-nums">
                            {ind.valeur}
                            {ind.unite ? <>&nbsp;{ind.unite}</> : null}
                            <span className="text-fg-muted ml-1 text-[11px] font-normal">
                              ({ind.annee})
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    {f.methodeCalculIndicateurs ? (
                      <p className="text-fg-muted mt-3 text-[12px] leading-snug">
                        Méthode de calcul : {f.methodeCalculIndicateurs}
                      </p>
                    ) : null}
                    {f.indicateursPubliesAt ? (
                      <p className="text-fg-muted mt-1 text-[11px]">
                        Dernière mise à jour :{" "}
                        {new Date(f.indicateursPubliesAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="text-fg-soft text-[15px] leading-relaxed">
                      Les indicateurs de résultats (taux de satisfaction, taux de réalisation, taux
                      d&apos;insertion professionnelle) sont en cours de constitution sur la base
                      des premières sessions réalisées.
                    </p>
                    <p className="text-fg-muted mt-2 text-[12px]">
                      Mise à jour prévue au fil des sessions — affichage automatique dès que les
                      données sont disponibles.
                    </p>
                  </>
                )}
              </SectionBlock>
            </div>

            {/* Colonne latérale : 1/3 — informations pratiques */}
            <aside className="space-y-5">
              {/* 5. Public visé */}
              <SectionBlock title="Public visé">
                <p className="text-fg-soft text-[15px] leading-relaxed">
                  {f.offreSite.publicViseFr}
                </p>
              </SectionBlock>

              {/* 6. Prérequis */}
              <SectionBlock title="Prérequis">
                <p className="text-fg-soft text-[15px] leading-relaxed">
                  Aucun prérequis technique n&apos;est exigé. Une utilisation courante d&apos;un
                  ordinateur est suffisante.
                </p>
              </SectionBlock>

              {/* 7. Durée */}
              <SectionBlock title="Durée">
                <p className="text-fg text-3xl font-semibold tabular-nums">{f.dureeHeures} h</p>
                <p className="text-fg-muted mt-1 text-[13px]">
                  heure{f.dureeHeures > 1 ? "s" : ""} de formation
                </p>
              </SectionBlock>

              {/* 8. Modalités (pédagogiques + lieu) */}
              <SectionBlock title="Modalités">
                <p className="text-fg-soft text-[15px] leading-relaxed">{modalitesDisplay}</p>
                <p className="text-fg-muted mt-2 text-[13px] leading-snug">
                  {f.offreSite.anglePedagogiqueFr}
                </p>
              </SectionBlock>

              {/* 9. Délai d&apos;accès */}
              <SectionBlock title="Délai d'accès">
                <p className="text-fg-soft text-[15px] leading-relaxed">
                  Nous consulter — sous 11 jours ouvrés minimum à compter de la confirmation
                  d&apos;inscription et de la réception du règlement ou de la prise en charge
                  financeur.
                </p>
              </SectionBlock>

              {/* 10. Tarif + exonération TVA (rappel latéral) */}
              <SectionBlock title="Tarif">
                <p className="text-fg text-2xl font-semibold">{prixLabel}</p>
                <p className="text-fg-muted mt-1 text-[12px] leading-snug">
                  {LEGAL_MENTIONS.factureExonerationTva}
                </p>
              </SectionBlock>

              {/* 11. Contact / inscription */}
              <div className="bg-terracotta rounded-2xl p-6">
                <p className="text-paper mb-3 font-semibold">Intéressé·e par cette formation ?</p>
                <a
                  href={`/${locale}/appel`}
                  className="bg-paper text-terracotta hover:bg-paper/90 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-[14px] font-semibold transition-colors"
                >
                  Réserver un appel
                </a>
                <a
                  href={`/${locale}/contact`}
                  className="text-paper/85 hover:text-paper mt-2 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-[14px] font-medium transition-colors"
                >
                  Nous écrire
                </a>
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
