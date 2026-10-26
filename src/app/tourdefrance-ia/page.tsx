// `/tourdefrance-ia` — la landing du Tour de France IA (2026-10-25, refonte
// « page de conversion » le 2026-10-26, réécriture « offre aux couleurs
// d'Axion » le 2026-10-26 sur le retour de Will).
//
// Tunnel : post Facebook ou Instagram (UTM) → cette page → « Je veux mon audit
// offert » → `/fr/appel/tour-de-france-ia` (la visio, type `tour` de
// `types-reservables.ts`) → Calendly → fiche dans la console.
//
// Écrite pour ce trafic-là : mobile d'abord, navigateur intégré de Facebook,
// 4G, trois secondes d'attention. Donc : l'accroche, l'offre, sa condition et
// le bouton tiennent dans le premier écran d'un téléphone ; UNE seule action
// répétée à cinq emplacements fixes (`EMPLACEMENTS_CTA`), aucun menu.
//
// Charte d'Axion-IA appliquée franchement (tokens de `globals.css`) : l'en-tête
// terracotta du site (`--color-terracotta`) avec le logo sur pastille ivoire
// (`--color-paper`), le bouton plein bleu à halo (`--color-primary`), le héros
// sur encre à halo terracotta (`.bg-vsl`, réservé aux pages d'atterrissage
// publicitaires), puis des sections alternées : clair, sombre de marque
// (`.bg-mocha-rich`), accent terracotta, sable.
//
// Composants SERVEUR seulement, sauf `PiloteCta` (bouton collant + recopie des
// `utm_*`). Aucun composant d'en-tête ou de pied de page d'Axion,
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
  AUDIT,
  BANDEAU,
  DEDANS,
  DEFINITION,
  EN_BREF,
  ENTETE,
  ETAPES,
  FAQ,
  FONDATEUR,
  FORMATION,
  HEROS,
  LIBELLE_CTA,
  LIBELLE_CTA_COURT,
  META,
  MICRO_TEXTE_CTA,
  PIED,
  POUR_QUI,
  PRINCIPE,
  lienRendezVous,
  type EmplacementCta,
} from "./contenu";
import { jsonLdDuTour } from "./jsonld";
import {
  CarteFrance,
  Coche,
  Fleche,
  IllustrationGain,
  IllustrationOffre,
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
    title: META.titrePartage,
    description: META.description,
  },
  // Images : convention de fichier (`opengraph-image.jpg`, `twitter-image.jpg`).
  twitter: {
    card: "summary_large_image",
    title: META.titrePartage,
    description: META.description,
  },
};

const CONTENEUR = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const SUR_TITRE = "font-mono text-sm font-semibold tracking-[0.12em] uppercase";
const TITRE_SECTION =
  "font-serif text-[2rem] leading-[1.08] font-medium tracking-tight text-balance sm:text-5xl";
const SECTION = "py-16 sm:py-24";
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

/**
 * Le bouton d'action : pilule bleue pleine, 52 px de haut, flèche.
 * `compact` : la pilule de l'en-tête (44 px de haut, libellé court, sans flèche).
 * `vif` : le bouton du héros, dont le halo s'allume deux fois à l'arrivée.
 */
