import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button";
import { FormulaireRetrait } from "@/components/equipe/FormulaireRetrait";
import { retirerParLienAction } from "@/server/actions/equipe/retrait";
import { MESSAGE_NEUTRE_RETRAIT, lireLienRetrait } from "@/server/equipe/retrait/retrait";

// Page PRIVÉE, atteinte par le seul lien personnel : jamais dans le sitemap, interdite dans robots.txt,
// jamais indexée, et le jeton (dans l'adresse) ne part dans aucun en-tête Referer.
// Rendue à la demande : le jeton est lu en base.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Retirer ma page",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

interface Props {
  params: Promise<{ locale: string; jeton: string }>;
}

export default async function RetraitEquipePage({ params }: Props) {
  const { locale, jeton } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const lecture = await lireLienRetrait(jeton);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-12 sm:pt-10">
      {lecture.etat === "ok" ? (
        <>
          <h1 className="text-fg font-serif text-3xl font-semibold">Retirer ma page</h1>
          <p className="text-fg-soft mt-2 mb-6 text-sm leading-relaxed">
            Le retrait est immédiat. Vous pouvez retirer toute la page, ou seulement votre photo ou
            votre lien LinkedIn.
          </p>
          <FormulaireRetrait
            action={retirerParLienAction}
            jeton={jeton}
            classeBouton={buttonVariants()}
            peutRetirerPhoto={lecture.peutRetirerPhoto}
            peutRetirerLinkedin={lecture.peutRetirerLinkedin}
          />
        </>
      ) : (
        <div role="alert" className="border-border bg-paper rounded-lg border p-6">
          <h1 className="text-fg font-serif text-xl font-semibold">
            Ce lien n&apos;est plus valable.
          </h1>
          <p className="text-fg-soft mt-2 text-sm">{MESSAGE_NEUTRE_RETRAIT}</p>
        </div>
      )}
    </div>
  );
}
