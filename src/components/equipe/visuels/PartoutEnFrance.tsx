import { Link } from "@/i18n/navigation";
import { Container } from "@/components/layout/Container";
import { FOND_FRANCE_PATH } from "../fond-france";
import { HAUTEUR_CARTE, LARGEUR_CARTE } from "@/lib/equipe/geo";

/**
 * Bloc « Partout en France » (GEO local). Composant serveur, props typées localement.
 * Formulation : « nous intervenons à … », jamais de bureau ni d'agence.
 */
export interface VillePartout {
  slug: string;
  nom: string;
  href: string;
  point?: { x: number; y: number } | null;
}

export interface PartoutEnFranceProps {
  id?: string;
  surTitre: string;
  question: string;
  /** Réponse directe de 40 à 60 mots. */
  reponse: string;
  regions: ReadonlyArray<string>;
  /** 12 villes au plus, déjà triées. */
  villes: ReadonlyArray<VillePartout>;
  /** Phrase propre à un collaborateur (département connu), sinon absente. */
  phraseLieu?: string | undefined;
  titreVilles?: string;
  lienIndex?: { href: string; libelle: string };
}

export function PartoutEnFrance({
  id = "partout-en-france",
  surTitre,
  question,
  reponse,
  regions,
  villes,
  phraseLieu,
  titreVilles = "Quelques villes où nous intervenons",
  lienIndex,
}: PartoutEnFranceProps) {
  if (villes.length === 0 && regions.length === 0) return null;
  const liste = villes.slice(0, 12);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      data-fond="creme"
      className="bg-sand py-16 lg:py-24"
    >
      <Container>
        <p className="text-terracotta text-xs font-semibold tracking-[0.14em] uppercase">
          {surTitre}
        </p>
        <h2
          id={`${id}-titre`}
          className="text-fg mt-2 max-w-3xl font-serif text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight tracking-tight"
        >
          {question}
        </h2>
        <p
          data-reponse-section=""
          className="text-fg-soft mt-4 max-w-3xl text-lg leading-relaxed sm:text-xl"
        >
          {reponse}
        </p>
        {phraseLieu ? (
          <p className="text-fg mt-3 max-w-3xl text-base font-medium">{phraseLieu}</p>
        ) : null}
        <div className="mt-10 grid items-start gap-10 lg:mt-14 lg:grid-cols-[minmax(0,2fr)_3fr]">
          <svg
            viewBox={`0 0 ${LARGEUR_CARTE} ${HAUTEUR_CARTE}`}
            className="mx-auto hidden max-h-[26rem] w-full lg:block"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d={FOND_FRANCE_PATH}
              className="fill-paper stroke-border-strong"
              strokeWidth="3"
            />
            {liste.map((v) =>
              v.point ? (
                <circle
                  key={v.slug}
                  cx={v.point.x}
                  cy={v.point.y}
                  r="11"
                  className="fill-terracotta"
                />
              ) : null,
            )}
          </svg>
          <div>
            {regions.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {regions.map((r) => (
                  <li
                    key={r}
                    className="border-border-strong bg-paper text-fg rounded-full border px-3 py-1.5 text-sm font-medium"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
            {liste.length > 0 ? (
              <>
                <h3 className="text-fg mt-8 font-serif text-xl">{titreVilles}</h3>
                <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {liste.map((v) => (
                    <li key={v.slug}>
                      <Link
                        href={v.href as never}
                        className="text-fg focus-visible:outline-terracotta hover:text-terracotta-deep inline-flex min-h-11 items-center underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {`Nous intervenons à ${v.nom}`}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {lienIndex ? (
              <p className="mt-4">
                <Link
                  href={lienIndex.href as never}
                  className="text-terracotta-deep focus-visible:outline-terracotta inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {lienIndex.libelle}
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
