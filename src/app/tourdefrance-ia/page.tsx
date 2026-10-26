// `/tourdefrance-ia` — la landing du Tour de France IA (2026-10-25, refonte
// « page de conversion » le 2026-10-26, puis « aux couleurs d'Axion » le même
// jour, après relecture de Will : la page était jugée fade et son discours
// d'événement faux).
//
// Tunnel : post Facebook ou Instagram (UTM) → cette page → « Je veux mon audit
// offert » → `/fr/appel/tour-de-france-ia` (la visio, type `tour` de
// `types-reservables.ts`) → Calendly → console.
//
// Écrite pour ce trafic-là : mobile d'abord, navigateur intégré de Facebook,
// 4G, trois secondes d'attention. Donc : la promesse, l'offre, sa condition et
// le bouton tiennent dans le premier écran d'un téléphone ; UNE seule action,
// répétée à cinq emplacements fixes (`EMPLACEMENTS_CTA`), aucun menu.
//
// Charte : celle du site (`globals.css`). En-tête terracotta et logo en badge
// ivoire, comme l'en-tête d'Axion ; héros mocha à lueurs terracotta et bleue ;
// boutons bleu primaire pleins ; sections alternées clair / sable / mocha /
// terracotta ; cartes en relief (`--shadow-card`). Tout passe par des utilitaires
// Tailwind dès que possible (cf. `FOND_MARQUE`).
//
// Composants SERVEUR seulement, sauf `PiloteCta` (bouton collant + recopie des
// `utm_*`). Aucun composant d'en-tête ou de pied de page d'Axion (l'en-tête du
// tunnel est écrit ici, sans navigation), aucun next-intl, aucun script tiers,
// aucune mesure d'audience. Les dessins
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
  BANDEAU,
  DEFINITION,
  EN_BREF,
  ENTETE,
  ETAPES,
  FAQ,
  FONDATEUR,
  HEROS,
  LEVIERS,
  LIBELLE_CTA,
  LIBELLE_CTA_COURT,
  META,
  MICRO_TEXTE_CTA,
  OFFRE_DETAIL,
  PIED,
  POUR_QUI,
  PRINCIPE,
  PROBLEME,
  lienRendezVous,
  type EmplacementCta,
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
/** Le surtitre du héros : en Manrope (repli métrique, préchargée), JAMAIS en Inconsolata
 * au-dessus de la ligne de flottaison — sa bascule de police décalait le titre. */
const REPERE_SOMBRE = "text-sm font-semibold tracking-[0.06em] text-terracotta-on-mocha uppercase";
const TITRE_SECTION =
  "font-serif text-[1.875rem] leading-[1.12] font-medium tracking-tight text-fg sm:text-[2.5rem]";
const SECTION = "py-16 sm:py-24";
/**
 * Le fond de marque du héros et de l'appel final : le mocha d'Axion, une lueur
 * terracotta en haut à droite, une lueur bleu primaire en bas à gauche. En
 * utilitaire Tailwind plutôt qu'en classe du module CSS : chaque classe du module
 * ajoute son nom à la table livrée au navigateur avec le chunk de la page.
 */
const FOND_MARQUE =
  "bg-mocha bg-[radial-gradient(48rem_26rem_at_88%_-8%,color-mix(in_srgb,var(--color-terracotta)_62%,transparent),transparent_62%),radial-gradient(36rem_22rem_at_-12%_108%,color-mix(in_srgb,var(--color-primary)_38%,transparent),transparent_62%)]";
const ID_CTA_HEROS = "tdf-cta-heros";
const ID_CTA_COLLANT = "tdf-cta-collant";
const ID_APPEL_FINAL = "tdf-appel-final";
/** La section entière : c'est elle que `PiloteCta` observe (le collant se cache dès qu'elle entre à l'écran). */
const ID_SECTION_FINALE = "tdf-section-finale";

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

/** Le pictogramme de chaque carte de l'offre, dans l'ordre d'`OFFRE_DETAIL.cartes`. */
const PICTO_OFFRE = [0, 1, 3, 2] as const;

/**
 * Le bouton principal : pilule bleue pleine, 56 px de haut, libellé de l'offre,
 * flèche et halo. `compact` : la petite pilule de l'en-tête et du bandeau (44 px
 * de haut, libellé court, sans flèche ni halo).
 */
