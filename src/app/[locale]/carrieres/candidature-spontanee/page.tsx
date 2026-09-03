// Page candidature SPONTANÉE /carrieres/candidature-spontanee.
//
// 🔴 POURQUOI CETTE PAGE EXISTE, ET CE QU'ELLE REMPLACE.
//
// « Candidature spontanée » était affichée à trois endroits de `/carrieres` —
// le bandeau, l'état vide (« Pas d'offre ouverte en ce moment ») et la FAQ — et
// les trois pointaient vers `/contact`. Une candidature spontanée devenait donc
// une `Submission` du formulaire de contact : sans CV, sans photo, sans
// journal, sans entretien, sans décision, sans motif, sans export, et
// INVISIBLE dans les écrans de recrutement. Le message Telegram annonçait
// pourtant « Candidature spontanée » — pour un dossier qui n'existait nulle
// part dans la console.
//
// 🔑 Elle produit désormais une vraie `JobApplication`, avec tout le parcours.
// C'est la migration `20260904010000_candidature_sans_offre` qui l'a rendue
// possible : `offerId` est nullable, et `offerTitleSnap` — NOT NULL — porte le
// poste visé saisi par la personne.
//
// ⚠️ Les trois liens vers `/contact` ne sont PAS rebranchés ici : fermer cette
// porte-là est l'arbitrage 3 de l'ADR 0047, et il appartient à Will. Cette page
// est purement ADDITIVE — aucun chemin existant ne change de comportement.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { JobApplicationForm } from "@/components/forms/JobApplicationForm";

// Même cadence que `[slug]/postuler` : la page est statique, seul le formulaire
// est vivant.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const base = await buildProductMetadata({
    locale: locale as Locale,
    path: "/carrieres/candidature-spontanee",
    title: isFr ? "Candidature spontanée · Axion-IA.com" : "Open application · Axion-IA.com",
    description: isFr
      ? "Aucune offre ne correspond ? Dites-nous ce que vous cherchez — CV optionnel."
      : "No role matches? Tell us what you're looking for — CV optional.",
  });
  // `noindex, follow` — même règle que la page de candidature à une offre : un
  // formulaire n'a rien à faire dans l'index, mais ses liens restent suivis.
  return { ...base, robots: { index: false, follow: true } };
}

export default async function CandidatureSpontaneePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  return (
    <Section tone="halo-cool">
      <Container>
        <Breadcrumbs
          items={[
            { href: "/carrieres", label: isFr ? "Carrières" : "Careers" },
            {
              href: "/carrieres/candidature-spontanee",
              label: isFr ? "Candidature spontanée" : "Open application",
            },
          ]}
        />

        <div className="mx-auto mt-8 max-w-2xl text-center">
          <p className="text-terracotta text-sm font-semibold tracking-wide uppercase">
            {isFr ? "On lit tout 👀" : "We read everything 👀"}
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold sm:text-5xl">
            {isFr ? (
              <>
                Aucune offre ne <em className="text-terracotta italic">correspond</em> ?
              </>
            ) : (
              <>
                No role <em className="text-terracotta italic">matches</em> ?
              </>
            )}
          </h1>
          <p className="text-fg-muted mt-4 text-lg">
            {isFr
              ? "Dites-nous ce que vous cherchez. On garde votre dossier et on revient vers vous dès qu'un poste s'ouvre."
              : "Tell us what you're looking for. We keep your file and get back to you as soon as a role opens."}
          </p>
          <ul className="text-fg-muted mt-5 flex flex-wrap justify-center gap-2 text-sm">
            {(isFr
              ? ["📄 CV optionnel", "🎯 Poste libre", "🙌 Process simple", "🔒 Données protégées"]
              : ["📄 CV optional", "🎯 Any role", "🙌 Simple process", "🔒 Data protected"]
            ).map((chip) => (
              <li key={chip} className="border-border bg-paper rounded-full border px-3 py-1">
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-border bg-paper shadow-card mx-auto mt-8 max-w-2xl rounded-3xl border p-6 sm:p-9">
          {/* Aucun `offerId` : le formulaire affiche alors son champ « poste
              visé », qui alimente `offerTitleSnap`. Aucune question de
              présélection non plus — elles appartiennent à une offre. */}
          <JobApplicationForm
            requiresDriverLicense={false}
            requiresVehicle={false}
            screeningQuestions={[]}
          />
        </div>
      </Container>
    </Section>
  );
}
