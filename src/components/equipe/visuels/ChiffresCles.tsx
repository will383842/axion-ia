import { iconeDe } from "./icones";

/**
 * Rangée de chiffres clés, DERNIÈRE rangée du héros (fond foncé) : ce n'est pas une section.
 * Moins de deux chiffres : rien (jamais un chiffre isolé ni inventé).
 */
export function ChiffresCles({
  chiffres,
}: {
  chiffres: ReadonlyArray<{ valeur: string; libelle: string; icone?: string }>;
}) {
  if (chiffres.length < 2) return null;
  return (
    <ul
      role="list"
      aria-label="Chiffres clés"
      className="border-border-on-mocha lg:divide-border-on-mocha mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-t pt-10 lg:grid-cols-4 lg:divide-x"
    >
      {chiffres.map((c) => {
        const Icone = iconeDe(c.icone);
        return (
          <li key={c.valeur + c.libelle} className="lg:px-6 lg:first:pl-0">
            <Icone aria-hidden="true" focusable="false" className="text-mocha-fg mb-3 h-5 w-5" />
            <p className="text-terracotta-on-mocha font-serif [font-feature-settings:'tnum'] text-[clamp(2.5rem,5vw,4rem)] leading-none tracking-tight">
              {c.valeur}
            </p>
            <p className="text-mocha-fg mt-2 text-base">{c.libelle}</p>
          </li>
        );
      })}
    </ul>
  );
}