function BoutonAudit({
  depuis,
  id,
  pleineLargeur = false,
  compact = false,
}: {
  depuis: EmplacementCta;
  id?: string;
  pleineLargeur?: boolean;
  compact?: boolean;
}) {
  const largeur = compact ? "" : pleineLargeur ? "w-full" : "w-full sm:w-auto";
  return (
    <a
      href={lienRendezVous(depuis)}
      id={id}
      data-tdf-cta=""
      className={`${styles.bouton} ${compact ? styles.boutonCompact : ""} rounded-full ${largeur}`}
    >
      {compact || pleineLargeur ? null : <span className={styles.halo} aria-hidden="true" />}
      {compact ? LIBELLE_CTA_COURT : LIBELLE_CTA}
      {compact ? null : <Fleche />}
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

      {/* 0. En-tête du tunnel — terracotta comme l'en-tête du site, le logo, UN
          bouton. Aucun menu, aucun lien qui ferait sortir du tunnel. */}
      <header className="bg-terracotta border-terracotta-deep border-b">
        <div className={`${CONTENEUR} flex min-h-16 items-center gap-3 py-2.5`}>
          <p
            className="bg-paper text-fg shadow-subtle inline-flex items-baseline rounded-lg px-3 py-2 font-serif text-[1.375rem] leading-none font-medium tracking-tight"
            aria-label={ENTETE.logo}
          >
            {ENTETE.marque}
            <span aria-hidden="true" className="text-fg-soft mx-0.5">
              -
            </span>
            <span className="text-terracotta italic">{ENTETE.marqueAccent}</span>
          </p>
          <div className="ml-auto">
            <BoutonAudit depuis="tdf-entete" compact />
          </div>
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        {/* 1. Héros — mocha de marque à lueurs terracotta et bleue, tient dans
            le premier écran d'un téléphone. */}
        <section className={`${FOND_MARQUE} text-mocha-fg`} aria-labelledby="tdf-titre">
          <div
            className={`${CONTENEUR} grid gap-10 pt-7 pb-12 sm:pt-12 sm:pb-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:pt-16 lg:pb-24`}
          >
            <div>
              <p className={`${REPERE_SOMBRE} flex items-center gap-3`}>
                <Jauge className="shrink-0" />
                {HEROS.surtitre}
              </p>
              <h1
                id="tdf-titre"
                className="mt-5 font-serif text-[clamp(1.5rem,6.6vw,3.25rem)] leading-[1.08] font-medium tracking-tight text-balance"
              >
                {HEROS.titreAvant}
                <span className="text-terracotta-on-mocha decoration-terracotta italic underline decoration-[0.12em] underline-offset-[0.14em]">
                  {HEROS.titreAccent}
                </span>
                {HEROS.titreApres}
              </h1>
              <p className="mt-4 font-serif text-xl leading-snug font-medium sm:text-2xl lg:text-[1.75rem]">
                {HEROS.accroche}
              </p>
              <ul className="mt-5 hidden flex-wrap gap-2 sm:flex" aria-label={HEROS.surtitre}>
                {HEROS.pastilles.map((p) => (
                  <li
                    key={p}
                    className={`border-mocha-fg/30 bg-mocha-fg/10 inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold`}
                  >
                    <Coche taille={18} surSombre />
                    {p}
                  </li>
                ))}
              </ul>
              <p className="mt-5 max-w-xl text-lg leading-snug font-semibold sm:text-xl">
                {HEROS.sousTitre}
              </p>
              <p className="text-mocha-fg-muted mt-3 max-w-xl text-[0.9375rem] leading-relaxed">
                {HEROS.condition}
              </p>
              <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:items-start">
                <BoutonAudit depuis="tdf-heros" id={ID_CTA_HEROS} />
                <p className="text-mocha-fg-muted text-sm sm:pl-2">{MICRO_TEXTE_CTA}</p>
              </div>
            </div>

            <figure
              className={`bg-ink/45 border-border-on-mocha shadow-elevated mx-auto w-full max-w-[380px] rounded-2xl border p-5 lg:max-w-[480px]`}
            >
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
        <section className="border-border bg-paper border-b" aria-labelledby="tdf-en-bref">
          <div className={`${CONTENEUR} py-10 sm:py-14`}>
            <div className="border-terracotta mx-auto max-w-3xl border-l-4 pl-5">
              <h2 id="tdf-en-bref" className={REPERE}>
                {EN_BREF}
              </h2>
              <p className="text-fg mt-3 text-base leading-relaxed sm:text-lg">{DEFINITION}</p>
            </div>
          </div>
        </section>

        {/* 3. Ce que le Tour apporte — quatre cartes en relief sur le sable. */}
        <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-offre">
          <div className={CONTENEUR}>
            <h2 id="tdf-offre" className={`${TITRE_SECTION} max-w-3xl`}>
              {OFFRE_DETAIL.titre}
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {OFFRE_DETAIL.cartes.map((c, i) => (
                <li
                  key={c.titre}
                  className={`${i % 2 ? "border-primary" : "border-terracotta"} bg-paper shadow-card hover:shadow-elevated flex flex-col rounded-2xl border-t-4 p-6 transition duration-200 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-fg">
                      <IllustrationMoment index={PICTO_OFFRE[i] ?? 0} />
                    </span>
                    <span
                      className={`${i % 2 ? "bg-primary-soft text-primary-hover" : "bg-terracotta-soft text-terracotta-deep"} rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase`}
                    >
                      {c.etiquette}
                    </span>
                  </div>
                  <p className="text-fg-muted mt-5 font-mono text-sm">{c.duree}</p>
                  <h3 className="text-fg mt-1 font-serif text-[1.5rem] leading-snug font-medium">
                    {c.titre}
                  </h3>
                  <p className="text-fg-soft mt-2">{c.texte}</p>
                  <p className="border-border-strong text-fg mt-auto border-t border-dashed pt-4 font-semibold">
                    {c.recu}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 4. Le problème du dirigeant — bande de CONTRASTE terracotta profond. */}
        <section
          className={`bg-terracotta-deep text-mocha-fg ${SECTION}`}
          aria-labelledby="tdf-probleme"
        >
          <div className={CONTENEUR}>
            <h2
              id="tdf-probleme"
              className="max-w-4xl font-serif text-[2rem] leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]"
            >
              {PROBLEME.titre}
            </h2>
            <ul className="border-mocha-fg/30 mt-12 grid border-t md:grid-cols-3">
              {PROBLEME.constats.map((c, i) => (
                <li
                  key={c.titre}
                  className="border-mocha-fg/30 border-b py-7 md:border-b-0 md:py-8 md:pr-8 md:not-first:border-l md:not-first:pl-8"
                >
                  <span className={styles.constat}>
                    <IllustrationConstat index={i} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{c.titre}</h3>
                  <p className="mt-1.5">{c.texte}</p>
                </li>
              ))}
            </ul>
            <p className="mt-12 max-w-2xl font-serif text-2xl leading-snug sm:text-[1.75rem]">
              {PROBLEME.chute}
            </p>
          </div>
        </section>

        {/* 5. Ce que l'audit chiffre — section SOMBRE typographique : les trois
            leviers en très grands caractères, des filets, aucune carte. */}
        <section className={`bg-mocha text-mocha-fg ${SECTION}`} aria-labelledby="tdf-leviers">
          <div className={CONTENEUR}>
            <h2
              id="tdf-leviers"
              className="max-w-3xl font-serif text-[2.25rem] leading-[1.05] font-medium tracking-tight sm:text-6xl"
            >
              {LEVIERS.titre}
            </h2>
            <p className="text-mocha-fg-muted mt-4 max-w-2xl text-lg">{LEVIERS.intro}</p>
            <ol className="border-mocha-fg mt-12 border-t-2">
              {LEVIERS.liste.map((l, i) => (
                <li
                  key={l.mot}
                  className="border-border-on-mocha grid gap-x-10 gap-y-3 border-b py-8 sm:py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end"
                >
                  <p
                    className={`text-terracotta-on-mocha font-serif text-[clamp(2.5rem,10vw,5.5rem)] leading-[0.95] font-medium tracking-tight`}
                  >
                    {l.mot}
                  </p>
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden="true"
                      className="text-mocha-fg-muted mt-1 shrink-0 font-mono text-sm"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="text-lg">{l.texte}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 6. Bandeau d'accent — la règle d'ouverture, présentée comme une chance. */}
        <section
          className="from-terracotta-deep via-terracotta to-terracotta text-mocha-fg bg-linear-100"
          aria-labelledby="tdf-bandeau"
        >
          <div
            className={`${CONTENEUR} flex flex-col gap-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:py-12`}
          >
            <div className="max-w-2xl">
              <h2
                id="tdf-bandeau"
                className="font-serif text-[1.625rem] leading-tight font-medium sm:text-[2rem]"
              >
                {BANDEAU.titre}
              </h2>
              <p className="mt-2 text-lg">{BANDEAU.texte}</p>
            </div>
            <div className="shrink-0">
              <BoutonAudit depuis="tdf-bandeau" compact />
            </div>
          </div>
        </section>

        {/* 7. Pour qui — de la TPE à l'ETI, et ce que l'audit peut mettre en évidence. */}
        <section className={SECTION} aria-labelledby="tdf-pour-qui">
          <div className={`${CONTENEUR} grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-14`}>
            <div>
              <h2 id="tdf-pour-qui" className={TITRE_SECTION}>
                {POUR_QUI.titre}
              </h2>
              <p className="text-fg mt-4 font-serif text-2xl leading-snug">{POUR_QUI.phrase}</p>
              <ul className="mt-6 flex flex-wrap gap-2" aria-label={POUR_QUI.phrase}>
                {POUR_QUI.tailles.map((t) => (
                  <li
                    key={t}
                    className="bg-terracotta text-mocha-fg rounded-full px-4 py-1.5 text-sm font-bold"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={REPERE}>{POUR_QUI.exemplesTitre}</h3>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {POUR_QUI.exemples.map((e, i) => (
                  <li
                    key={e.secteur}
                    className="border-border bg-paper shadow-subtle flex items-start gap-4 rounded-xl border p-4"
                  >
                    <span className="bg-terracotta-soft text-terracotta grid h-11 w-11 shrink-0 place-items-center rounded-full">
                      <PictoSecteur index={i} />
                    </span>
                    <span>
                      <span className="text-fg block font-semibold">{e.secteur}</span>
                      <span className="text-fg-soft mt-0.5 block text-[0.9375rem] leading-snug">
                        {e.gain}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-fg-soft mt-4">{POUR_QUI.suite}</p>
            </div>
          </div>
        </section>

        {/* 8. Comment ça marche, en 4 étapes. */}
        <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-comment">
          <div className={CONTENEUR}>
            <h2 id="tdf-comment" className={TITRE_SECTION}>
              {ETAPES.titre}
            </h2>
            <ol
              aria-labelledby="tdf-comment"
              className={`${styles.parcours} mt-10 grid gap-10 lg:grid-cols-4 lg:gap-8`}
            >
              {ETAPES.liste.map((etape, i) => (
                <li key={etape} className="relative min-h-11 pl-16 lg:pt-16 lg:pl-0">
                  <span
                    aria-hidden="true"
                    className={`absolute top-0 left-0 z-[1] grid h-11 w-11 place-items-center rounded-full border-[1.5px] font-mono text-[0.95rem] ${i === ETAPES.liste.length - 1 ? "border-primary bg-primary text-primary-fg" : "border-terracotta bg-terracotta text-mocha-fg"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-fg pt-2 text-lg leading-snug font-semibold lg:pt-0">{etape}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 9. Fondateur — la photo publique de la page « À propos ». */}
        <section
          className="bg-paper border-border border-b py-14 sm:py-20"
          aria-labelledby="tdf-fondateur"
        >
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

        {/* 10. Questions fréquentes — accordéon natif (FAQPage dans le JSON-LD). */}
        <section className={SECTION} aria-labelledby="tdf-faq">
          <div className={`${CONTENEUR} max-w-3xl`}>
            <h2 id="tdf-faq" className={TITRE_SECTION}>
              {FAQ.titre}
            </h2>
            <div className="divide-border border-border mt-8 divide-y border-y">
              {FAQ.questions.map((q) => (
                <details key={q.question} className={styles.question}>
                  <summary>
                    <span className="text-fg font-serif text-xl leading-snug font-medium">
                      {q.question}
                    </span>
                    <span className={styles.signe} aria-hidden="true" />
                  </summary>
                  <p className="text-fg-soft pr-12 pb-6 text-base leading-relaxed">{q.reponse}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 11. Appel final — le même mocha à lueurs que le héros : la page se referme comme elle s'ouvre. */}
        <section
          id={ID_SECTION_FINALE}
          className={`${FOND_MARQUE} text-mocha-fg`}
          aria-labelledby={ID_APPEL_FINAL}
        >
          <div className={`${CONTENEUR} py-16 sm:py-24`}>
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <Jauge />
              <h2
                id={ID_APPEL_FINAL}
                className="mt-6 font-serif text-[2rem] leading-tight font-medium tracking-tight sm:text-5xl"
              >
                {APPEL_FINAL.titre}
              </h2>
              <p className="text-mocha-fg-muted mt-4 text-lg">{APPEL_FINAL.texte}</p>
              <div className="mt-8 flex w-full flex-col items-center gap-2.5">
                <BoutonAudit depuis="tdf-final" />
                <p className="text-mocha-fg-muted text-sm">{MICRO_TEXTE_CTA}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 12. Pied de page propre au Tour. */}
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

      {/* Bouton collant, mobile seulement, entre le bouton du héros et l’appel final (`PiloteCta`). */}
      <div
        id={ID_CTA_COLLANT}
        data-visible="false"
        inert
        className={`${styles.collant} border-border bg-bg/95 fixed inset-x-0 bottom-0 z-40 translate-y-full border-t px-4 pt-3 opacity-0 backdrop-blur transition duration-200 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 motion-reduce:transition-none md:hidden`}
      >
        <BoutonAudit depuis="tdf-collant" pleineLargeur />
      </div>
      <PiloteCta idHeros={ID_CTA_HEROS} idFinal={ID_SECTION_FINALE} idCollant={ID_CTA_COLLANT} />
    </>
  );
}
