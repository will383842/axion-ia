/**
 * Frise d'étapes (méthode, Journée IA). Composant serveur, zéro JS client.
 *
 * Le sens est porté par l'`ol` et ses `h3` : le trait et la flèche sont décoratifs.
 * Classes en tables fixes : jamais de classe construite par concaténation.
 */

export interface EtapeFrise {
  numero: string;
  titre: string;
  texte: string;
  /** Étiquette de moment (variante horaire) : « Matin », « Après-midi »… */
  moment?: string;
  /** Ligne « Ce que vous obtenez ». */
  obtenu?: string;
}

const GRILLE = {
  3: "lg:grid-cols-3",
  5: "sm:grid-cols-2 sm:border-l-0 sm:pl-0 lg:grid-cols-3 xl:grid-cols-5",
} as const;

/** Décalage du disque sur le trait vertical (mobile) ; annulé quand la liste passe en colonnes. */
const DECALAGE_DISQUE = {
  3: "-ml-[61px] lg:ml-0",
  5: "-ml-[61px] sm:ml-0",
} as const;

/** Trait de liaison horizontal : seulement quand toutes les étapes tiennent sur une ligne. */
const TRAIT = {
  3: "lg:before:absolute lg:before:h-0.5 lg:before:bg-terracotta/40 lg:before:inset-x-[16%]",
  5: "xl:before:absolute xl:before:h-0.5 xl:before:bg-terracotta/40 xl:before:inset-x-[10%]",
} as const;

/** Hauteur du trait : au centre du disque (56 px), plus bas si une étiquette le surmonte. */
const HAUTEUR_TRAIT = {
  3: { simple: "lg:before:top-7", horaire: "lg:before:top-12" },
  5: { simple: "xl:before:top-7", horaire: "xl:before:top-12" },
} as const;

const ANNEAU = { ivoire: "ring-bg", creme: "ring-sand" } as const;

type NombreEtapes = keyof typeof GRILLE;

export function FriseEtapes({
  etapes,
  conclusion,
  ton = "ivoire",
}: {
  etapes: ReadonlyArray<EtapeFrise>;
  conclusion?: string | undefined;
  ton?: "ivoire" | "creme";
}) {
  if (etapes.length === 0) return null;
  // 3 étapes : trois colonnes ; au-delà : la disposition à cinq colonnes.
  const n: NombreEtapes = etapes.length <= 3 ? 3 : 5;
  const aMoment = etapes.some((e) => e.moment);
  // Le trait ne se pose que si les étapes remplissent exactement la grille (pas de colonne vide).
  const traitComplet = etapes.length === n;
  const trait = traitComplet
    ? `${TRAIT[n]} ${HAUTEUR_TRAIT[n][aMoment ? "horaire" : "simple"]}`
    : "";

  return (
    <div>
      <ol
        role="list"
        className={`border-terracotta/40 relative grid gap-10 border-l-2 pl-8 lg:gap-6 lg:border-l-0 lg:pl-0 ${GRILLE[n]} ${trait}`}
      >
        {etapes.map((e) => (
          <li key={e.numero} className="flex flex-col lg:items-center lg:text-center">
            {aMoment ? (
              <p className="text-terracotta-deep mb-1 h-4 text-xs leading-4 font-semibold tracking-[0.14em] uppercase">
                {e.moment}
              </p>
            ) : null}
            <span
              aria-hidden="true"
              className={`bg-terracotta text-mocha-fg relative z-10 ${DECALAGE_DISQUE[n]} flex size-14 shrink-0 items-center justify-center rounded-full font-serif text-2xl ring-8 ${ANNEAU[ton]}`}
            >
              {e.numero}
            </span>
            <h3 className="text-fg mt-4 font-serif text-2xl leading-snug">{e.titre}</h3>
            <p className="text-fg-soft mt-2 text-base leading-relaxed">{e.texte}</p>
            {e.obtenu ? (
              <p className="text-terracotta-deep mt-3 text-base font-bold">
                <span className="font-semibold">Ce que vous obtenez : </span>
                {e.obtenu}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {conclusion ? (
        <div className="mt-8 flex flex-col items-start gap-3 lg:items-center">
          <svg
            aria-hidden="true"
            focusable="false"
            width="24"
            height="32"
            viewBox="0 0 24 32"
            fill="none"
            className="text-terracotta"
          >
            <path
              d="M12 2v24m0 0-8-8m8 8 8-8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="bg-terracotta-soft text-fg max-w-2xl rounded-2xl p-5 font-semibold">
            {conclusion}
          </p>
        </div>
      ) : null}
    </div>
  );
}