function BoutonAudit({
  depuis,
  id,
  pleineLargeur = false,
  compact = false,
  vif = false,
}: {
  depuis: EmplacementCta;
  id?: string;
  pleineLargeur?: boolean;
  compact?: boolean;
  vif?: boolean;
}) {
  const largeur = compact ? "" : pleineLargeur ? "w-full" : "w-full sm:w-auto";
  return (
    <a
      href={lienRendezVous(depuis)}
      id={id}
      data-tdf-cta=""
      className={`${styles.bouton} ${compact ? styles.boutonCompact : ""} ${vif ? styles.boutonVif : ""} rounded-full ${largeur}`}
    >
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

      {/* 0. En-tête de tunnel — la bande terracotta du site, le logo, UNE action. */}
      <header className="bg-terracotta border-terracotta-deep text-mocha-fg border-b md:sticky md:top-0 md:z-40">
        <div className={`${CONTENEUR} flex min-h-16 items-center justify-between gap-3 py-2`}>
          <p className="bg-paper text-fg shadow-subtle inline-flex shrink-0 items-center rounded-xl px-3.5 py-1.5">
            <span className="sr-only">{ENTETE.logo}</span>
            <span
              aria-hidden="true"
              className="font-serif text-xl leading-none font-medium tracking-tight"
            >
              Axion<span className="text-fg/70 mx-0.5">-</span>
              <span className="text-terracotta italic">IA</span>
            </span>
          </p>
          <BoutonAudit depuis="tdf-entete" compact />
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        {/* 1. Héros — encre à halo terracotta, tient dans le premier écran d'un téléphone. */}
        <section className="bg-vsl text-mocha-fg" aria-labelledby="tdf-titre">
          <div
            className={`${CONTENEUR} grid gap-10 pt-7 pb-12 sm:pt-12 sm:pb-20 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-14 lg:pt-16 lg:pb-24`}
          >
            <div className={styles.entree}>
              <p className="border-terracotta-on-mocha/60 text-terracotta-on-mocha inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold">
                <span aria-hidden="true" className={styles.pastille} />
                {HEROS.surTitre}
              </p>
              <h1
                id="tdf-titre"
                className="mt-5 font-serif text-[2rem] leading-[1.08] font-medium tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]"
              >
                {HEROS.titre}{" "}
                <span className={`${styles.surligne} text-terracotta-on-mocha italic`}>
                  {HEROS.titreAccent}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-snug font-semibold sm:mt-6 sm:text-xl">
                {HEROS.sousTitre}
              </p>
              <p className="text-mocha-fg-muted mt-3 max-w-xl text-[0.9375rem] leading-relaxed">
                {HEROS.condition}
              </p>
              <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:items-start">
                <BoutonAudit depuis="tdf-heros" id={ID_CTA_HEROS} vif />
                <p className="text-mocha-fg-muted text-sm sm:pl-2">{MICRO_TEXTE_CTA}</p>
              </div>
            </div>

            <figure className="mx-auto w-full max-w-[360px] lg:max-w-[460px]">
              <p className="text-mocha-fg mb-4 flex items-center justify-center gap-3 text-sm font-semibold">
                <Jauge className="shrink-0" />
                {HEROS.jauge}
              </p>
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

        {/* 2. Ce qu'il y a dedans — fond clair, quatre cartes en relief. */}
        <section className={`bg-halo-warm ${SECTION}`} aria-labelledby="tdf-dedans">
          <div className={CONTENEUR}>
            <p className={`${SUR_TITRE} text-terracotta`}>{DEDANS.surTitre}</p>
            <h2 id="tdf-dedans" className={`${TITRE_SECTION} text-fg mt-3 max-w-3xl`}>
              {DEDANS.titre}
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {DEDANS.cartes.map((c, i) => (
                <li
                  key={c.titre}
                  className={`${styles.carteOffre} bg-paper border-border shadow-card relative flex flex-col overflow-hidden rounded-2xl border p-6`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-1.5 ${i < 2 ? "bg-terracotta" : "bg-primary"}`}
                  />
                  <span className="flex items-start justify-between gap-3">
                    <span className={i < 2 ? "text-terracotta" : "text-primary"}>
                      <IllustrationOffre index={i} />
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase ${i < 2 ? "bg-terracotta text-mocha-fg" : "bg-primary-soft text-primary"}`}
                    >
                      {c.etiquette}
                    </span>
                  </span>
                  <h3 className="text-fg mt-5 font-serif text-[1.5rem] leading-snug font-medium">
                    {c.titre}
                  </h3>
                  <p className="text-terracotta mt-1 text-sm font-bold">{c.duree}</p>
                  <p className="text-fg-soft mt-3 leading-relaxed">{c.texte}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. Bandeau — accent terracotta pleine largeur : la jauge, dite comme une chance. */}
        <section className="bg-terracotta text-mocha-fg" aria-labelledby="tdf-bandeau">
          <div
            className={`${CONTENEUR} flex flex-col gap-6 py-12 sm:py-14 lg:flex-row lg:items-center lg:justify-between lg:gap-12`}
          >
            <div className="max-w-2xl">
              <h2
                id="tdf-bandeau"
                className="font-serif text-[1.75rem] leading-tight font-medium tracking-tight text-balance sm:text-4xl"
              >
                {BANDEAU.titre}
              </h2>
              <p className="mt-3 text-lg">{BANDEAU.texte}</p>
            </div>
            <div className="shrink-0">
              <BoutonAudit depuis="tdf-bandeau" />
            </div>
          </div>
        </section>

        {/* 4. L'audit — sombre de marque : les trois gains qu'il chiffre. */}
        <section className={`bg-mocha-rich text-mocha-fg ${SECTION}`} aria-labelledby="tdf-audit">
          <div className={CONTENEUR}>
            <p className={`${SUR_TITRE} text-terracotta-on-mocha`}>{AUDIT.surTitre}</p>
            <h2 id="tdf-audit" className={`${TITRE_SECTION} mt-3 max-w-4xl`}>
              {AUDIT.titre}
            </h2>
            <p className="text-mocha-fg-muted mt-5 max-w-2xl text-lg leading-relaxed">
              {AUDIT.texte}
            </p>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {AUDIT.gains.map((g, i) => (
                <li
                  key={g.titre}
                  className={`${styles.carteOffre} border-border-on-mocha bg-mocha-soft rounded-2xl border p-6`}
                >
                  <span className={styles.gain}>
                    <IllustrationGain index={i} />
                  </span>
                  <h3 className="mt-4 font-serif text-[1.75rem] leading-tight font-medium">
                    {g.titre}
                  </h3>
                  <p className="text-mocha-fg-muted mt-2">{g.texte}</p>
                </li>
              ))}
            </ul>
            <p className="text-mocha-fg-muted mt-8 text-sm">{AUDIT.mention}</p>
          </div>
        </section>

        {/* 5. La formation offerte, et l'AI Act. */}
        <section className={`bg-paper ${SECTION}`} aria-labelledby="tdf-formation">
          <div
            className={`${CONTENEUR} grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14`}
          >
            <div>
              <p className={`${SUR_TITRE} text-terracotta`}>{FORMATION.surTitre}</p>
              <h2 id="tdf-formation" className={`${TITRE_SECTION} text-fg mt-3`}>
                {FORMATION.titre}
              </h2>
              <p className="text-fg-soft mt-5 text-lg leading-relaxed">{FORMATION.texte}</p>
            </div>
            <div className="border-primary bg-primary-soft shadow-card rounded-2xl border-l-4 p-6 sm:p-8">
              <Coche taille={32} />
              <p className="text-fg mt-4 text-lg leading-relaxed font-semibold">
                {FORMATION.aiAct}
              </p>
            </div>
          </div>
        </section>

        {/* 6. Le principe d'une étape, et comment ça marche en 4 étapes. */}
        <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-principe">
          <div className={CONTENEUR}>
            <div className="max-w-3xl">
              <h2 id="tdf-principe" className={`${TITRE_SECTION} text-fg`}>
                {PRINCIPE.titre}
              </h2>
              <p className="text-fg-soft mt-4 text-lg leading-relaxed">{PRINCIPE.texte}</p>
            </div>
            <h3 id="tdf-comment" className={`${SUR_TITRE} text-terracotta mt-14`}>
              {ETAPES.titre}
            </h3>
            <ol
              aria-labelledby="tdf-comment"
              className={`${styles.parcours} mt-8 grid gap-10 lg:grid-cols-4 lg:gap-8`}
            >
              {ETAPES.liste.map((etape, i) => (
                <li key={etape} className="relative min-h-11 pl-16 lg:pt-16 lg:pl-0">
                  <span
                    aria-hidden="true"
                    className={`absolute top-0 left-0 z-[1] grid h-11 w-11 place-items-center rounded-full font-mono text-[0.95rem] font-bold ${i === ETAPES.liste.length - 1 ? "bg-terracotta text-mocha-fg" : "bg-primary text-primary-fg"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-fg pt-2 text-lg leading-snug font-semibold lg:pt-0">{etape}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 7. Pour qui — de la TPE à l'ETI, et ce que l'audit chiffre par secteur. */}
        <section className={SECTION} aria-labelledby="tdf-pour-qui">
          <div className={CONTENEUR}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 id="tdf-pour-qui" className={`${TITRE_SECTION} text-fg`}>
                  {POUR_QUI.titre}
                </h2>
                <p className="text-fg mt-3 font-serif text-2xl leading-snug">{POUR_QUI.phrase}</p>
              </div>
              <ul className="flex flex-wrap gap-2" aria-label={POUR_QUI.phrase}>
                {POUR_QUI.tailles.map((t) => (
                  <li
                    key={t}
                    className="bg-ink text-mocha-fg rounded-full px-4 py-1.5 text-sm font-bold"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-fg-soft mt-8 text-lg">{POUR_QUI.intro}</p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {POUR_QUI.secteurs.map((s, i) => (
                <li
                  key={s.nom}
                  className={`${styles.carteOffre} border-border bg-paper shadow-subtle flex flex-col gap-3 rounded-xl border p-5`}
                >
                  <span className="text-terracotta">
                    <PictoSecteur index={i} />
                  </span>
                  <span className="text-fg text-base leading-tight font-bold">{s.nom}</span>
                  <span className="text-fg-soft text-[0.9375rem] leading-snug">{s.exemple}</span>
                </li>
              ))}
            </ul>
            <p className="text-fg-soft mt-5">{POUR_QUI.suite}</p>
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
              className="bg-sand-deep ring-terracotta h-28 w-28 shrink-0 rounded-full object-cover ring-4 ring-offset-4 sm:h-40 sm:w-40"
            />
            <div className="max-w-2xl">
              <h2 id="tdf-fondateur" className={`${SUR_TITRE} text-terracotta`}>
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
                  className="text-fg decoration-terracotta hover:text-terracotta focus-visible:outline-primary inline-flex min-h-12 items-center font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
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
            <h2 id="tdf-faq" className={`${TITRE_SECTION} text-fg`}>
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

        {/* 10. En bref — la définition citable, en texte visible (GEO). */}
        <section className="border-border border-t" aria-labelledby="tdf-en-bref">
          <div className={`${CONTENEUR} py-10 sm:py-14`}>
            <div className="mx-auto max-w-3xl">
              <h2 id="tdf-en-bref" className={`${SUR_TITRE} text-fg-muted`}>
                {EN_BREF}
              </h2>
              <p className="text-fg mt-3 text-base leading-relaxed">{DEFINITION}</p>
            </div>
          </div>
        </section>

        {/* 11. Appel final — encre à halo terracotta, comme le héros. */}
        <section
          id={ID_SECTION_FINALE}
          className="bg-vsl text-mocha-fg"
          aria-labelledby={ID_APPEL_FINAL}
        >
          <div className={`${CONTENEUR} py-16 sm:py-24`}>
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <Coche taille={40} surSombre />
              <h2
                id={ID_APPEL_FINAL}
                className="mt-6 font-serif text-[2rem] leading-tight font-medium tracking-tight text-balance sm:text-5xl"
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
