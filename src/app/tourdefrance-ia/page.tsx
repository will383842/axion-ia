// `/tourdefrance-ia` — la landing du Tour de France IA (2026-10-25).
//
// Tunnel : post réseau (UTM) → cette page → « Je veux le Tour dans mon
// entreprise » → `/fr/appel/tour-de-france-ia` (la visio, type `tour` de
// `types-reservables.ts`) → confirmation → fiche prospect dans la console.
//
// Composants SERVEUR seulement, sauf `PiloteCta` (bouton collant + recopie des
// `utm_*`). Aucun composant d'en-tête ou de pied de page d'Axion, aucun
// next-intl, aucun script tiers. Tout le texte vit dans `contenu.ts`.
//
// 🔑 Fermé (`TOUR_PUBLIC` faux) : la page appelle `connection()` — rendu à la
// requête, jamais prérendu ni mis en cache. Ouvert : seul l'interrupteur
// change, et la page redevient statique.

import type { Metadata } from "next";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JsonLd } from "@/components/marketing/JsonLd";
import { TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";

import {
  APPEL_FINAL,
  BENEFICES,
  DEFINITION,
  ETAPES,
  FAQ,
  FONDATEUR,
  HEROS,
  JOURNEE,
  LIBELLE_CTA,
  META,
  MICRO_TEXTE_CTA,
  NOM_DU_TOUR,
  PIED,
  POUR_QUI,
  lienRendezVous,
} from "./contenu";
import { jsonLdDuTour } from "./jsonld";
import { Coche, TraceHeros } from "./_composants/Visuels";
import { PiloteCta } from "./_composants/PiloteCta";
import styles from "./tour.module.css";

// Relative : résolue contre le `metadataBase` du layout (production, jamais localhost).
const URL_CANONIQUE = META.chemin;

export const metadata: Metadata = {
  title: { absolute: META.titre },
  description: META.description,
  // Pas de `languages` : la page n'existe qu'en français (aucun hreflang).
  alternates: { canonical: URL_CANONIQUE },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: URL_CANONIQUE,
    siteName: "Axion-IA",
    title: META.titre,
    description: META.description,
  },
  // Images : convention de fichier (`opengraph-image.jpg`, `twitter-image.jpg`).
  twitter: {
    card: "summary_large_image",
    title: META.titre,
    description: META.description,
  },
};

const CONTENEUR = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const REPERE = "font-mono text-sm tracking-[0.08em] text-fg-muted uppercase";
const TITRE_SECTION = "font-serif text-3xl leading-tight font-medium text-fg sm:text-4xl";
const ID_CTA_HEROS = "tdf-cta-heros";
const ID_CTA_COLLANT = "tdf-cta-collant";

/** Le bouton principal : pilule bleue, 48 px de haut, libellé unique. */
function BoutonRendezVous({ depuis, id }: { depuis: string; id?: string }) {
  return (
    <Button
      asChild
      variant="primary"
      size="lg"
      shape="pill"
      className="h-auto min-h-12 py-3 text-center whitespace-normal"
    >
      <a href={lienRendezVous(depuis)} id={id} data-tdf-cta="">
        {LIBELLE_CTA}
      </a>
    </Button>
  );
}

