import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { CompleterCandidatureForm } from "@/components/forms/CompleterCandidatureForm";
import { DeposerVideos } from "@/components/forms/DeposerVideos";
import { isVideoFamilyOffer } from "@/lib/careers/video-editor-offer";
import { chargerDossierComplement } from "@/features/job-application/complement";

// Compléter sa candidature en ligne (demande Will 2026-09-28).
//
// Atteinte UNIQUEMENT par le lien personnel envoyé depuis la console
// (variable `{lien_complement}`). Le candidat répond aux questions de l'offre,
// et ses réponses s'écrivent dans sa fiche.
//
// MOBILE D'ABORD (Will, même jour : « beaucoup de blabla pour pas grand-chose ») :
// pas de bandeau décoratif, un titre, une ligne, les champs. La plupart des
// candidats ouvrent le lien depuis l'e-mail, sur leur téléphone.
//
// Non indexée, rendue à la demande (le jeton est lu en base).

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ jeton?: string }>;
}

// Le gabarit du layout ajoute déjà « · Axion-IA ».
export const metadata: Metadata = {
  title: "Vos tarifs",
  robots: { index: false, follow: false },
};

export default async function CompleterCandidaturePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { jeton } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dossier = await chargerDossierComplement(jeton);

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-6 pb-12 sm:pt-10">
      {dossier.ok ? (
        <>
          <h1 className="text-fg font-serif text-3xl font-semibold">Vos tarifs</h1>
          <p className="text-fg-soft mt-1 mb-4 text-sm">
            {dossier.prenom ? `${dossier.prenom} · ` : ""}
            {dossier.poste.split(" — ")[0]}
          </p>
          <p className="border-terracotta/40 bg-terracotta-soft/30 text-fg mb-6 rounded-lg border px-3 py-2 text-sm">
            Nous comparons toutes les propositions : indiquez directement votre meilleur prix.
          </p>
          <CompleterCandidatureForm
            jeton={jeton ?? ""}
            questions={dossier.questions}
            reponses={dossier.reponses}
          />
          {/* Dépôt de vidéos (2026-09-28) : seulement pour les métiers de l'image. */}
          {isVideoFamilyOffer(dossier.offreSlug) ? <DeposerVideos jeton={jeton ?? ""} /> : null}
        </>
      ) : (
        <div role="alert" className="border-accent-red/40 bg-accent-red/10 rounded-xl border-2 p-5">
          <h1 className="text-fg text-lg font-semibold">
            {dossier.reason === "expired" ? "Ce lien a expiré." : "Ce lien n’est pas valide."}
          </h1>
          <p className="text-fg-soft mt-2 text-sm">
            Répondez directement à notre e-mail, ou écrivez à{" "}
            <a className="text-primary underline" href="mailto:contact@axion-ia.com">
              contact@axion-ia.com
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
