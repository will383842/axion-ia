// `/tour-france-ia` — la landing du Tour France IA (2026-10-25, refonte
// « page de conversion » le 2026-10-26, refonte VISUELLE le 2026-10-27, nouveau
// modèle « 5 journées offertes par ville, sur sélection » le 2026-10-27).
//
// Tunnel : post Facebook, LinkedIn ou Instagram (UTM) → cette page → « Demander
// ma journée offerte » → `/tour-france-ia/demande` (trois champs) →
// `/fr/appel/tour-france-ia` (la visio, type `tour` de `types-reservables.ts`) → Calendly → console.
//
// Écrite pour ce trafic-là : mobile d'abord, navigateur intégré des réseaux, 4G,
// trois secondes d'attention. Très peu de texte, un dessin par bloc :
//   1. premier écran : la puce, le H1, la promesse, l'emplacement de la vidéo (qui
//      porte, tant qu'elle n'est pas là, une carte « aperçu » lumineuse et sa frise
//      de trois pastilles : audit, formation, 4 h chez vous), le bouton pleine
//      largeur, le micro-texte, et SOUS LUI, dans la même boîte, les conditions en
//      petit et leur lien ;
//   2. « Votre ville s'ouvre dès 5 demandes » : la carte de France ;
//   3. « Ce que vous gagnez » : trois cartes en grille « bento » (une large, deux) ;
//   4. « 5 entreprises, visages de leur ville », sur le terracotta, entre deux vagues ;
//   5. « En 3 étapes » : une frise de trois pastilles numérotées, reliées ;
//   6. « Qui vient chez vous » : la photo du fondateur, la phrase de l'équipe ;
//   7. la FAQ (six questions), puis l'appel final et ses conditions.
// UNE seule action, répétée à cinq emplacements fixes (`EMPLACEMENTS_CTA`), aucun menu.
//
// Charte (refonte « 2027 » du 2026-10-27) : les jetons du site (`globals.css`), en
// une palette de six (cf. l'en-tête de `tour.module.css`). En-tête crème dépoli ;
// héros et appel final CLAIRS et chauds, à lueurs terracotta et bleue
// (`FOND_LUMINEUX`) ; boutons bleu primaire pleins — la seule couleur d'action ;
// le terracotta est l'accent (le mot « Nous, si. », les pastilles) et la seule
// section pleine couleur (les ambassadeurs). Fonds alternés crème / papier / sable.
//
// Composants SERVEUR seulement, sauf `PiloteCta` (recopie des `utm_*`). La barre
// d'action collante du mobile est en CSS seul (`position: sticky`). Aucun
// composant d'en-tête ou de pied de page d'Axion, aucun next-intl,
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
  lienDemande,
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
  Vague,
} from "./_composants/Visuels";
import { CompteurVilles } from "./_composants/CompteurVilles";
import { PiloteCta } from "./_composants/PiloteCta";
import styles from "./tour.module.css";

// Le compteur de villes (`CompteurVilles`) se relit toutes les 5 minutes.
export const revalidate = 300;

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
/** Titres de section : Fraunces, typographie fluide (30 px sur téléphone → 48 px à 1280). */
const TITRE_SECTION =
  "font-serif text-[clamp(1.875rem,1.35rem+2.2vw,3rem)] leading-[1.08] font-medium tracking-tight text-balance text-fg";
const SECTION = "py-14 sm:py-24 lg:py-28";
/** Les cartes de la page : papier, coins de 20 px (`--radius-xl`), bordure fine, ombre douce. */
const CARTE = "border-border bg-paper shadow-card rounded-xl border";
/**
 * Le fond lumineux du héros et de l'appel final : le crème d'Axion, une lueur
 * terracotta en haut à droite, une lueur du bleu d'action en bas à gauche. Aucune
 * image : deux `radial-gradient`. En utilitaire Tailwind plutôt qu'en classe du
 * module CSS : chaque classe du module ajoute son nom à la table livrée au
 * navigateur avec le chunk de la page.
 */
const FOND_LUMINEUX =
  "bg-bg bg-[radial-gradient(44rem_30rem_at_96%_-6%,color-mix(in_srgb,var(--color-terracotta)_16%,transparent),transparent_66%),radial-gradient(38rem_26rem_at_-8%_104%,color-mix(in_srgb,var(--color-primary)_11%,transparent),transparent_66%)]";
