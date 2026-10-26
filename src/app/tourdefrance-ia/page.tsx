// `/tourdefrance-ia` — la landing du Tour de France IA (2026-10-25, refonte
// « page de conversion » le 2026-10-26).
//
// Tunnel : post Facebook ou Instagram (UTM, `fbclid`) → cette page → « Participer »
// → `/fr/appel/tour-de-france-ia` (la visio, type `tour` de
// `types-reservables.ts`) → Calendly → fiche prospect dans la console.
//
// Écrite pour ce trafic-là : mobile d'abord, navigateur intégré de Facebook,
// 4G, trois secondes d'attention. Donc : la promesse, l'offre, sa condition et
// le bouton tiennent dans le premier écran d'un téléphone ; UNE seule action
// (« Participer ») répétée, aucun menu ; un fond sombre au héros pour rompre
// avec le fil d'actualité (`--color-ink`, réservé par la charte aux pages
// d'atterrissage publicitaires).
//
// Composants SERVEUR seulement, sauf `PiloteCta` (bouton collant + recopie des
// `utm_*` et du `fbclid`). Aucun composant d'en-tête ou de pied de page d'Axion,
// aucun next-intl, aucun script tiers, aucune mesure d'audience. Les dessins
// sont des SVG en ligne, animés en CSS seul ; la FAQ est un `details`/`summary`
// natif. Tout le texte vit dans `contenu.ts`.
//
// 🔑 Fermé (`TOUR_PUBLIC` faux) : la page appelle `connection()` — rendu à la
// requête, jamais prérendu ni mis en cache. Ouvert : seul l'interrupteur
// change, et la page redevient statique.

import type { Metadata } from "next";
import { connection } from "next/server";

import { TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";

import {
  APPEL_FINAL,
  BENEFICES,
  DEFINITION,
  EN_BREF,
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
  PRINCIPE,
  PROBLEME,
  lienRendezVous,
} from "./contenu";
import { jsonLdDuTour } from "./jsonld";
import {
  CarteFrance,
  Coche,
  Fleche,
  IllustrationConstat,
  IllustrationMoment,
  Jauge,
  PictoSecteur,
} from "./_composants/Visuels";
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
const TITRE_SECTION =
  "font-serif text-[1.875rem] leading-[1.12] font-medium tracking-tight text-fg sm:text-[2.5rem]";
const SECTION = "py-16 sm:py-24";
const ID_CTA_HEROS = "tdf-cta-heros";
const ID_CTA_COLLANT = "tdf-cta-collant";

/**
 * La photo du fondateur, servie par l'optimiseur d'images de Next SANS le
 * composant `next/image` (qui est un composant CLIENT : il ajouterait son
 * JavaScript à la page). Les largeurs sont celles par défaut de `imageSizes`
 * (`next.config.ts` ne les redéfinit pas) et la qualité celle par défaut (75) :
 * une autre valeur serait refusée par l'optimiseur.
 */
const LARGEURS_PHOTO = [128, 256, 384] as const;
const urlPhoto = (largeur: number) =>
  `/_next/image?url=${encodeURIComponent(FONDATEUR.photo)}&w=${largeur}&q=75`;

/** Le bouton principal : pilule bleue, 52 px de haut, libellé unique, flèche. */
function BoutonParticiper({
  depuis,
  id,
  pleineLargeur = false,
}: {
  depuis: string;
  id?: string;
  pleineLargeur?: boolean;
}) {
  return (
    <a
      href={lienRendezVous(depuis)}
      id={id}
      data-tdf-cta=""
      className={`${styles.bouton} rounded-full ${pleineLargeur ? "w-full" : "w-full sm:w-auto"}`}
    >
      {LIBELLE_CTA}
      <Fleche />
    </a>
  );
}

export default async function TourDeFranceIaPage() {
  if (!TOUR_PUBLIC) await connection();

  // « < » échappé : un texte ne peut pas fermer la balise `script`.
  const jsonLd = JSON.stringify(jsonLdDuTour()).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <main className="pb-24 md:pb-0">
        {/* 1. Héros — fond encre, tient dans le premier écran d'un téléphone. */}
        <section className="bg-ink text-mocha-fg" aria-labelledby="tdf-titre">
          <header className={`${CONTENEUR} flex min-h-14 items-center gap-3 pt-2`}>
            <p className="font-serif text-lg font-medium">{NOM_DU_TOUR}</p>
            <p className="text-mocha-fg-muted text-sm">· {PIED.organise}</p>
          </header>

          <div
            className={`${CONTENEUR} grid gap-10 pt-5 pb-12 sm:pt-10 sm:pb-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:pt-14 lg:pb-24`}
          >
            <div>
              <p className="text-mocha-fg flex items-center gap-3 text-sm font-semibold">
                <Jauge className="shrink-0" />
                {HEROS.jauge}
              </p>
              <h1
                id="tdf-titre"
                className="mt-5 font-serif text-[2rem] leading-[1.08] font-medium tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]"
              >
                {HEROS.titreAvant}
                <span className="text-terracotta-on-mocha">{HEROS.titreAccent}</span>
                {HEROS.titreApres}
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-snug font-semibold sm:mt-6 sm:text-xl">
                {HEROS.sousTitre}
              </p>
              <p className="text-mocha-fg-muted mt-3 max-w-xl text-[0.9375rem] leading-relaxed">
                {HEROS.condition}
              </p>
              <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:items-start">
                <BoutonParticiper depuis="tdf-heros" id={ID_CTA_HEROS} />
                <p className="text-mocha-fg-muted text-sm sm:pl-2">{MICRO_TEXTE_CTA}</p>
              </div>
            </div>

            <figure className="mx-auto w-full max-w-[360px] lg:max-w-[460px]">
              <CarteFrance
                surSombre
                titre={PRINCIPE.alt}
                titreId="tdf-carte-titre"
                className="h-auto w-full"
              />
              <figcaption className="text-mocha-fg-muted mt-3 text-center text-xs">
                {PRINCIPE.legende}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* 2. Définition citable, en texte visible (GEO). */}
        <section className="border-border border-b" aria-labelledby="tdf-en-bref">
          <div className={`${CONTENEUR} py-10 sm:py-14`}>
            <div className="mx-auto max-w-3xl">
              <h2 id="tdf-en-bref" className={REPERE}>
                {EN_BREF}
              </h2>
              <p className="text-fg mt-3 text-base leading-relaxed sm:text-lg">{DEFINITION}</p>
            </div>
          </div>
        </section>

        {/* 3. Le problème du dirigeant. */}
        <section className={SECTION} aria-labelledby="tdf-probleme">
          <div className={CONTENEUR}>
            <h2 id="tdf-probleme" className={`${TITRE_SECTION} max-w-3xl`}>
              {PROBLEME.titre}
            </h2>
            <ul className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
              {PROBLEME.constats.map((c, i) => (
                <li key={c.titre} className="border-border bg-paper rounded-2xl border p-6">
                  <span className="text-fg-soft">
                    <IllustrationConstat index={i} />
                  </span>
                  <h3 className="text-fg mt-4 text-lg font-semibold">{c.titre}</h3>
                  <p className="text-fg-soft mt-1.5">{c.texte}</p>
                </li>
              ))}
            </ul>
            <p className="text-fg mt-10 max-w-2xl font-serif text-2xl leading-snug sm:text-[1.75rem]">
              {PROBLEME.chute}
            </p>
          </div>
        </section>

        {/* 4. La journée en trois temps — frise illustrée. */}
        <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-journee">
          <div className={CONTENEUR}>
            <h2 id="tdf-journee" className={TITRE_SECTION}>
              {JOURNEE.titre}
            </h2>
            <ol className={`${styles.frise} mt-10 grid gap-6 md:grid-cols-3 md:gap-6`}>
              {JOURNEE.moments.map((m, i) => (
                <li key={m.moment} className="flex gap-5 md:flex-col md:gap-0">
                  <span
                    className={`z-[1] grid h-16 w-16 shrink-0 place-items-center rounded-full ${i === 2 ? "bg-mocha text-mocha-fg" : "bg-paper text-fg"} shadow-[0_0_0_6px_var(--color-sand)]`}
                  >
                    <IllustrationMoment index={i} />
                  </span>
                  <div className="md:mt-6">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <span className={REPERE}>{m.moment}</span>
                      <span className="text-terracotta font-mono text-sm font-semibold">
                        {m.duree}
                      </span>
                    </p>
                    <h3 className="text-fg mt-1.5 font-serif text-[1.5rem] leading-snug font-medium">
                      {m.titre}
                    </h3>
                    <p className="text-fg-soft mt-2">{m.texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5. Le principe d'une étape, et comment ça marche en 4 étapes. */}
        <section className={SECTION} aria-labelledby="tdf-principe">
          <div className={CONTENEUR}>
            <div className="max-w-3xl">
              <h2 id="tdf-principe" className={TITRE_SECTION}>
                {PRINCIPE.titre}
              </h2>
              <p className="text-fg-soft mt-4 text-lg leading-relaxed">{PRINCIPE.texte}</p>
            </div>
            <h3 id="tdf-etapes" className={`${REPERE} mt-14`}>
              {ETAPES.titre}
            </h3>
            <ol
              aria-labelledby="tdf-etapes"
              className={`${styles.parcours} mt-8 grid gap-10 lg:grid-cols-4 lg:gap-8`}
            >
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
            <div className="mt-12 flex flex-col gap-2.5 sm:items-start">
              <BoutonParticiper depuis="tdf-etapes" />
              <p className="text-fg-muted text-sm sm:pl-2">{MICRO_TEXTE_CTA}</p>
            </div>
          </div>
        </section>

        {/* 6. Pour qui — toutes tailles, tous secteurs. */}
        <section
          className={`bg-paper border-border border-y ${SECTION}`}
          aria-labelledby="tdf-pour-qui"
        >
          <div className={`${CONTENEUR} grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-14`}>
            <div>
              <h2 id="tdf-pour-qui" className={TITRE_SECTION}>
                {POUR_QUI.titre}
              </h2>
              <p className="text-fg mt-4 font-serif text-2xl leading-snug">{POUR_QUI.phrase}</p>
              <ul className="mt-6 flex flex-wrap gap-2" aria-label={POUR_QUI.phrase}>
                {POUR_QUI.tailles.map((t) => (
                  <li
                    key={t}
                    className="border-border-strong text-fg rounded-full border px-3.5 py-1.5 text-sm font-semibold"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {POUR_QUI.secteurs.map((s, i) => (
                  <li
                    key={s}
                    className="border-border bg-bg text-fg flex min-h-24 flex-col justify-between gap-3 rounded-xl border p-4"
                  >
                    <span className="text-terracotta">
                      <PictoSecteur index={i} />
                    </span>
                    <span className="text-[0.9375rem] leading-tight font-semibold">{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-fg-soft mt-4">{POUR_QUI.suite}</p>
            </div>
          </div>
        </section>

        {/* 7. Ce que vous en retirez — sans promesse chiffrée. */}
        <section className={SECTION} aria-labelledby="tdf-benefices">
          <div className={CONTENEUR}>
            <h2 id="tdf-benefices" className={TITRE_SECTION}>
              {BENEFICES.titre}
            </h2>
            <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {BENEFICES.liste.map((b) => (
                <li key={b.titre} className="flex items-start gap-4">
                  <Coche className="mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-fg text-lg font-semibold">{b.titre}</h3>
                    <p className="text-fg-soft mt-1">{b.texte}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-fg-muted mt-8 text-sm">{BENEFICES.mention}</p>
          </div>
        </section>

        {/* 8. Fondateur — la photo publique de la page « À propos ». */}
        <section className="bg-sand py-14 sm:py-20" aria-labelledby="tdf-fondateur">
          <div className={`${CONTENEUR} flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- optimiseur servi sans le JS de `next/image` (cf. `urlPhoto`) */}
            <img
              src={urlPhoto(256)}
              srcSet={LARGEURS_PHOTO.map((l) => `${urlPhoto(l)} ${l}w`).join(", ")}
              sizes="(min-width: 640px) 160px, 112px"
              width={160}
              height={160}
              alt={FONDATEUR.photoAlt}
              loading="lazy"
              decoding="async"
              className="bg-sand-deep h-28 w-28 shrink-0 rounded-full object-cover sm:h-40 sm:w-40"
            />
            <div className="max-w-2xl">
              <h2 id="tdf-fondateur" className={REPERE}>
                {FONDATEUR.titre}
              </h2>
              <p className="text-fg mt-2 font-serif text-[1.75rem] leading-tight font-medium">
                {FONDATEUR.nom}
              </p>
              <p className="text-fg-soft mt-1 font-semibold">{FONDATEUR.role}</p>
              <p className="text-fg mt-4 text-lg">{FONDATEUR.ligne2}</p>
              <p className="text-fg-soft mt-2">{FONDATEUR.ligne3}</p>
              <p className="mt-2">
                <a
                  href={FONDATEUR.chemin}
                  className="text-fg decoration-border-strong hover:decoration-terracotta focus-visible:outline-primary inline-flex min-h-12 items-center font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {FONDATEUR.lien}
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* 9. Questions fréquentes — accordéon natif (FAQPage dans le JSON-LD). */}
        <section className={SECTION} aria-labelledby="tdf-faq">
          <div className={`${CONTENEUR} max-w-3xl`}>
            <h2 id="tdf-faq" className={TITRE_SECTION}>
              {FAQ.titre}
            </h2>
            <div className="divide-border border-border mt-8 divide-y border-y">
              {FAQ.questions.map((q) => (
                <details key={q.question} className={styles.question}>
                  <summary>
                    <h3 className="text-fg font-serif text-xl leading-snug font-medium">
                      {q.question}
                    </h3>
                    <span className={styles.signe} aria-hidden="true" />
                  </summary>
                  <p className="text-fg-soft pr-12 pb-6 text-base leading-relaxed">{q.reponse}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 10. Appel final — fond encre, comme le héros. */}
        <section className="bg-ink text-mocha-fg" aria-labelledby="tdf-appel-final">
          <div className={`${CONTENEUR} py-16 sm:py-24`}>
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <Coche taille={40} surSombre />
              <h2
                id="tdf-appel-final"
                className="mt-6 font-serif text-[2rem] leading-tight font-medium tracking-tight sm:text-5xl"
              >
                {APPEL_FINAL.titre}
              </h2>
              <p className="text-mocha-fg-muted mt-4 text-lg">{APPEL_FINAL.texte}</p>
              <div className="mt-8 flex w-full flex-col items-center gap-2.5">
                <BoutonParticiper depuis="tdf-final" />
                <p className="text-mocha-fg-muted text-sm">{MICRO_TEXTE_CTA}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 11. Pied de page propre au Tour. */}
      <footer className={`${CONTENEUR} text-fg-muted pt-10 pb-28 text-sm md:pb-12`}>
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
      </footer>

      {/* Bouton collant, mobile seulement, après le héros (piloté par `PiloteCta`). */}
      <div
        id={ID_CTA_COLLANT}
        data-visible="false"
        inert
        className={`${styles.collant} border-border bg-bg/95 fixed inset-x-0 bottom-0 z-40 translate-y-full border-t px-4 pt-3 opacity-0 backdrop-blur transition duration-200 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 motion-reduce:transition-none md:hidden`}
      >
        <BoutonParticiper depuis="tdf-collant" pleineLargeur />
      </div>
      <PiloteCta idHeros={ID_CTA_HEROS} idCollant={ID_CTA_COLLANT} />
    </>
  );
}
