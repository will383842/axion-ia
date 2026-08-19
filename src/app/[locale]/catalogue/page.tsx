// Page d'atterrissage du catalogue imprimé (2026-08-15).
//
// Elle existe pour UNE raison : le QR code imprimé en page 03 du catalogue
// papier, et l'URL courte `axion-ia.com/catalogue` imprimée juste en dessous.
// Les deux sont sur du papier distribué en main propre — l'URL et le chemin des
// deux fichiers statiques ne doivent JAMAIS changer.
//
// Server Component pur, aucun JS client : la page est ouverte au téléphone, en
// clientèle, souvent sur un réseau médiocre. Deux sorties seulement — feuilleter
// (HTML autonome, 4 Mo) ou télécharger (PDF, 8 Mo) — servies en statique depuis
// `public/catalogue/`, donc par le CDN et non par le serveur Next.
//
// ⚠️ AUCUNE mention Qualiopi ici : son affichage public est gaté par
// `OF_PUBLIC_DISCLOSURE_ENABLED` (cf. server/qualiopi/config/flag.ts) et cette
// page n'a pas à porter ce risque. AUCUNE mention CPF (verrou doctrinal).
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { BookOpen, Download } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

const PATH = "/catalogue";

// Les deux fichiers sont statiques et versionnés dans `public/` : rien à
// revalider côté serveur, mais on garde l'ISR par cohérence avec le reste.
const HTML_FEUILLETER = "/catalogue/index.html";
const PDF_TELECHARGER = "/catalogue/catalogue-axion-ia.pdf";

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const title = isFr ? "Catalogue des offres Axion-IA" : "Axion-IA offering catalogue";
  const description = isFr
    ? "Feuilletez le catalogue complet des offres Axion-IA : formations IA, coaching individuel, audits et implémentations. Une double page par offre — le programme réel, les acquis, la durée et le prix. À consulter en ligne ou à télécharger en PDF."
    : "Browse the complete Axion-IA catalogue: AI training, one-to-one coaching, audits and implementations. One double page per offering — the real programme, the learning outcomes, the duration and the price. Read online or download as PDF.";
  return {
    ...(await buildProductMetadata({ locale, path: PATH, title, description })),
    title: { absolute: `${title} · Axion-IA` },
  };
}

export default async function CataloguePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  return (
    // GEO-123 (audit GEO/AEO 2026-08-14) — conteneur de mise en page, pas un
    // `<main>` : le layout `[locale]` en porte deja un, et deux `<main>`
    // imbriques rendent le contenu principal non identifiable.
    <div className="py-10 sm:py-14">
      <Container>
        <Breadcrumbs items={[{ label: isFr ? "Catalogue" : "Catalogue", href: PATH }]} />

        <p className="text-terracotta mt-8 text-xs font-semibold tracking-[0.14em] uppercase">
          {isFr ? "Le catalogue en ligne" : "The online catalogue"}
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl leading-tight font-black text-balance sm:text-4xl">
          {isFr
            ? "Toutes nos offres, une double page chacune."
            : "Every offering, one double page each."}
        </h1>
        <p className="text-fg-soft mt-4 max-w-2xl text-base leading-relaxed">
          {isFr
            ? "Formations IA, coaching individuel, audits et implémentations : pour chaque offre, le programme réel, ce que vous en repartez avec, la durée et le prix. Vous pouvez le consulter ici ou le transmettre à qui de droit d'un simple lien."
            : "AI training, one-to-one coaching, audits and implementations: for each offering, the real programme, what you walk away with, the duration and the price. Read it here or pass it on with a single link."}
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Cta href={HTML_FEUILLETER} external size="xl" track="catalogue-feuilleter">
            <BookOpen aria-hidden className="h-5 w-5" />
            {isFr ? "Feuilleter le catalogue" : "Browse the catalogue"}
          </Cta>
          <Cta
            href={PDF_TELECHARGER}
            external
            variant="outline"
            size="xl"
            track="catalogue-telecharger"
          >
            <Download aria-hidden className="h-5 w-5" />
            {isFr ? "Télécharger le PDF" : "Download the PDF"}
          </Cta>
        </div>

        <p className="text-fg-muted mt-4 text-sm">
          {isFr
            ? "Le PDF pèse environ 8 Mo — préférez le Wi-Fi si vous êtes en déplacement."
            : "The PDF is around 8 MB — prefer Wi-Fi if you are on the move."}
        </p>
      </Container>
    </div>
  );
}