/** Les conditions sous un grand bouton : 13 px, jamais repliées, en gris-brun lisible sur le crème (8,1:1). */
const TEXTE_CONDITIONS = "text-fg-soft text-[0.8125rem] leading-snug";
const LIEN_CONDITIONS_CLASSES =
  "text-fg decoration-primary/50 hover:decoration-primary focus-visible:outline-primary font-semibold underline decoration-2 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2";
const ID_CTA_HEROS = "tdf-cta-heros";
const ID_CTA_COLLANT = "tdf-cta-collant";
const ID_APPEL_FINAL = "tdf-appel-final";
/** La section entière de l'appel final (la barre collante s'arrête juste avant elle). */
const ID_SECTION_FINALE = "tdf-section-finale";

/** Le dessin de chaque pastille de la frise du héros, dans l'ordre de `HEROS.frise`. */
function PictoFrise({ index }: { index: number }) {
  if (index === 2) return <PictoSecteur index={3} taille={26} />;
  return <IllustrationMoment index={index} taille={30} />;
}

/** La teinte de chaque pastille de la frise du héros : terracotta doux, bleu doux, sable. */
const TEINTES_FRISE = ["bg-terracotta-soft", "bg-primary-soft", "bg-sand-deep/70"] as const;

/** Le dessin de chaque carte de « Ce que vous gagnez », dans l'ordre de `GAINS.cartes`. */
const PICTOS_GAINS = ["heures", "automatisation", "equipe"] as const;

