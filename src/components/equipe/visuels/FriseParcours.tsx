/**
 * Frise chronologique du parcours. Composant serveur, zéro JS client.
 * Une date n'est affichée que si elle est fournie ; `<time>` seulement pour une année.
 */

export interface JalonParcours {
  titre: string;
  texte: string;
  /** Repère libre sans année (« Aujourd'hui », « Depuis plus de 30 ans »). */
  repere?: string;
  /** Année (quatre chiffres) : rendue dans un `<time dateTime>`. */
  annee?: string;
}

const GRILLE = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
} as const;

const TRAIT = {
  1: "",
  2: "lg:before:absolute lg:before:top-[3.25rem] lg:before:h-0.5 lg:before:bg-terracotta/40 lg:before:inset-x-[25%]",
  3: "lg:before:absolute lg:before:top-[3.25rem] lg:before:h-0.5 lg:before:bg-terracotta/40 lg:before:inset-x-[16%]",
  4: "lg:before:absolute lg:before:top-[3.25rem] lg:before:h-0.5 lg:before:bg-terracotta/40 lg:before:inset-x-[12%]",
} as const;

export function FriseParcours({ jalons }: { jalons: ReadonlyArray<JalonParcours> }) {
  if (jalons.length === 0) return null;
  // Au-delà de quatre jalons : la frise reste verticale.
  const n = jalons.length <= 4 ? (jalons.length as keyof typeof GRILLE) : null;

  return (
    <ol
      role="list"
      className={`border-terracotta/40 relative grid gap-10 border-l-2 pl-8 lg:gap-6 lg:border-l-0 lg:pl-0 ${n ? `${GRILLE[n]} ${TRAIT[n]}` : ""}`}
    >
      {jalons.map((j) => (
        <li key={j.titre} className="relative flex flex-col lg:items-center lg:text-center">
          <span
            aria-hidden="true"
            className="bg-terracotta ring-paper absolute top-2 -left-[2.6rem] size-4 rounded-full ring-4 lg:static lg:order-2 lg:my-3"
          />
          {j.annee ? (
            <time
              dateTime={j.annee}
              className="text-terracotta font-serif text-3xl leading-none lg:order-1"
            >
              {j.annee}
            </time>
          ) : j.repere ? (
            <p className="text-terracotta font-serif text-3xl leading-none lg:order-1">
              {j.repere}
            </p>
          ) : null}
          <h3 className="text-fg mt-2 text-lg font-semibold lg:order-3 lg:mt-0">{j.titre}</h3>
          <p className="text-fg-soft mt-2 text-base leading-relaxed lg:order-4">{j.texte}</p>
        </li>
      ))}
    </ol>
  );
}