export default async function TourDeFranceIaPage() {
  if (!TOUR_PUBLIC) await connection();

  return (
    <>
      <JsonLd data={jsonLdDuTour()} />

      {/* 0. Bandeau minimal */}
      <header className="border-border bg-bg border-b">
        <div className={`${CONTENEUR} flex min-h-16 items-center justify-between gap-4`}>
          <p className="text-fg font-serif text-lg font-medium sm:text-xl">{NOM_DU_TOUR}</p>
          <a
            href={lienRendezVous("tdf-bandeau")}
            data-tdf-cta=""
            className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-primary inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Participer
          </a>
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        {/* 1. Héros */}
        <section className={`${CONTENEUR} pt-6 sm:pt-10`} aria-labelledby="tdf-titre">
          <div className="border-border bg-paper rounded-2xl border px-5 py-10 sm:px-10 sm:py-14 lg:grid lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-10 lg:px-14 lg:py-16">
            <div>
              <p className={REPERE}>{HEROS.surtitre}</p>
              <h1
                id="tdf-titre"
                className="text-fg mt-5 font-serif text-[2.5rem] leading-[1.05] font-medium tracking-tight sm:text-6xl"
              >
                {HEROS.titreAvant}
                <span className="text-terracotta not-italic">{HEROS.titreAccent}</span>
                {HEROS.titreApres}
              </h1>
              <p className="text-fg mt-6 max-w-xl font-serif text-2xl leading-snug font-medium sm:text-3xl">
                {HEROS.sousTitre}
              </p>
              <p className="text-fg-soft mt-4 max-w-xl text-base leading-relaxed">
                {HEROS.condition}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:items-start">
                <BoutonRendezVous depuis="tdf-heros" id={ID_CTA_HEROS} />
                <p className="text-fg-muted text-sm">{MICRO_TEXTE_CTA}</p>
              </div>
            </div>
            <div className="mt-10 lg:mt-0">
              <TraceHeros className="h-auto w-full max-w-[440px] lg:ml-auto" />
            </div>
          </div>

          {/* 2. Définition citable, en texte visible */}
          <p className="text-fg-soft mx-auto mt-8 max-w-3xl text-base leading-relaxed sm:text-lg">
            {DEFINITION}
          </p>
        </section>

        {/* 3. Votre journée */}
        <section className={`${CONTENEUR} mt-20 sm:mt-28`} aria-labelledby="tdf-journee">
          <h2 id="tdf-journee" className={TITRE_SECTION}>
            {JOURNEE.titre}
          </h2>
          <ol className="border-border bg-paper mt-10 grid overflow-hidden rounded-xl border md:grid-cols-3">
            {JOURNEE.moments.map((m, i) => (
              <li
                key={m.moment}
                className={`flex flex-col gap-3 p-6 sm:p-8 ${i > 0 ? "border-border border-t md:border-t-0 md:border-l" : ""} ${i === 2 ? "bg-sand" : ""}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <p className={REPERE}>{m.moment}</p>
                  <p className="text-terracotta font-mono text-sm">{m.duree}</p>
                </div>
                <h3 className="text-fg font-serif text-2xl leading-snug font-medium">{m.titre}</h3>
                <p className="text-fg-soft">{m.texte}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 4. Comment ça marche — 4 étapes reliées par le tracé */}
        <section className={`${CONTENEUR} mt-20 sm:mt-28`} aria-labelledby="tdf-etapes">
          <h2 id="tdf-etapes" className={TITRE_SECTION}>
            {ETAPES.titre}
          </h2>
          <ol className={`${styles.parcours} mt-10 grid gap-10 lg:grid-cols-4 lg:gap-8`}>
            {ETAPES.liste.map((etape, i) => (
              <li key={etape} className="relative min-h-11 pl-16 lg:pt-16 lg:pl-0">
                <span
                  aria-hidden="true"
                  className={`absolute top-0 left-0 z-[1] grid h-11 w-11 place-items-center rounded-full border-[1.5px] font-mono text-[0.95rem] ${i === ETAPES.liste.length - 1 ? "border-terracotta bg-terracotta text-white" : "border-fg bg-bg text-ink"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-fg pt-2 text-lg leading-snug font-semibold lg:pt-0">{etape}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 5. Pour qui */}
        <section className={`${CONTENEUR} mt-20 sm:mt-28`} aria-labelledby="tdf-pour-qui">
          <div className="border-border-strong grid gap-6 border-t pt-10 lg:grid-cols-[1fr_2fr] lg:gap-12">
            <h2 id="tdf-pour-qui" className={TITRE_SECTION}>
              {POUR_QUI.titre}
            </h2>
            <div>
              <p className="text-fg font-serif text-2xl leading-snug sm:text-3xl">
                {POUR_QUI.phrase}
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {POUR_QUI.secteurs.map((s) => (
                  <li
                    key={s}
                    className="border-border bg-paper text-fg-soft rounded-full border px-4 py-2 text-sm"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 6. Ce que vous en retirez — sans promesse chiffrée */}
        <section className={`${CONTENEUR} mt-20 sm:mt-28`} aria-labelledby="tdf-benefices">
          <h2 id="tdf-benefices" className={TITRE_SECTION}>
            {BENEFICES.titre}
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {BENEFICES.liste.map((b) => (
              <li key={b}>
                <Card className="flex h-full items-start gap-4 p-6">
                  <Coche className="mt-0.5 shrink-0" />
                  <p className="text-fg text-lg">{b}</p>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted mt-4 text-sm">{BENEFICES.mention}</p>
        </section>

        {/* 7. Fondateur — sans photo */}
        <section className={`${CONTENEUR} mt-20 sm:mt-28`} aria-labelledby="tdf-fondateur">
          <div className="border-border-strong grid gap-6 border-t pt-10 lg:grid-cols-[1fr_2fr] lg:gap-12">
            <h2 id="tdf-fondateur" className={TITRE_SECTION}>
              {FONDATEUR.titre}
            </h2>
            <div className="text-fg-soft space-y-3 text-lg">
              <p className="text-fg">{FONDATEUR.ligne1}</p>
              <p>{FONDATEUR.ligne2}</p>
              <p>
                <a
                  href={FONDATEUR.chemin}
                  className="text-fg decoration-border-strong hover:decoration-terracotta inline-flex min-h-11 items-center underline decoration-1 underline-offset-4"
                >
                  {FONDATEUR.lien}
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* 8. Questions fréquentes (FAQPage dans le JSON-LD) */}
        <section className={`${CONTENEUR} mt-20 sm:mt-28`} aria-labelledby="tdf-faq">
          <h2 id="tdf-faq" className={TITRE_SECTION}>
            {FAQ.titre}
          </h2>
          <div className="divide-border border-border mt-10 divide-y border-y">
            {FAQ.questions.map((q) => (
              <div key={q.question} className="py-6">
                <h3 className="text-fg font-serif text-xl leading-snug font-medium">
                  {q.question}
                </h3>
                <p className="text-fg-soft mt-2 text-base leading-relaxed">{q.reponse}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 9. Appel final — bande sombre, accent lisible sur mocha */}
        <section className={`${CONTENEUR} mt-20 sm:mt-28`} aria-labelledby="tdf-appel-final">
          <div className="bg-mocha text-mocha-fg flex flex-col items-start gap-8 rounded-2xl px-6 py-12 sm:px-12 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Coche taille={32} surSombre className="mt-1 shrink-0" />
              <h2
                id="tdf-appel-final"
                className="text-mocha-fg font-serif text-3xl leading-tight font-medium sm:text-4xl"
              >
                {APPEL_FINAL.titre}
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              <BoutonRendezVous depuis="tdf-final" />
              <p className="text-mocha-fg-muted text-sm">{MICRO_TEXTE_CTA}</p>
            </div>
          </div>
        </section>
      </main>

      {/* 10. Pied de page propre au Tour */}
      <footer className={`${CONTENEUR} text-fg-muted mt-16 pb-28 text-sm md:pb-12`}>
        <div className="border-border border-t pt-8">
          <p className="text-fg font-semibold">{PIED.organise}</p>
          <ul className="mt-3 flex flex-wrap gap-x-5">
            {PIED.liens.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="hover:text-fg inline-flex min-h-11 items-center underline underline-offset-4"
                >
                  {l.libelle}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3">{PIED.nonAffiliation}</p>
        </div>
      </footer>

      {/* CTA collant, mobile seulement, après le héros (piloté par `PiloteCta`). */}
      <div
        id={ID_CTA_COLLANT}
        data-visible="false"
        inert
        className="border-border bg-bg/95 fixed inset-x-0 bottom-0 z-40 translate-y-full border-t px-4 py-3 opacity-0 transition duration-200 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 motion-reduce:transition-none md:hidden"
      >
        <a
          href={lienRendezVous("tdf-collant")}
          data-tdf-cta=""
          className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-primary flex min-h-12 w-full items-center justify-center rounded-full px-5 text-center text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {LIBELLE_CTA}
        </a>
      </div>
      <PiloteCta idHeros={ID_CTA_HEROS} idCollant={ID_CTA_COLLANT} />
    </>
  );
}