/** Le dessin de chaque avantage des ambassadeurs, dans l'ordre d'`AMBASSADEURS.avantages`. */
function PictoAmbassadeur({ index }: { index: number }) {
  if (index === 0) return <PictoTour nom="site" taille={36} />;
  if (index === 1) return <PictoTour nom="micro" taille={36} />;
  return <IllustrationMoment index={2} taille={36} />;
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
 * Le bouton principal : pilule bleue pleine, 56 px de haut au moins (60 dès la
 * tablette), flèche et halo. `compact` : la petite pilule de l'en-tête et du bloc
 * « gains » (44 px de haut, libellé court, sans flèche ni halo). `pleineLargeur` :
 * la barre collante — libellé court, sur une ligne.
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
      href={lienDemande(depuis)}
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

  // Le compteur est un composant serveur asynchrone : appelé ici, il rend son élément (ou rien).
  const compteur = await CompteurVilles();

  // « < » échappé : un texte ne peut pas fermer la balise `script`.
  const jsonLd = JSON.stringify(jsonLdDuTour()).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* 0. En-tête du tunnel — crème dépoli, le logo (« IA » en terracotta), UN
          bouton. Aucun menu, aucun lien qui ferait sortir du tunnel. */}
      <header className="border-border/70 bg-bg/90 border-b backdrop-blur">
        <div className={`${CONTENEUR} flex min-h-16 items-center gap-3 py-2.5`}>
          <p
            className="text-fg inline-flex shrink-0 items-baseline font-serif text-[1.375rem] leading-none font-medium tracking-tight sm:text-2xl"
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

      <main>
        {/* 1. Héros — clair et chaud, deux lueurs de marque. Premier écran mobile
            (360 × 640) : puce, H1, promesse, carte « aperçu », bouton, micro-texte et
            conditions, sans défiler. Dès 64rem : texte à gauche, carte à droite. */}
        <section className={`${FOND_LUMINEUX} text-fg`} aria-labelledby="tdf-titre">
          <div
            className={`${CONTENEUR} grid pt-5 pb-12 sm:pt-12 sm:pb-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-x-14 lg:pt-20 lg:pb-28`}
          >
            <div className="max-w-3xl">
              {/* Puce en Manrope (repli métrique, préchargée) : JAMAIS d'Inconsolata
                  au-dessus de la ligne de flottaison — sa bascule de police décalait le titre. */}
              <p className="border-border bg-paper/80 text-fg shadow-subtle inline-flex min-h-7 items-center gap-2 rounded-full border px-3 text-[0.6875rem] font-semibold tracking-[0.02em] whitespace-nowrap uppercase sm:text-sm sm:tracking-[0.05em]">
                <span aria-hidden="true" className="bg-terracotta h-2 w-2 rounded-full" />
                {HEROS.surtitre}
              </p>
              <h1
                id="tdf-titre"
                className="mt-3 font-serif text-[clamp(2rem,1.2rem+3.2vw,3.75rem)] leading-[1.04] font-medium tracking-[-0.02em] text-balance sm:mt-6"
              >
                {HEROS.titreAvant}
                <span className="text-terracotta whitespace-nowrap italic">
                  {HEROS.titreAccent}
                </span>
                {HEROS.titreApres}
              </h1>
              <p className="text-fg-soft mt-3 max-w-xl text-lg leading-snug font-semibold sm:mt-5 sm:text-xl">
                {HEROS.promesse}
              </p>
            </div>
            <div className="mt-4 sm:mt-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-center">
              <EmplacementVideo video={VIDEO_HEROS} titre={HEROS.friseTitre}>
                <ol
                  aria-label={HEROS.friseTitre}
                  className={`${styles.frise} grid w-full max-w-md grid-cols-3 gap-2 [--pastille:2.75rem] sm:[--pastille:4.5rem]`}
                >
                  {HEROS.frise.map((moment, i) => (
                    <li
                      key={moment}
                      className="flex flex-col items-center gap-1 text-center text-sm leading-tight font-semibold whitespace-nowrap sm:gap-2.5 sm:text-base"
                    >
                      <span
                        className={`${styles.pastille} ${TEINTES_FRISE[i] ?? "bg-sand"} ring-paper grid h-(--pastille) w-(--pastille) place-items-center rounded-full ring-4 sm:[&>svg]:h-10 sm:[&>svg]:w-10`}
                      >
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
            <div className="mt-4 flex max-w-md flex-col gap-1.5 sm:mt-8 sm:items-start lg:col-start-1">
              <BoutonAudit depuis="tdf-heros" id={ID_CTA_HEROS} />
              <p className="text-fg-soft text-center text-sm sm:pl-2 sm:text-left">
                {MICRO_TEXTE_CTA}
              </p>
              <p className={`${TEXTE_CONDITIONS} text-center sm:pl-2 sm:text-left`}>
                {HEROS.conditions}{" "}
                <a href={LIEN_CONDITIONS.chemin} className={LIEN_CONDITIONS_CLASSES}>
                  {LIEN_CONDITIONS.libelle}
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* De la ville à la FAQ : le bloc dont la barre collante est le DERNIER enfant
            (`position: sticky`) — elle n'existe à l'écran qu'entre le héros et l'appel final. */}
        <div>
          {/* 2. La ville — le seuil, la semaine, la carte (le seul tracé de la France de la page). */}
          <section className={`bg-paper ${SECTION}`} aria-labelledby="tdf-ville">
            <div
              className={`${CONTENEUR} grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16`}
            >
              <div>
                <h2 id="tdf-ville" className={TITRE_SECTION}>
                  {VILLE.titre}
                </h2>
                <p className="text-fg-soft mt-4 text-lg sm:text-xl">{VILLE.semaine}</p>
                {compteur}
              </div>
              <figure className="from-terracotta-soft/70 to-primary-soft/60 mx-auto w-full max-w-[300px] rounded-2xl bg-linear-to-br p-2 sm:max-w-[380px] lg:max-w-[480px]">
                <div className="bg-paper/85 rounded-xl p-4 sm:p-6">
                  <CarteFrance
                    titre={VILLE.alt}
                    titreId="tdf-carte-titre"
                    className="h-auto w-full"
                  />
                </div>
                <figcaption className="text-fg-soft px-2 pt-2 pb-1 text-center text-xs">
                  {VILLE.legende}
                </figcaption>
              </figure>
            </div>
          </section>

          {/* 3. Ce que vous gagnez — grille « bento » : une carte large, puis deux ; un
              dessin en pastille chacune ; puis la pilule compacte. */}
          <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-gains">
            <div className={CONTENEUR}>
              <h2 id="tdf-gains" className={TITRE_SECTION}>
                {GAINS.titre}
              </h2>
              <ul className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-2">
                {GAINS.cartes.map((c, i) => (
                  <li
                    key={c.titre}
                    className={`${CARTE} hover:shadow-elevated flex items-start gap-4 p-5 transition duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-7 ${i === 0 ? "from-terracotta-soft/60 to-paper bg-linear-to-br md:col-span-2 md:items-center md:gap-7" : "md:flex-col"}`}
                  >
                    <span
                      className={`text-fg grid shrink-0 place-items-center rounded-xl ${i === 0 ? "bg-paper h-16 w-16 sm:h-20 sm:w-20" : "bg-terracotta-soft h-16 w-16"}`}
                    >
                      <PictoTour nom={PICTOS_GAINS[i] ?? "heures"} taille={36} />
                    </span>
                    <div>
                      <h3
                        className={`text-fg font-serif leading-snug font-medium ${i === 0 ? "text-2xl sm:text-[2rem]" : "text-xl sm:text-2xl"}`}
                      >
                        {c.titre}
                      </h3>
                      <p className="text-fg-soft mt-1.5 text-base sm:text-lg">{c.texte}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-10 flex justify-center sm:justify-start">
                <BoutonAudit depuis="tdf-bandeau" compact />
              </div>
            </div>
          </section>

          {/* 4. Les ambassadeurs — LA bande pleine couleur de marque, entre deux vagues :
              ce que les 5 retenues reçoivent en plus, et leurs cinq places en pointillé
              (aucun logo, personne d'inventé). Ivoire sur terracotta : 5,2:1 — cartes sans fond. */}
          <div className="bg-sand text-terracotta">
            <Vague className="h-6 w-full sm:h-12" />
          </div>
          <section
            className={`bg-terracotta text-mocha-fg ${SECTION}`}
            aria-labelledby="tdf-ambassadeurs"
          >
            <div className={CONTENEUR}>
              <h2
                id="tdf-ambassadeurs"
                className="font-serif text-[clamp(1.875rem,1.35rem+2.2vw,3rem)] leading-[1.08] font-medium tracking-tight text-balance"
              >
                {AMBASSADEURS.titre}
              </h2>
              <ul className="mt-10 grid gap-4 [--accent-picto:var(--color-terracotta-soft)] md:grid-cols-3 md:gap-5">
                {AMBASSADEURS.avantages.map((a, i) => (
                  <li
                    key={a}
                    className="border-mocha-fg/35 flex items-center gap-4 rounded-xl border p-4 text-lg leading-snug font-semibold sm:p-5 md:flex-col md:items-start"
                  >
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
          <div className="bg-bg text-terracotta">
            <Vague retournee className="h-6 w-full sm:h-12" />
          </div>

          {/* 5. En 3 étapes — trois pastilles numérotées (compteur CSS), reliées par un
              pointillé terracotta ; la dernière, celle du jour fixé, au bleu d'action. */}
          <section className={`bg-bg ${SECTION} pt-10 sm:pt-16`} aria-labelledby="tdf-parcours">
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
                    className="relative flex min-h-16 items-center gap-5 lg:flex-col lg:items-start"
                  >
                    <span
                      className={`${styles.numero} shadow-card relative z-[1] grid h-16 w-16 shrink-0 place-items-center rounded-full ${i === ETAPES.liste.length - 1 ? "bg-primary text-primary-fg [--accent-picto:var(--color-primary-fg)]" : "bg-terracotta text-mocha-fg [--accent-picto:var(--color-terracotta-soft)]"}`}
                    >
                      <PictoEtape index={i} />
                    </span>
                    <p className="text-fg text-lg leading-snug font-semibold sm:text-xl">{etape}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* 6. Qui vient chez vous — la seule image matricielle : sous le pli, en différé,
              dimensions fixes (CLS nul), anneau terracotta. Jamais le LCP : le LCP est
              le texte du H1. La phrase est celle de l'équipe ; la légende dit qui vient. */}
          <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-fondateur">
            <div className={`${CONTENEUR} max-w-4xl`}>
              <h2 id="tdf-fondateur" className={TITRE_SECTION}>
                {FONDATEUR.titre}
              </h2>
              <figure
                className={`${CARTE} mt-10 flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-10`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- une seule photo, 128 px, en différé : next/image ajouterait du JS client */}
                <img
                  src={FONDATEUR.photo}
                  alt={FONDATEUR.alt}
                  width={128}
                  height={128}
                  loading="lazy"
                  decoding="async"
                  className="ring-terracotta ring-offset-paper h-32 w-32 shrink-0 rounded-full object-cover ring-4 ring-offset-4"
                />
                <div>
                  <blockquote className="text-fg font-serif text-2xl leading-snug sm:text-[2rem] sm:leading-[1.2]">
                    <p>{`« ${FONDATEUR.citation} »`}</p>
                  </blockquote>
                  <figcaption className="mt-4">
                    <p className="text-fg-soft text-sm">{FONDATEUR.legende}</p>
                    <a
                      href={FONDATEUR.lien.chemin}
                      className="text-fg decoration-terracotta/50 hover:decoration-terracotta focus-visible:outline-primary inline-flex min-h-11 items-center font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {FONDATEUR.lien.libelle}
                    </a>
                  </figcaption>
                </div>
              </figure>
            </div>
          </section>

          {/* 7. Questions fréquentes — accordéons natifs en cartes (FAQPage dans le JSON-LD). */}
          <section className={`bg-bg ${SECTION}`} aria-labelledby="tdf-faq">
            <div className={`${CONTENEUR} max-w-3xl`}>
              <h2 id="tdf-faq" className={TITRE_SECTION}>
                {FAQ.titre}
              </h2>
              <div className="mt-10 grid gap-3">
                {FAQ.questions.map((q) => (
                  <details
                    key={q.question}
                    className={`${styles.question} border-border bg-paper open:shadow-card rounded-xl border`}
                  >
                    <summary>
                      <span className="text-fg font-serif text-lg leading-snug font-medium sm:text-xl">
                        {q.question}
                      </span>
                      <span className={styles.signe} aria-hidden="true" />
                    </summary>
                    <p className="text-fg-soft px-5 pb-5 text-base leading-relaxed sm:pr-16">
                      {q.reponse}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Barre d'action collante, mobile seulement — CSS SEUL (`position: sticky`,
              `bottom: 0`) : dernier enfant de ce bloc, elle n'apparaît qu'une fois le héros
              dépassé et s'arrête avant l'appel final. Dans le flux : sa place est gardée. */}
          <div
            id={ID_CTA_COLLANT}
            className={`${styles.collant} border-border/80 bg-paper/90 sticky bottom-0 z-40 border-t px-4 pt-3 backdrop-blur md:hidden`}
          >
            <BoutonAudit depuis="tdf-collant" pleineLargeur />
          </div>
        </div>

        {/* 8. Appel final — le même fond lumineux que le héros, dans une grande carte :
            la page se referme comme elle s'ouvre. */}
        <section
          id={ID_SECTION_FINALE}
          className={`${FOND_LUMINEUX} text-fg`}
          aria-labelledby={ID_APPEL_FINAL}
        >
          <div className={`${CONTENEUR} py-14 sm:py-24`}>
            <div className="border-paper bg-paper/70 shadow-elevated mx-auto flex max-w-3xl flex-col items-center rounded-2xl border px-5 py-12 text-center backdrop-blur-sm sm:px-12 sm:py-16">
              <Jauge echelle={1.5} />
              <h2
                id={ID_APPEL_FINAL}
                className="mt-6 font-serif text-[clamp(2rem,1.4rem+2.6vw,3.5rem)] leading-[1.06] font-medium tracking-tight text-balance"
              >
                {APPEL_FINAL.titre}
              </h2>
              <div className="mt-8 flex w-full max-w-md flex-col items-center gap-2">
                <BoutonAudit depuis="tdf-final" />
                <p className="text-fg-soft text-sm">{MICRO_TEXTE_CTA}</p>
                <p className={TEXTE_CONDITIONS}>
                  {APPEL_FINAL.conditions}{" "}
                  <a href={LIEN_CONDITIONS.chemin} className={LIEN_CONDITIONS_CLASSES}>
                    {LIEN_CONDITIONS.libelle}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pied de page propre au Tour. */}
      <footer className="border-border bg-bg border-t">
        <div className={`${CONTENEUR} text-fg-muted pt-10 pb-12 text-sm`}>
          <p className="text-fg font-semibold">{PIED.organise}</p>
          <ul className="mt-3 flex flex-wrap gap-x-5">
            {PIED.liens.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="hover:text-fg focus-visible:outline-primary inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {l.libelle}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3">{PIED.nonAffiliation}</p>
        </div>
      </footer>

      <PiloteCta />
    </>
  );
}
