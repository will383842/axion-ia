import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { CompleterCandidatureForm } from "@/components/forms/CompleterCandidatureForm";
import { chargerDossierComplement } from "@/features/job-application/complement";

// Compléter sa candidature en ligne (demande Will 2026-09-28).
//
// Atteinte UNIQUEMENT par le lien personnel envoyé depuis la console
// (variable `{lien_complement}`). Le candidat répond aux questions de l'offre,
// et ses réponses s'écrivent dans sa fiche : plus de réponse par e-mail à
// recopier à la main. Non indexée, rendue à la demande (le jeton est lu en base).

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ jeton?: string }>;
}

export const metadata: Metadata = {
  title: "Compléter ma candidature · Axion-IA",
  robots: { index: false, follow: false },
};

export default async function CompleterCandidaturePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { jeton } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dossier = await chargerDossierComplement(jeton);

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow="Recrutement"
        title="Compléter ma"
        titleEm="candidature"
        description={
          dossier.ok
            ? `${dossier.prenom ? `${dossier.prenom}, merci` : "Merci"} pour ta candidature « ${dossier.poste.split(" — ")[0]} ». Il nous manque quelques réponses pour comparer les propositions.`
            : undefined
        }
      />
      <Section>
        <Container className="max-w-2xl">
          {dossier.ok ? (
            <CompleterCandidatureForm
              jeton={jeton ?? ""}
              questions={dossier.questions}
              reponses={dossier.reponses}
            />
          ) : (
            <div role="alert" className="border-accent-red/40 bg-accent-red/10 rounded-xl border-2 p-5">
              <p className="text-fg text-base font-semibold">
                {dossier.reason === "expired" ? "Ce lien a expiré." : "Ce lien n’est pas valide."}
              </p>
              <p className="text-fg-soft mt-2 text-sm leading-relaxed">
                Il a peut-être été coupé par ta messagerie. Tu peux aussi répondre directement à
                notre e-mail, ou écrire à{" "}
                <a className="text-primary underline" href="mailto:contact@axion-ia.com">
                  contact@axion-ia.com
                </a>
                .
              </p>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
