// `/tour-france-ia/conditions-generales` — les conditions générales du Tour
// France IA (2026-10-27). Une page de LECTURE, liée sous chaque grand bouton de la
// landing et depuis son pied de page.
//
//   · ni indexée ni dans un sitemap (`robots` : index faux, follow vrai) : elle
//     se lit depuis la landing, elle ne s'y substitue pas dans les résultats ;
//   · la version (`VERSION_CG`) est affichée sous le titre : c'est elle que
//     l'entreprise accepte avec sa demande ;
//   · le sommaire est un `details` fermé sur téléphone, une colonne collante sur
//     grand écran ; les articles ne sont JAMAIS repliés (`h2 id="article-N"`),
//     texte à 17 px, 68 caractères par ligne au plus, impression propre ;
//   · composant serveur, aucun script ; le texte vit dans `conditions.ts`.

import type { Metadata } from "next";
import { connection } from "next/server";

import { TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";

import { ENTETE, META, NOM_DU_TOUR, PIED } from "../contenu";
import { ARTICLES, LIBELLES_CG, META_CG, TITRE_CG, VERSION_CG, type Bloc } from "./conditions";

const CHEMIN = `${META.chemin}/conditions-generales`;

export const metadata: Metadata = {
  title: { absolute: META_CG.titre },
  description: META_CG.description,
  alternates: { canonical: CHEMIN },
  robots: { index: false, follow: true },
};

const CONTENEUR = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";
const LIEN =
  "text-fg decoration-border-strong hover:decoration-terracotta focus-visible:outline-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2";

/** « 2026-10-27 » → « 27 octobre 2026 » (sans `Intl` : le rendu ne dépend d'aucun fuseau). */
function dateEnClair(iso: string): string {
  const MOIS = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  const [a, m, j] = iso.split("-").map(Number);
  return `${j} ${MOIS[(m ?? 1) - 1]} ${a}`;
}

function Sommaire() {
  return (
    <ol className="space-y-1 text-sm">
      {ARTICLES.map((a) => (
        <li key={a.numero}>
          <a
            href={`#article-${a.numero}`}
            className="text-fg-soft hover:text-fg inline-flex min-h-9 items-center underline-offset-4 hover:underline"
          >
            {a.numero}. {a.titre}
          </a>
        </li>
      ))}
    </ol>
  );
}

function Paragraphe({ bloc }: { bloc: Bloc }) {
  if (typeof bloc === "string") return <p>{bloc}</p>;
  return (
    <ol className="list-decimal space-y-2 pl-6">
      {bloc.liste.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ol>
  );
}

export default async function ConditionsGeneralesDuTour() {
  if (!TOUR_PUBLIC) await connection();

  return (
    <>
      {/* Le même en-tête que la landing : crème dépoli, le logo, une seule action (le retour). */}
      <header className="border-border/70 bg-bg/90 border-b backdrop-blur print:hidden">
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
          <a
            href={META.chemin}
            className="border-border bg-paper text-fg hover:border-border-strong focus-visible:outline-primary shadow-subtle ml-auto inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {LIBELLES_CG.retour}
          </a>
        </div>
      </header>

      <main className={`${CONTENEUR} py-10 sm:py-16`}>
        <div className="max-w-[68ch]">
          <p className="border-border bg-paper/80 text-fg inline-flex min-h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold tracking-[0.05em] uppercase print:border-0 print:px-0">
            <span aria-hidden="true" className="bg-terracotta h-2 w-2 rounded-full print:hidden" />
            {NOM_DU_TOUR}
          </p>
          <h1 className="text-fg mt-4 font-serif text-[2rem] leading-tight font-medium tracking-tight text-balance sm:text-[2.5rem]">
            {TITRE_CG}
          </h1>
          <p className="text-fg-soft mt-3">
            {LIBELLES_CG.version} <time dateTime={VERSION_CG}>{dateEnClair(VERSION_CG)}</time>
          </p>
        </div>

        <div className="mt-8 lg:grid lg:grid-cols-[16rem_minmax(0,68ch)] lg:gap-12">
          {/* Sommaire : replié sur téléphone, colonne collante sur grand écran. */}
          <details className="border-border bg-paper rounded-xl border p-4 lg:hidden print:hidden">
            <summary className="text-fg min-h-11 cursor-pointer font-semibold">
              {LIBELLES_CG.sommaire}
            </summary>
            <div className="mt-3">
              <Sommaire />
            </div>
          </details>
          <nav aria-label={LIBELLES_CG.sommaire} className="hidden lg:block print:hidden">
            <div className="sticky top-6">
              <p className="text-fg mb-2 font-semibold">{LIBELLES_CG.sommaire}</p>
              <Sommaire />
            </div>
          </nav>

          <div className="text-fg mt-8 max-w-[68ch] text-[1.0625rem] leading-relaxed lg:mt-0 print:text-[11pt]">
            {ARTICLES.map((a) => (
              <section
                key={a.numero}
                aria-labelledby={`article-${a.numero}`}
                className="mt-10 first:mt-0 print:break-inside-avoid"
              >
                <h2
                  id={`article-${a.numero}`}
                  className="scroll-mt-6 font-serif text-2xl leading-snug font-medium"
                >
                  {LIBELLES_CG.article} {a.numero} — {a.titre}
                </h2>
                <div className="mt-3 space-y-3">
                  {a.blocs.map((b, i) => (
                    <Paragraphe key={i} bloc={b} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <footer
        className={`${CONTENEUR} border-border text-fg-muted border-t pt-8 pb-12 text-sm print:hidden`}
      >
        <p className="text-fg font-semibold">{PIED.organise}</p>
        <p className="mt-3 flex flex-wrap gap-x-5">
          <a href={META.chemin} className={`${LIEN} inline-flex min-h-11 items-center`}>
            {LIBELLES_CG.retour}
          </a>
          <a
            href="https://axion-ia.com/fr/mentions-legales"
            className={`${LIEN} inline-flex min-h-11 items-center`}
          >
            {LIBELLES_CG.mentions}
          </a>
        </p>
        <p className="mt-3">{PIED.nonAffiliation}</p>
      </footer>
    </>
  );
}
