// `/tourdefrance-ia` — la landing du Tour de France IA (2026-10-25, refonte
// « page de conversion » le 2026-10-26, refonte VISUELLE « une journée offerte »
// le 2026-10-27 : la page était jugée bien trop textuelle, surtout sur téléphone).
//
// Tunnel : post Facebook, LinkedIn ou Instagram (UTM) → cette page → « Je veux
// ma journée offerte » → `/fr/appel/tour-de-france-ia` (la visio, type `tour` de
// `types-reservables.ts`) → Calendly → console.
//
// Écrite pour ce trafic-là : mobile d'abord, navigateur intégré des réseaux, 4G,
// trois secondes d'attention. Très peu de texte, un dessin qui domine chaque bloc :
//   1. premier écran : la puce du Tour, le H1, la promesse, une frise de trois
//      disques dessinés (audit, formation d'équipe, vendredi soir), le bouton
//      pleine largeur, et SOUS LUI, dans la même boîte, les conditions en petit ;
//      la carte de France suit juste sous le pli (à droite sur grand écran) ;
//   2. « En 3 étapes » : trois pastilles dessinées ;
//   3. « Votre journée offerte » : la scène de la journée, puis la frise du matin
//      (l'audit) et de l'après-midi (la formation) ;
//   4. « Le vendredi soir », sur le terracotta ;
//   5. la FAQ (six questions), puis l'appel final et ses conditions.
// UNE seule action, répétée à cinq emplacements fixes (`EMPLACEMENTS_CTA`), aucun menu.
//
// Charte : celle du site (`globals.css`). En-tête terracotta et logo en badge
// ivoire ; héros et appel final mocha à lueurs terracotta et bleue (`FOND_MARQUE`) ;
// boutons bleu primaire pleins ; sections claires, sable et terracotta.
//
// Composants SERVEUR seulement, sauf `PiloteCta` (bouton collant + recopie des
// `utm_*`). Aucun composant d'en-tête ou de pied de page d'Axion, aucun next-intl,
// aucun script tiers, aucune mesure d'audience, aucune image matricielle. Les
// dessins sont des SVG en ligne (`_composants/Visuels.tsx`), animés en CSS seul ;
// la FAQ est un `details`/`summary` natif. Tout le texte vit dans `contenu.ts`.
//
// 🔑 Fermé (`TOUR_PUBLIC` faux) : la page appelle `connection()` — rendu à la
// requête, jamais prérendu ni mis en cache. Ouvert : seul l'interrupteur
// change, et la page redevient statique.

import type { Metadata } from "next";
import { connection } from "next/server";

import { TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";

import {
  APPEL_FINAL,
  CONDITIONS,
  ENTETE,
  ETAPES,
  FAQ,
  HEROS,
  JOURNEE,
  LIBELLE_CTA,
  LIBELLE_CTA_COURT,
  META,
  MICRO_TEXTE_CTA,
  PIED,
  PRINCIPE,
  VENDREDI,
  lienRendezVous,
  type EmplacementCta,
} from "./contenu";
import { jsonLdDuTour } from "./jsonld";
import {
  CarteFrance,
  Coche,
  Fleche,
  IllustrationMoment,
  Jauge,
  PictoLevier,
  PictoSecteur,
  PictoVisio,
  SceneEntreprise,
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
const ID_CTA_HEROS = "tdf-cta-heros";
const ID_CTA_COLLANT = "tdf-cta-collant";
const ID_APPEL_FINAL = "tdf-appel-final";
/** La section entière : c'est elle que `PiloteCta` observe (le collant se cache dès qu'elle entre à l'écran). */
const ID_SECTION_FINALE = "tdf-section-finale";

/** Le dessin de chaque disque de la frise du héros, dans l'ordre de `HEROS.frise`. */
const PICTOS_FRISE = [0, 1, 2] as const;

/** Le dessin de chaque pastille de « En 3 étapes », dans l'ordre d'`ETAPES.liste`. */
function PictoEtape({ index }: { index: number }) {
  if (index === 0) return <PictoVisio taille={32} />;
  if (index === 1) return <IllustrationMoment index={3} taille={32} />;
  return <PictoSecteur index={3} taille={28} />;
}

/**
 * Le bouton principal : pilule bleue pleine, 56 px de haut au moins, flèche et
 * halo. `compact` : la petite pilule de l'en-tête et du bloc « journée » (44 px de
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
            mobile : puce, H1, promesse, frise de trois disques, bouton et conditions.
            La carte vient juste sous le pli (à droite sur grand écran). */}
        <section className={`${FOND_MARQUE} text-mocha-fg`} aria-labelledby="tdf-titre">
          <div
            className={`${CONTENEUR} grid gap-8 pt-5 pb-12 sm:pt-12 sm:pb-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:pt-16 lg:pb-24`}
          >
            <div>
              {/* Puce en Manrope (repli métrique, préchargée) : JAMAIS d'Inconsolata
                  au-dessus de la ligne de flottaison — sa bascule de police décalait le titre. */}
              <p className="border-mocha-fg/30 bg-mocha-fg/10 text-mocha-fg inline-flex min-h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold tracking-[0.06em] uppercase sm:text-sm">
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
              <ol
                aria-label={HEROS.friseTitre}
                className="mt-4 grid max-w-md grid-cols-3 gap-2 [--accent-picto:var(--color-terracotta-on-mocha)] sm:mt-6"
              >
                {HEROS.frise.map((moment, i) => (
                  <li
                    key={moment}
                    className="flex flex-col items-center gap-1.5 text-center text-sm leading-tight font-semibold"
                  >
                    <span className="border-mocha-fg/25 bg-mocha-fg/10 grid h-12 w-12 place-items-center rounded-full border">
                      <IllustrationMoment index={PICTOS_FRISE[i] ?? 0} taille={30} />
                    </span>
                    {moment}
                  </li>
                ))}
              </ol>
              {/* Le bouton et SES conditions, dans la même boîte : la limite se lit
                  d'un même regard que la promesse, jamais repliée, jamais en astérisque. */}
              <div className="mt-5 flex max-w-md flex-col gap-2 sm:mt-8 sm:items-start">
                <BoutonAudit depuis="tdf-heros" id={ID_CTA_HEROS} />
                <p className="text-mocha-fg text-center text-[0.8125rem] leading-snug sm:pl-2 sm:text-left">
                  {HEROS.conditions}
                </p>
              </div>
            </div>

            {/* Après le bouton dans le flux : sur téléphone, la carte ne pousse jamais
                le bouton hors du premier écran. */}
            <figure className="bg-ink/45 border-border-on-mocha shadow-elevated mx-auto w-full max-w-[300px] rounded-2xl border p-4 sm:max-w-[380px] sm:p-5 lg:max-w-[480px]">
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

        {/* 2. En 3 étapes — trois pastilles dessinées, reliées par un pointillé. */}
        <section className={`bg-sand ${SECTION}`} aria-labelledby="tdf-parcours">
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

        {/* 3. Votre journée offerte — la scène, puis le matin et l'après-midi. */}
        <section className={SECTION} aria-labelledby="tdf-journee">
          <div
            className={`${CONTENEUR} grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14`}
          >
            <div>
              <h2 id="tdf-journee" className={TITRE_SECTION}>
                {JOURNEE.titre}
              </h2>
              <div className="bg-sand mt-6 rounded-2xl p-4">
                <SceneEntreprise className="h-auto w-full" />
              </div>
            </div>
            <div>
              <ol aria-labelledby="tdf-journee" className={`${styles.parcours} grid gap-8`}>
                {JOURNEE.moments.map((m, i) => (
                  <li key={m.titre} className="relative flex items-start gap-4">
                    <span className="bg-terracotta-soft text-fg relative z-[1] grid h-14 w-14 shrink-0 place-items-center rounded-full">
                      <IllustrationMoment index={i} taille={34} />
                    </span>
                    <div className="border-border bg-paper shadow-card min-w-0 flex-1 rounded-2xl border p-4 sm:p-5">
                      <p className="text-terracotta text-sm font-bold tracking-wide uppercase">
                        {m.moment}
                      </p>
                      <h3 className="text-fg mt-1 font-serif text-2xl leading-snug font-medium">
                        {m.titre}
                      </h3>
                      <p className="text-fg-soft mt-1">{m.texte}</p>
                      {i === 0 ? (
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {JOURNEE.leviers.map((l, j) => (
                            <li
                              key={l}
                              className="bg-sand text-fg inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
                            >
                              <PictoLevier index={j} taille={18} />
                              {l}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <>
                          <p className="text-fg mt-3 text-sm font-semibold">{JOURNEE.forme}</p>
                          <p className="text-fg mt-2 flex items-start gap-2 text-sm">
                            <Coche taille={18} className="mt-0.5 shrink-0" />
                            {JOURNEE.aiAct}
                          </p>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-6 pl-[4.5rem]">
                <BoutonAudit depuis="tdf-bandeau" compact />
              </div>
            </div>
          </div>
        </section>

        {/* 4. Le vendredi soir — bande au terracotta de marque, un dessin, une ligne. */}
        <section
          className={`bg-terracotta text-mocha-fg ${SECTION}`}
          aria-labelledby="tdf-vendredi"
        >
          <div className={`${CONTENEUR} flex items-center gap-5 sm:gap-8`}>
            <span className="bg-mocha-fg/15 grid h-20 w-20 shrink-0 place-items-center rounded-full [--accent-picto:var(--color-terracotta-soft)] sm:h-28 sm:w-28">
              <IllustrationMoment index={2} taille={56} />
            </span>
            <div>
              <h2
                id="tdf-vendredi"
                className="font-serif text-[1.875rem] leading-tight font-medium tracking-tight sm:text-5xl"
              >
                {VENDREDI.titre}
              </h2>
              <p className="mt-2 text-lg">{VENDREDI.texte}</p>
            </div>
          </div>
        </section>

        {/* 5. Questions fréquentes — accordéon natif (FAQPage dans le JSON-LD). */}
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
                  <p className="text-fg-soft pr-12 pb-6 text-base leading-relaxed">
                    {q.reponse}
                    {q.lien ? (
                      <>
                        {" "}
                        <a
                          href={q.lien.chemin}
                          className="text-fg decoration-border-strong hover:decoration-terracotta focus-visible:outline-primary inline-flex min-h-11 items-center font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {q.lien.libelle}
                        </a>
                      </>
                    ) : null}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Appel final — le même mocha à lueurs que le héros : la page se referme comme elle s'ouvre. */}
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
              <div className="mt-8 flex w-full max-w-md flex-col items-center gap-2.5">
                <BoutonAudit depuis="tdf-final" />
                <p className="text-mocha-fg-muted text-sm">{MICRO_TEXTE_CTA}</p>
                <p className="text-mocha-fg text-[0.8125rem] leading-snug">{CONDITIONS}</p>
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
