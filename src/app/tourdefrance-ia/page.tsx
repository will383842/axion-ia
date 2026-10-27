// `/tourdefrance-ia` — la landing du Tour de France IA (2026-10-25, refonte
// « page de conversion » le 2026-10-26, refonte VISUELLE le 2026-10-27, nouveau
// modèle « 5 journées offertes par ville, sur sélection » le 2026-10-27).
//
// Tunnel : post Facebook, LinkedIn ou Instagram (UTM) → cette page → « Demander
// ma journée offerte » → `/fr/appel/tour-de-france-ia` (la visio, type `tour` de
// `types-reservables.ts`) → Calendly → console.
//
// Écrite pour ce trafic-là : mobile d'abord, navigateur intégré des réseaux, 4G,
// trois secondes d'attention. Très peu de texte, un dessin par bloc :
//   1. premier écran : la puce, le H1, la promesse, l'emplacement de la vidéo (qui
//      porte, tant qu'elle n'est pas là, une frise de trois disques : audit,
//      formation, 4 h chez vous), le bouton pleine largeur, le micro-texte, et SOUS
//      LUI, dans la même boîte, les conditions en petit et leur lien ;
//   2. « Votre ville s'ouvre dès 5 demandes » : la carte de France ;
//   3. « Ce que vous gagnez » : trois cartes dessinées ;
//   4. « 5 entreprises, visages de leur ville », sur le terracotta ;
//   5. « En 3 étapes » : trois pastilles dessinées ;
//   6. « Qui vient chez vous » : le fondateur ;
//   7. la FAQ (six questions), puis l'appel final et ses conditions.
// UNE seule action, répétée à cinq emplacements fixes (`EMPLACEMENTS_CTA`), aucun menu.
//
// Charte : celle du site (`globals.css`). En-tête terracotta et logo en badge
// ivoire ; héros et appel final mocha à lueurs terracotta et bleue (`FOND_MARQUE`) ;
// boutons bleu primaire pleins ; sections claires, sable et terracotta.
//
// Composants SERVEUR seulement, sauf `PiloteCta` (bouton collant + recopie des
// `utm_*`). Aucun composant d'en-tête ou de pied de page d'Axion, aucun next-intl,
// aucun script tiers, aucune mesure d'audience. Les dessins sont des SVG en ligne
// (`_composants/Visuels.tsx`), animés en CSS seul ; la FAQ est un `details`/`summary`
// natif. UNE seule image matricielle : la photo du fondateur, sous le pli, en
// différé. Tout le texte vit dans `contenu.ts`.
//
// 🔑 Fermé (`TOUR_PUBLIC` faux) : la page appelle `connection()` — rendu à la
// requête, jamais prérendu ni mis en cache. Ouvert : seul l'interrupteur
// change, et la page redevient statique.

import type { Metadata } from "next";
import { connection } from "next/server";

import { TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";

import {
  AMBASSADEURS,
  APPEL_FINAL,
  ENTETE,
  ETAPES,
  FAQ,
  FONDATEUR,
  GAINS,
  HEROS,
  LIBELLE_CTA,
  LIBELLE_CTA_COURT,
  LIEN_CONDITIONS,
  META,
  MICRO_TEXTE_CTA,
  PIED,
  VIDEO_HEROS,
  VILLE,
  lienRendezVous,
  type EmplacementCta,
} from "./contenu";
import { jsonLdDuTour } from "./jsonld";
import { EmplacementVideo } from "./_composants/EmplacementVideo";
import {
  CarteFrance,
  Fleche,
  IllustrationMoment,
  Jauge,
  PictoSecteur,
  PictoTour,
  PictoVisio,
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
const TITRE_SECTION =
  "font-serif text-[1.875rem] leading-[1.12] font-medium tracking-tight text-fg sm:text-[2.5rem]";
const SECTION = "py-12 sm:py-24";
/**
 * Le fond de marque du héros et de l'appel final : le mocha d'Axion, une lueur
 * terracotta en haut à droite, une lueur bleu primaire en bas à gauche. La lueur
 * terracotta est DOUCE (30 %) : à 62 %, mêlée au mocha juste sous l'en-tête, elle
 * peignait un orange brun, éloigné du terracotta de marque. En
 * utilitaire Tailwind plutôt qu'en classe du module CSS : chaque classe du module
 * ajoute son nom à la table livrée au navigateur avec le chunk de la page.
 */
const FOND_MARQUE =
  "bg-mocha bg-[radial-gradient(48rem_26rem_at_88%_-8%,color-mix(in_srgb,var(--color-terracotta)_30%,transparent),transparent_62%),radial-gradient(36rem_22rem_at_-12%_108%,color-mix(in_srgb,var(--color-primary)_38%,transparent),transparent_62%)]";
/** Les conditions sous un grand bouton : 13 px, jamais repliées, jamais en gris sur le mocha. */
const TEXTE_CONDITIONS = "text-mocha-fg text-[0.8125rem] leading-snug";
const LIEN_SUR_SOMBRE =
  "decoration-mocha-fg/60 hover:decoration-mocha-fg focus-visible:outline-mocha-fg font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2";
const ID_CTA_HEROS = "tdf-cta-heros";
const ID_CTA_COLLANT = "tdf-cta-collant";
const ID_APPEL_FINAL = "tdf-appel-final";
/** La section entière : c'est elle que `PiloteCta` observe (le collant se cache dès qu'elle entre à l'écran). */
const ID_SECTION_FINALE = "tdf-section-finale";

/** Le dessin de chaque disque de la frise du héros, dans l'ordre de `HEROS.frise`. */
function PictoFrise({ index }: { index: number }) {
  if (index === 2) return <PictoSecteur index={3} taille={26} />;
  return <IllustrationMoment index={index} taille={30} />;
}

/** Le dessin de chaque carte de « Ce que vous gagnez », dans l'ordre de `GAINS.cartes`. */
const PICTOS_GAINS = ["heures", "automatisation", "equipe"] as const;

/** Le dessin de chaque avantage des ambassadeurs, dans l'ordre d'`AMBASSADEURS.avantages`. */
function PictoAmbassadeur({ index }: { index: number }) {
  if (index === 0) return <PictoTour nom="site" />;
  if (index === 1) return <PictoTour nom="micro" />;
  return <IllustrationMoment index={2} taille={48} />;
}

/** Les cinq places de la ville, en pointillé : un secteur possible chacune, jamais un logo. */
const SECTEURS_BADGES = [0, 1, 2, 3, 6] as const;

/** Le dessin de chaque pastille de « En 3 étapes », dans l'ordre d'`ETAPES.liste`. */
function PictoEtape({ index }: { index: number }) {
  if (index === 0) return <IllustrationMoment index={3} taille={32} />;
  if (index === 1) return <PictoVisio taille={32} />;
  return <PictoTour nom="calendrier" taille={32} />;
}

/**
 * Le bouton principal : pilule bleue pleine, 56 px de haut au moins, flèche et
 * halo. `compact` : la petite pilule de l'en-tête et du bloc « gains » (44 px de
 * haut, libellé court, sans flèche ni halo). `pleineLargeur` : la barre collante —
 * libellé court, sur une ligne.
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
      {compact || pleineLargeur ? LIBELLE_CTA_COURT : LIBELLE_CTA}
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
      <header className="bg-terracotta/95 border-terracotta-deep border-b">
        <div className={`${CONTENEUR} flex min-h-16 items-center gap-3 py-2.5`}>
          <p
            className="bg-paper text-fg shadow-subtle inline-flex shrink-0 items-baseline rounded-lg px-2.5 py-2 font-serif text-lg leading-none font-medium tracking-tight sm:px-3 sm:text-[1.375rem]"
            role="img"
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
        {/* 1. Héros — mocha de marque à lueurs terracotta et bleue. Premier écran
            mobile (360 × 640) : puce, H1, promesse, frise, bouton, micro-texte et
            conditions, sans défiler. La carte n'est PLUS dans le héros : elle a son bloc. */}
        <section className={`${FOND_MARQUE} text-mocha-fg`} aria-labelledby="tdf-titre">
          <div className={`${CONTENEUR} pt-5 pb-12 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24`}>
            <div className="max-w-3xl">
              {/* Puce en Manrope (repli métrique, préchargée) : JAMAIS d'Inconsolata
                  au-dessus de la ligne de flottaison — sa bascule de police décalait le titre. */}
              <p className="border-mocha-fg/30 bg-mocha-fg/10 text-mocha-fg inline-flex min-h-7 items-center gap-2 rounded-full border px-3 text-[0.6875rem] font-semibold tracking-[0.02em] whitespace-nowrap uppercase sm:text-sm sm:tracking-[0.04em]">
                <span aria-hidden="true" className="bg-terracotta-on-mocha h-2 w-2 rounded-full" />
                {HEROS.surtitre}
              </p>
              <h1
                id="tdf-titre"
                className="mt-3 font-serif text-[clamp(2rem,9vw,3.25rem)] leading-[1.06] font-medium tracking-tight text-balance sm:mt-5"
              >
                {HEROS.titreAvant}
                <span className="text-terracotta-on-mocha decoration-terracotta italic underline decoration-[0.12em] underline-offset-[0.14em]">
                  {HEROS.titreAccent}
                </span>
                {HEROS.titreApres}
              </h1>
              <p className="mt-3 max-w-xl text-lg leading-snug font-semibold sm:mt-4 sm:text-xl">
                {HEROS.promesse}
              </p>
              <div className="mt-4 sm:mt-6">
                <EmplacementVideo video={VIDEO_HEROS} titre={HEROS.friseTitre}>
                  <ol
                    aria-label={HEROS.friseTitre}
                    className="grid w-full max-w-md grid-cols-3 gap-2 [--accent-picto:var(--color-terracotta-on-mocha)]"
                  >
                    {HEROS.frise.map((moment, i) => (
                      <li
                        key={moment}
                        className="flex flex-col items-center gap-1 text-center text-sm leading-tight font-semibold whitespace-nowrap"
                      >
                        <span className="border-mocha-fg/25 bg-mocha-fg/10 grid h-11 w-11 place-items-center rounded-full border">
                          <PictoFrise index={i} />
                        </span>
                        {moment}
                      </li>
                    ))}
                  </ol>
                </EmplacementVideo>
              </div>
              {/* Le bouton et SES conditions, dans la même boîte : la contrepartie se lit
                  d'un même regard que la promesse, jamais repliée, jamais en astérisque. */}
              <div className="mt-4 flex max-w-md flex-col gap-1.5 sm:mt-8 sm:items-start">
                <BoutonAudit depuis="tdf-heros" id={ID_CTA_HEROS} />
                <p className="text-mocha-fg-muted text-center text-sm sm:pl-2 sm:text-left">
                  {MICRO_TEXTE_CTA}
                </p>
                <p className={`${TEXTE_CONDITIONS} text-center sm:pl-2 sm:text-left`}>
                  {HEROS.conditions}{" "}
                  <a href={LIEN_CONDITIONS.chemin} className={LIEN_SUR_SOMBRE}>
                    {LIEN_CONDITIONS.libelle}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. La ville — le seuil, la semaine, la carte (le seul tracé de la France de la page). */}
        <section className={SECTION} aria-labelledby="tdf-ville">
          <div
            className={`${CONTENEUR} grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14`}
          >
            <div>
              <h2 id="tdf-ville" className={TITRE_SECTION}>
                {VILLE.titre}
              </h2>
              <p className="text-fg-soft mt-3 text-lg">{VILLE.semaine}</p>
            </div>
            <figure className="bg-sand border-border mx-auto w-full max-w-[300px] rounded-2xl border p-4 sm:max-w-[380px] sm:p-5 lg:max-w-[480px]">
              <CarteFrance titre={VILLE.alt} titreId="tdf-carte-titre" className="h-auto w-full" />
              <figcaption className="text-fg-soft mt-3 text-center text-xs">
                {VILLE.legende}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* 3. Ce que vous gagnez — trois cartes, un dessin chacune, puis la pilule compacte. */}
        <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-gains">
          <div className={CONTENEUR}>
            <h2 id="tdf-gains" className={TITRE_SECTION}>
              {GAINS.titre}
            </h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {GAINS.cartes.map((c, i) => (
                <li
                  key={c.titre}
                  className="border-border bg-paper shadow-card flex items-start gap-4 rounded-2xl border p-5 md:flex-col"
                >
                  <span className="text-fg shrink-0">
                    <PictoTour nom={PICTOS_GAINS[i] ?? "heures"} />
                  </span>
                  <div>
                    <h3 className="text-fg font-serif text-xl leading-snug font-medium">
                      {c.titre}
                    </h3>
                    <p className="text-fg-soft mt-1">{c.texte}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <BoutonAudit depuis="tdf-bandeau" compact />
            </div>
          </div>
        </section>

        {/* 4. Les ambassadeurs — bande au terracotta de marque : ce que les 5 retenues
            reçoivent en plus, et leurs cinq places en pointillé (aucun logo, personne d'inventé). */}
        <section
          className={`bg-terracotta text-mocha-fg ${SECTION}`}
          aria-labelledby="tdf-ambassadeurs"
        >
          <div className={CONTENEUR}>
            <h2
              id="tdf-ambassadeurs"
              className="font-serif text-[1.875rem] leading-tight font-medium tracking-tight sm:text-5xl"
            >
              {AMBASSADEURS.titre}
            </h2>
            <ul className="mt-8 grid gap-5 [--accent-picto:var(--color-terracotta-soft)] md:grid-cols-3">
              {AMBASSADEURS.avantages.map((a, i) => (
                <li key={a} className="flex items-center gap-4 text-lg leading-snug font-semibold">
                  <span className="bg-mocha-fg/15 grid h-16 w-16 shrink-0 place-items-center rounded-full">
                    <PictoAmbassadeur index={i} />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
            <ul aria-hidden="true" className="mt-10 flex flex-wrap gap-3">
              {SECTEURS_BADGES.map((s) => (
                <li
                  key={s}
                  className="border-mocha-fg/70 grid h-14 w-14 place-items-center rounded-full border-2 border-dashed"
                >
                  <PictoSecteur index={s} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5. En 3 étapes — trois pastilles dessinées, reliées par un pointillé. */}
        <section className={SECTION} aria-labelledby="tdf-parcours">
          <div className={CONTENEUR}>
            <h2 id="tdf-parcours" className={TITRE_SECTION}>
              {ETAPES.titre}
            </h2>
            <ol
              aria-labelledby="tdf-parcours"
              data-sens="ligne"
              className={`${styles.parcours} mt-8 grid gap-8 lg:grid-cols-3`}
            >
              {ETAPES.liste.map((etape, i) => (
                <li
                  key={etape}
                  className="relative flex min-h-14 items-center gap-4 lg:flex-col lg:items-start"
                >
                  <span
                    className={`relative z-[1] grid h-14 w-14 shrink-0 place-items-center rounded-full ${i === ETAPES.liste.length - 1 ? "bg-primary text-primary-fg [--accent-picto:var(--color-primary-fg)]" : "bg-terracotta text-mocha-fg [--accent-picto:var(--color-terracotta-soft)]"}`}
                  >
                    <PictoEtape index={i} />
                  </span>
                  <p className="text-fg text-lg leading-snug font-semibold">{etape}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 6. Qui vient chez vous — la seule image matricielle : sous le pli, en différé,
            dimensions fixes (CLS nul). Jamais le LCP : le LCP est le texte du H1. */}
        <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-fondateur">
          <div className={`${CONTENEUR} max-w-3xl`}>
            <h2 id="tdf-fondateur" className={TITRE_SECTION}>
              {FONDATEUR.titre}
            </h2>
            <figure className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- une seule photo, 96 px, en différé : next/image ajouterait du JS client */}
              <img
                src={FONDATEUR.photo}
                alt={FONDATEUR.alt}
                width={96}
                height={96}
                loading="lazy"
                decoding="async"
                className="h-24 w-24 shrink-0 rounded-full object-cover"
              />
              <div>
                <blockquote className="text-fg font-serif text-xl leading-snug sm:text-2xl">
                  <p>{`«\u00a0${FONDATEUR.citation}\u00a0»`}</p>
                </blockquote>
                <figcaption className="mt-3">
                  <a
                    href={FONDATEUR.lien.chemin}
                    className="text-fg decoration-border-strong hover:decoration-terracotta focus-visible:outline-primary inline-flex min-h-11 items-center font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {FONDATEUR.lien.libelle}
                  </a>
                </figcaption>
              </div>
            </figure>
          </div>
        </section>

        {/* 7. Questions fréquentes — accordéon natif (FAQPage dans le JSON-LD). */}
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

        {/* 8. Appel final — le même mocha à lueurs que le héros : la page se referme comme elle s'ouvre. */}
        <section
          id={ID_SECTION_FINALE}
          className={`${FOND_MARQUE} text-mocha-fg`}
          aria-labelledby={ID_APPEL_FINAL}
        >
          <div className={`${CONTENEUR} py-16 sm:py-24`}>
            <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
              <Jauge echelle={1.5} />
              <h2
                id={ID_APPEL_FINAL}
                className="mt-6 font-serif text-[2rem] leading-tight font-medium tracking-tight sm:text-5xl"
              >
                {APPEL_FINAL.titre}
              </h2>
              <div className="mt-8 flex w-full max-w-md flex-col items-center gap-2">
                <BoutonAudit depuis="tdf-final" />
                <p className="text-mocha-fg-muted text-sm">{MICRO_TEXTE_CTA}</p>
                <p className={TEXTE_CONDITIONS}>
                  {APPEL_FINAL.conditions}{" "}
                  <a href={LIEN_CONDITIONS.chemin} className={LIEN_SUR_SOMBRE}>
                    {LIEN_CONDITIONS.libelle}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pied de page propre au Tour. */}
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
