import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { DepotReclamationBloc } from "@/components/qualiopi/DepotReclamationBloc";

// Chantier QNC, L09 — le dépôt en ligne d'une réclamation (indicateur 31).
//
// Page DYNAMIQUE : elle lit l'interrupteur `qualiopi.reclamations.actif` et,
// le cas échéant, le cookie de l'espace stagiaire. Éteint (défaut), elle rend
// un 404 : le site est inchangé. Non indexée : c'est un formulaire, la
// procédure indexable reste /reclamations.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Déposer une réclamation · Axion-IA",
  description:
    "Stagiaire, entreprise, formateur ou financeur : déposez une réclamation. Accusé de réception immédiat, réponse écrite sous 15 jours ouvrés.",
  robots: { index: false, follow: true },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function DeposerReclamation({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[
            { href: "/reclamations", label: "Réclamations" },
            { href: "/reclamations/deposer", label: "Déposer une réclamation" },
          ]}
        />
      </Container>
      <Container className="max-w-2xl py-10">
        <h1 className="text-mocha font-serif text-3xl font-semibold">Déposer une réclamation</h1>
        <p className="text-fg-soft mt-3 text-base leading-relaxed">
          Stagiaire, entreprise, formateur ou financeur : votre réclamation est enregistrée et
          numérotée. Vous recevez aussitôt un accusé de réception, puis une réponse écrite et signée
          de l&apos;organisme au plus tard sous 15 jours ouvrés. Un réexamen reste toujours
          possible.
        </p>
        <div className="mt-8">
          <DepotReclamationBloc />
        </div>
      </Container>
    </>
  );
}
